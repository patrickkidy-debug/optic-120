import { PaymentStatus, SaleStatus } from '@oculo/shared-types';
import type { PaymentConfigInput } from '@oculo/shared-types';
import { prisma } from '../../lib/prisma.js';
import { encryptSecret, decryptSecret } from '../../lib/crypto.js';
import { env, appOrigin } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import type { PaymentProvider } from './payment-provider.interface.js';
import { SimulatedPaymentProvider } from './providers/simulated.provider.js';
import { PayTechProvider } from './providers/paytech.provider.js';

interface StoredPaymentConfig {
  apiKeyEnc?: string;
  apiSecretEnc?: string;
  siteId?: string;
  environment?: 'sandbox' | 'production';
  webhookUrl?: string;
  simulationMode?: boolean;
}

interface ResolvedConfig {
  apiKey: string;
  apiSecret: string;
  siteId: string;
  environment: 'sandbox' | 'production';
  webhookUrl: string;
  simulationMode: boolean;
}

export async function resolvePaymentConfig(tenantId: string): Promise<ResolvedConfig> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  const cfg = (tenant?.paymentConfig as StoredPaymentConfig | null) ?? null;
  let apiKey = '';
  let apiSecret = '';
  if (cfg?.apiKeyEnc) {
    try {
      apiKey = decryptSecret(cfg.apiKeyEnc);
    } catch (err) {
      logger.error({ err }, 'Échec de déchiffrement de la clé API PayTech');
    }
  }
  if (cfg?.apiSecretEnc) {
    try {
      apiSecret = decryptSecret(cfg.apiSecretEnc);
    } catch (err) {
      logger.error({ err }, 'Échec de déchiffrement de la clé secrète PayTech');
    }
  }
  return {
    apiKey,
    apiSecret,
    siteId: cfg?.siteId ?? '',
    environment: cfg?.environment ?? 'sandbox',
    webhookUrl: cfg?.webhookUrl ?? '',
    simulationMode: cfg?.simulationMode ?? true,
  };
}

/** Config masquée pour l'UI (ne renvoie jamais la clé en clair). */
export async function getMaskedPaymentConfig(tenantId: string) {
  const c = await resolvePaymentConfig(tenantId);
  return {
    apiKeySet: c.apiKey.length > 0,
    apiSecretSet: c.apiSecret.length > 0,
    siteId: c.siteId,
    environment: c.environment,
    webhookUrl: c.webhookUrl,
    simulationMode: c.simulationMode,
  };
}

export async function savePaymentConfig(tenantId: string, input: PaymentConfigInput) {
  const current = await resolvePaymentConfig(tenantId);
  // Si une clé est vide en entrée, conserver la valeur existante.
  const apiKey = input.apiKey ? input.apiKey : current.apiKey;
  const apiSecret = input.apiSecret ? input.apiSecret : current.apiSecret;
  const stored: StoredPaymentConfig = {
    apiKeyEnc: apiKey ? encryptSecret(apiKey) : undefined,
    apiSecretEnc: apiSecret ? encryptSecret(apiSecret) : undefined,
    siteId: input.siteId ?? '',
    environment: input.environment,
    webhookUrl: input.webhookUrl ?? '',
    simulationMode: input.simulationMode,
  };
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { paymentConfig: stored as object },
  });
  return getMaskedPaymentConfig(tenantId);
}

/**
 * Choisit le fournisseur pour les VENTES du tenant.
 * Priorité : 1) clés PayTech propres au tenant ; 2) repli sur les clés PayTech
 * de la plateforme (env) — ainsi une config unique sur Render encaisse aussi
 * les ventes ; 3) simulation si aucune clé n'est disponible.
 */
export async function resolveProvider(tenantId: string): Promise<PaymentProvider> {
  const c = await resolvePaymentConfig(tenantId);
  const apiBase = env.PUBLIC_API_URL.replace(/\/$/, '');
  const ipnUrl = apiBase ? `${apiBase}/webhooks/paytech` : undefined;
  const successUrl = `${appOrigin}/optique/caisse`;

  // 1) Clés propres au tenant (sauf simulation forcée).
  if (!c.simulationMode && c.apiKey && c.apiSecret) {
    return new PayTechProvider({
      apiKey: c.apiKey,
      apiSecret: c.apiSecret,
      env: c.environment === 'production' ? 'prod' : 'test',
      baseUrl: env.PAYTECH_BASE_URL,
      ipnUrl,
      successUrl,
      cancelUrl: successUrl,
    });
  }

  // 2) Repli sur les clés PayTech de la plateforme (compte unique).
  if (env.PAYTECH_API_KEY && env.PAYTECH_API_SECRET) {
    return new PayTechProvider({
      apiKey: env.PAYTECH_API_KEY,
      apiSecret: env.PAYTECH_API_SECRET,
      env: env.PAYTECH_ENV,
      baseUrl: env.PAYTECH_BASE_URL,
      ipnUrl,
      successUrl,
      cancelUrl: successUrl,
    });
  }

  // 3) Aucune clé → simulation.
  return new SimulatedPaymentProvider();
}

/**
 * Applique un résultat de paiement (succès/échec) de façon idempotente :
 * met à jour le Payment, journalise une Transaction, et recalcule l'état de
 * paiement de la vente. N'effectue aucun mouvement de stock (le stock est
 * décrémenté à la création de la vente).
 */
export async function settlePayment(
  paymentId: string,
  status: PaymentStatus,
  raw: unknown,
): Promise<{ saleId: string; status: PaymentStatus } | null> {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { id: paymentId },
      include: { sale: true },
    });
    if (!payment) return null;

    const wasSuccess = payment.status === PaymentStatus.SUCCESS;

    await tx.payment.update({
      where: { id: paymentId },
      data: { status, rawPayload: (raw ?? undefined) as object | undefined },
    });
    await tx.transaction.create({
      data: { paymentId, event: 'settled', status, payload: (raw ?? undefined) as object | undefined },
    });

    if (status === PaymentStatus.SUCCESS && !wasSuccess) {
      const sale = payment.sale;
      const newPaid = Number(sale.paidAmount) + Number(payment.amount);
      const total = Number(sale.totalAmount);
      const newStatus =
        newPaid >= total ? SaleStatus.PAID : SaleStatus.PARTIALLY_PAID;
      await tx.sale.update({
        where: { id: sale.id },
        data: { paidAmount: newPaid, status: newStatus },
      });
    }

    return { saleId: payment.saleId, status };
  });
}

/** Résout un paiement par sa référence fournisseur (webhook). */
export async function findPaymentByProviderRef(providerRef: string) {
  return prisma.payment.findFirst({ where: { providerRef } });
}
