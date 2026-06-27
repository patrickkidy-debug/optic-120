import { PaymentStatus, SaleStatus } from '@oculo/shared-types';
import type { PaymentConfigInput } from '@oculo/shared-types';
import { prisma } from '../../lib/prisma.js';
import { encryptSecret, decryptSecret } from '../../lib/crypto.js';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import type { PaymentProvider } from './payment-provider.interface.js';
import { SimulatedPaymentProvider } from './providers/simulated.provider.js';
import { CinetPayProvider } from './providers/cinetpay.provider.js';

interface StoredPaymentConfig {
  apiKeyEnc?: string;
  siteId?: string;
  environment?: 'sandbox' | 'production';
  webhookUrl?: string;
  simulationMode?: boolean;
}

interface ResolvedConfig {
  apiKey: string;
  siteId: string;
  environment: 'sandbox' | 'production';
  webhookUrl: string;
  simulationMode: boolean;
}

export async function resolvePaymentConfig(tenantId: string): Promise<ResolvedConfig> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  const cfg = (tenant?.paymentConfig as StoredPaymentConfig | null) ?? null;
  let apiKey = '';
  if (cfg?.apiKeyEnc) {
    try {
      apiKey = decryptSecret(cfg.apiKeyEnc);
    } catch (err) {
      logger.error({ err }, 'Échec de déchiffrement de la clé CinetPay');
    }
  }
  return {
    apiKey,
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
    siteId: c.siteId,
    environment: c.environment,
    webhookUrl: c.webhookUrl,
    simulationMode: c.simulationMode,
  };
}

export async function savePaymentConfig(tenantId: string, input: PaymentConfigInput) {
  const current = await resolvePaymentConfig(tenantId);
  // Si apiKey vide en entrée, conserver la clé existante.
  const apiKey = input.apiKey ? input.apiKey : current.apiKey;
  const stored: StoredPaymentConfig = {
    apiKeyEnc: apiKey ? encryptSecret(apiKey) : undefined,
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

/** Choisit le fournisseur selon la config : simulation par défaut. */
export async function resolveProvider(tenantId: string): Promise<PaymentProvider> {
  const c = await resolvePaymentConfig(tenantId);
  if (c.simulationMode || !c.apiKey || !c.siteId) {
    return new SimulatedPaymentProvider();
  }
  return new CinetPayProvider({
    apiKey: c.apiKey,
    siteId: c.siteId,
    baseUrl: env.CINETPAY_BASE_URL,
    notifyUrl: c.webhookUrl || undefined,
  });
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
