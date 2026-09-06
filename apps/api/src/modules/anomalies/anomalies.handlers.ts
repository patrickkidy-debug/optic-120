import {
  PaymentStatus,
  SaleStatus,
  SaleType,
  AnomalyTargetEntity,
  saleUpdateSchema,
  saleItemSchema,
  ANOMALY_REASON_LABELS,
} from '@oculo/shared-types';
import { z } from 'zod';
import type { AnomalyCorrectionEntry } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import type { TenantPrisma } from '../../lib/prisma-tenant.js';
import { badRequest, notFound } from '../../lib/http-error.js';
import { updateSale, cancelSale, createReturn } from '../sales/sales.service.js';
import { adjustStock } from '../stock/stock.service.js';
import { updateClaimFields, correctRefund } from '../management/insurance.routes.js';
import { applyDirectFieldCorrection, type DirectFieldTarget } from './anomalies.fields.js';

const saleItemsArraySchema = z.array(saleItemSchema).min(1, 'Au moins un article requis');

export interface HandlerResult {
  /** Valeurs numériques avant/après, pour le calcul d'impact figé. */
  before: Record<string, number>;
  after: Record<string, number>;
}

const n = (v: unknown): number => Number(v ?? 0);

function entryValue(e: AnomalyCorrectionEntry): string | null {
  return e.newValue;
}

/** Reconstruit un objet {champ: valeur} depuis les lignes de correction déclarées. */
function byField(entries: AnomalyCorrectionEntry[]): Map<string, AnomalyCorrectionEntry> {
  return new Map(entries.map((e) => [e.fieldName, e]));
}

/* -------------------------------- VENTE/DEVIS ------------------------------ */

export async function handleSaleFieldCorrection(
  tenantId: string,
  userId: string,
  saleId: string,
  entries: AnomalyCorrectionEntry[],
  reasonLabel: string,
): Promise<HandlerResult> {
  const map = byField(entries);
  const before = await prisma.sale.findFirst({ where: { id: saleId, tenantId } });
  if (!before) throw notFound('Vente introuvable');

  const raw: Record<string, unknown> = {};
  const itemsEntry = map.get('items');
  if (itemsEntry) {
    let parsedItems: unknown;
    try {
      parsedItems = JSON.parse(entryValue(itemsEntry) ?? '[]');
    } catch {
      throw badRequest('Articles corrigés invalides (JSON attendu)');
    }
    const result = saleItemsArraySchema.safeParse(parsedItems);
    if (!result.success) throw badRequest('Articles corrigés invalides : ' + result.error.message);
    raw.items = result.data;
  }
  const discount = map.get('discountAmount');
  if (discount) raw.discountAmount = Number(entryValue(discount) ?? 0);
  const customer = map.get('customerId');
  if (customer) raw.customerId = entryValue(customer) || null;
  const vat = map.get('vatRate');
  if (vat) raw.vatRate = Number(entryValue(vat) ?? 0);
  const input = saleUpdateSchema.parse(raw);

  // Champs administratifs, hors du périmètre de updateSale() : patch direct,
  // sans recalcul financier (ils ne touchent ni le stock ni les montants).
  const directData: Record<string, unknown> = {};
  const createdAt = map.get('createdAt');
  if (createdAt) directData.createdAt = new Date(entryValue(createdAt) ?? '');
  const cashierId = map.get('cashierId');
  if (cashierId) directData.cashierId = entryValue(cashierId);

  let after = before;
  if (Object.keys(input).length > 0) {
    after = await updateSale(tenantId, saleId, userId, input);
  }
  if (Object.keys(directData).length > 0) {
    await prisma.sale.updateMany({ where: { id: saleId, tenantId }, data: directData });
    after = (await prisma.sale.findFirst({ where: { id: saleId, tenantId } })) ?? after;
  }

  return {
    before: { totalAmount: n(before.totalAmount) },
    after: { totalAmount: n(after.totalAmount) },
  };
}

/* ---------------------------------- STOCK ---------------------------------- */

