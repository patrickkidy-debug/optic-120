import { PaymentStatus, SaleStatus } from '@oculo/shared-types';
import type { PaymentConfigInput } from '@oculo/shared-types';
import { prisma } from '../../lib/prisma.js';
import { encryptSecret, decryptSecret } from '../../lib/crypto.js';
import { env, appOrigin } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import type { PaymentProvider } from './payment-provider.interface.js';
import { SimulatedPaymentProvider } from './providers/simulated.provider.js';
import { PayTechProvider } from './providers/paytech.provider.js';
import { MonerooProvider } from './providers/moneroo.provider.js';

interface StoredPaymentConfig {
  provider?: 'paytech' | 'moneroo';
  apiKeyEnc?: string;
  apiSecretEnc?: string;
  siteId?: string;
  environment?: 'sandbox' | 'production';
  webhookUrl?: string;
  simulationMode?: boolean;
  // Encaissement MANUEL de la boutique (QR + coordonnées affichés au client).
  collectNetwork?: string;
  collectNumber?: string;
  collectName?: string;
  collectQr?: string; // image (data URL)
}

export interface CollectInfo {
  network: string;
  number: string;
  name: string;
  qr: string;
}

/** Coordonnées d'encaissement manuel de la boutique (affichées à la caisse). */
export async function getCollectInfo(tenantId: string): Promise<CollectInfo> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  const cfg = (tenant?.paymentConfig as StoredPaymentConfig | null) ?? null;
  return {
    network: cfg?.collectNetwork ?? '',
    number: cfg?.collectNumber ?? '',
    name: cfg?.collectName ?? '',
    qr: cfg?.collectQr ?? '',
  };
}

export async function saveCollectInfo(tenantId: string, input: CollectInfo): Promise<CollectInfo> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  const cfg = (tenant?.paymentConfig as StoredPaymentConfig | null) ?? {};
  const stored: StoredPaymentConfig = {
    ...cfg,
    collectNetwork: input.network,
    collectNumber: input.number,
    collectName: input.name,
    collectQr: input.qr,
  };
  await prisma.tenant.update({ where: { id: tenantId }, data: { paymentConfig: stored as object } });
  return getCollectInfo(tenantId);
}

interface ResolvedConfig {
  provider: 'paytech' | 'moneroo';
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
      logger.error({ err }, 'Échec de déchiffrement de la clé API de paiement');
    }
  }
  if (cfg?.apiSecretEnc) {
    try {
      apiSecret = decryptSecret(cfg.apiSecretEnc);
    } catch (err) {
      logger.error({ err }, 'Échec de déchiffrement de la clé secrète de paiement');
    }
  }
  return {
    provider: cfg?.provider ?? 'paytech',
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
    provider: c.provider,
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
    provider: input.provider,
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
 * IMPORTANT (modèle revendeur) : chaque boutique encaisse sur SON propre compte.
 * On n'utilise JAMAIS le compte de la plateforme pour les ventes (sinon l'éditeur
 * collecterait le chiffre d'affaires de ses clients). Sans config tenant valide
 * → simulation (encaissement en ligne désactivé tant que la boutique n'a pas
 * branché son compte).
 */
export async function resolveProvider(tenantId: string): Promise<PaymentProvider> {
  const c = await resolvePaymentConfig(tenantId);
  const apiBase = env.PUBLIC_API_URL.replace(/\/$/, '');
  const successUrl = `${appOrigin}/optique/caisse`;

  if (!c.simulationMode && c.apiKey) {
    if (c.provider === 'moneroo') {
      return new MonerooProvider({
        secretKey: c.apiKey,
        baseUrl: env.MONEROO_BASE_URL,
        returnUrl: successUrl,
        webhookSecret: c.apiSecret || undefined,
      });
    }
    if (c.apiSecret) {
      return new PayTechProvider({
        apiKey: c.apiKey,
        apiSecret: c.apiSecret,
        env: c.environment === 'production' ? 'prod' : 'test',
        baseUrl: env.PAYTECH_BASE_URL,
        ipnUrl: apiBase ? `${apiBase}/webhooks/paytech` : undefined,
        successUrl,
        cancelUrl: successUrl,
      });
    }
  }

  // Aucune config propre à la boutique → simulation (jamais le compte éditeur).
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