export async function handleStockAdjustment(
  tenantId: string,
  userId: string,
  stockItemId: string,
  entries: AnomalyCorrectionEntry[],
  anomalyNumber: string,
  reasonLabel: string,
): Promise<HandlerResult> {
  const item = await prisma.stockItem.findFirst({ where: { id: stockItemId, tenantId } });
  if (!item) throw notFound('Ligne de stock introuvable');
  const quantityEntry = entries.find((e) => e.fieldName === 'quantity');
  const desired = Number(quantityEntry ? entryValue(quantityEntry) : item.quantity);
  const delta = desired - item.quantity;
  if (delta === 0) return { before: { quantity: item.quantity }, after: { quantity: item.quantity } };

  await adjustStock(
    tenantId,
    {
      productId: item.productId,
      branchId: item.branchId,
      delta,
      reason: `Anomalie ${anomalyNumber} — ${reasonLabel}`,
    },
    userId,
  );

  return { before: { quantity: item.quantity }, after: { quantity: desired } };
}

/* ------------------------------- ANNULATION -------------------------------- */

export async function handleSaleCancellation(tenantId: string, userId: string, saleId: string): Promise<HandlerResult> {
  const sale = await prisma.sale.findFirst({ where: { id: saleId, tenantId }, include: { items: true, payments: true } });
  if (!sale) throw notFound('Vente introuvable');

  const wasStockMoved =
    sale.type === SaleType.SALE &&
    ([SaleStatus.CONFIRMED, SaleStatus.PARTIALLY_PAID, SaleStatus.PAID] as string[]).includes(sale.status);
  const restockedQuantity = wasStockMoved ? sale.items.reduce((s, i) => s + i.quantity, 0) : 0;
  const cashPaidAmount = sale.payments
    .filter((p) => p.status === PaymentStatus.SUCCESS && p.method === 'CASH')
    .reduce((s, p) => s + n(p.amount), 0);

  await cancelSale(tenantId, saleId, userId);

  return {
    before: { totalAmount: n(sale.totalAmount), restockedQuantity, cashPaidAmount },
    after: {},
  };
}

/* ------------------------------ RETOUR PRODUIT ------------------------------ */

export async function handleProductReturn(
  tenantId: string,
  userId: string,
  saleId: string,
  entries: AnomalyCorrectionEntry[],
): Promise<HandlerResult> {
  const sale = await prisma.sale.findFirst({ where: { id: saleId, tenantId }, include: { items: true } });
  if (!sale) throw notFound('Vente introuvable');
  const restockedQuantity = sale.items.reduce((s, i) => s + i.quantity, 0);
  const cashRefundEntry = entries.find((e) => e.fieldName === 'cashRefund');
  const cashRefundAmount = cashRefundEntry ? Number(entryValue(cashRefundEntry) ?? 0) : 0;

  await createReturn(tenantId, saleId, userId);

  return {
    before: { totalAmount: n(sale.totalAmount), restockedQuantity, cashRefundAmount },
    after: {},
  };
}

/* --------------------------------- PAIEMENT --------------------------------- */

/**
 * Corrige un paiement déjà réglé (méthode/montant), sans jamais le
 * supprimer — symétrique à `settlePayment()` mais dans l'autre sens (le
 * montant peut baisser). Seul vrai terrain neuf du module : aucune fonction
 * existante ne permettait de revenir sur un paiement réussi.
 */
export async function handlePaymentCorrection(
  tenantId: string,
  userId: string,
  paymentId: string,
  entries: AnomalyCorrectionEntry[],
): Promise<HandlerResult> {
  const map = byField(entries);
  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findFirst({ where: { id: paymentId, tenantId }, include: { sale: true } });
    if (!payment) throw notFound('Paiement introuvable');
    if (payment.status !== PaymentStatus.SUCCESS) {
      throw badRequest('Seul un paiement réglé (SUCCESS) peut être corrigé');
    }

    const methodEntry = map.get('method');
    const amountEntry = map.get('amount');
    const nextMethod = methodEntry ? (entryValue(methodEntry) as never) : payment.method;
    const nextAmount = amountEntry ? Number(entryValue(amountEntry) ?? 0) : n(payment.amount);
    const amountDelta = nextAmount - n(payment.amount);

    const sale = payment.sale;
    const nextPaid = n(sale.paidAmount) + amountDelta;
    const total = n(sale.totalAmount);
    if (nextPaid < 0 || nextPaid > total) {
      throw badRequest(
        `Le montant corrigé ferait sortir l'encaissement de la vente de [0, ${total}] (actuel : ${nextPaid}).`,
      );
    }
    const nextStatus = nextPaid >= total ? SaleStatus.PAID : nextPaid > 0 ? SaleStatus.PARTIALLY_PAID : SaleStatus.CONFIRMED;

    await tx.payment.update({ where: { id: paymentId }, data: { method: nextMethod, amount: nextAmount } });
    await tx.transaction.create({
      data: { paymentId, event: 'anomaly_correction', status: PaymentStatus.SUCCESS, payload: { amountDelta } },
    });
    await tx.sale.update({ where: { id: sale.id }, data: { paidAmount: nextPaid, status: nextStatus as never } });

    return {
      before: { amount: n(payment.amount) },
      after: { amount: nextAmount },
    };
  });
}

/* --------------------------------- ASSURANCE -------------------------------- */

export async function handleInsuranceCorrection(
  db: TenantPrisma,
  userId: string,
  targetEntity: AnomalyTargetEntity,
  targetId: string,
  entries: AnomalyCorrectionEntry[],
): Promise<HandlerResult> {
  const map = byField(entries);
  if (targetEntity === AnomalyTargetEntity.INSURANCE_REFUND) {
    const before = await db.insuranceRefund.findFirst({ where: { id: targetId } });
    if (!before) throw notFound('Remboursement introuvable');
    const receivedEntry = map.get('receivedAmount');
    await correctRefund(db, userId, targetId, {
      receivedAmount: receivedEntry ? Number(entryValue(receivedEntry) ?? 0) : undefined,
    });
    return {
      before: { receivedAmount: n(before.receivedAmount) },
      after: { receivedAmount: receivedEntry ? Number(entryValue(receivedEntry) ?? 0) : n(before.receivedAmount) },
    };
  }

  // INSURANCE_CLAIM
  const before = await db.insuranceClaim.findFirst({ where: { id: targetId } });
  if (!before) throw notFound('Dossier introuvable');
  const requestedEntry = map.get('requestedAmount');
  const acceptedEntry = map.get('acceptedAmount');
  const patch: Record<string, unknown> = {};
  if (requestedEntry) patch.requestedAmount = Number(entryValue(requestedEntry) ?? 0);
  if (acceptedEntry) patch.acceptedAmount = Number(entryValue(acceptedEntry) ?? 0);
  const updated = await updateClaimFields(db, targetId, patch as never);

  return {
    before: { requestedAmount: n(before.requestedAmount), acceptedAmount: n(before.acceptedAmount) },
    after: {
      requestedAmount: n(updated?.requestedAmount ?? before.requestedAmount),
      acceptedAmount: n(updated?.acceptedAmount ?? before.acceptedAmount),
    },
  };
}

/* ------------------------------ CHAMPS DIRECTS ------------------------------ */

const DIRECT_TARGETS: Partial<Record<AnomalyTargetEntity, DirectFieldTarget>> = {
  PRODUCT: 'PRODUCT',
  CUSTOMER: 'CUSTOMER',
  LENS_ORDER: 'LENS_ORDER',
  REPAIR: 'REPAIR',
  CASH_REGISTER: 'CASH_REGISTER',
};

const NUMERIC_DIRECT_FIELDS = new Set([
  'buyPrice', 'sellPrice', 'cost', 'loyaltyPoints', 'openingAmount', 'closingAmount',
]);

export async function handleDirectFieldCorrection(
  db: TenantPrisma,
  targetEntity: AnomalyTargetEntity,
  targetId: string,
  entries: AnomalyCorrectionEntry[],
): Promise<HandlerResult> {
  const direct = DIRECT_TARGETS[targetEntity];
  if (!direct) throw badRequest(`Catégorie non prise en charge : ${targetEntity}`);

  const changes = entries.map((e) => ({ fieldName: e.fieldName, newValue: entryValue(e) }));
  const { before, after } = await applyDirectFieldCorrection(db, direct, targetId, changes);

  const numBefore: Record<string, number> = {};
  const numAfter: Record<string, number> = {};
  for (const key of Object.keys(before)) {
    if (NUMERIC_DIRECT_FIELDS.has(key)) {
      numBefore[key] = Number(before[key] ?? 0);
      numAfter[key] = Number(after[key] ?? 0);
    }
  }
  return { before: numBefore, after: numAfter };
}

export { ANOMALY_REASON_LABELS };
