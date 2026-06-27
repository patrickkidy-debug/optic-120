import {
  SaleType,
  SaleStatus,
  StockMovementType,
  PaymentStatus,
  VAT_RATE,
  MOBILE_MONEY_METHODS,
} from '@oculo/shared-types';
import type { SaleCreateInput, PaymentMethod } from '@oculo/shared-types';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { badRequest, notFound, conflict } from '../../lib/http-error.js';
import { resolveProvider, settlePayment } from '../payments/payment.service.js';

type Tx = Prisma.TransactionClient;

async function nextNumber(tx: Tx, tenantId: string, type: SaleType): Promise<string> {
  const prefix = type === SaleType.QUOTE ? 'DEV' : 'VEN';
  const year = new Date().getFullYear();
  const count = await tx.sale.count({
    where: { tenantId, type, number: { startsWith: `${prefix}-${year}-` } },
  });
  return `${prefix}-${year}-${String(count + 1).padStart(6, '0')}`;
}

interface ComputedLine {
  productId: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  name: string;
}

/**
 * Crée une vente ou un devis. Les montants sont TOUJOURS recalculés côté
 * serveur (jamais confiance au client). Pour une vente, le stock est décrémenté
 * atomiquement (rejet si insuffisant).
 */
export async function createSale(tenantId: string, userId: string, input: SaleCreateInput) {
  return prisma.$transaction(async (tx) => {
    const branch = await tx.branch.findFirst({ where: { id: input.branchId, tenantId } });
    if (!branch) throw notFound('Succursale introuvable');

    const productIds = input.items.map((i) => i.productId);
    const products = await tx.product.findMany({
      where: { id: { in: productIds }, tenantId, isActive: true },
    });
    const byId = new Map(products.map((p) => [p.id, p]));

    let subtotal = 0;
    const lines: ComputedLine[] = input.items.map((i) => {
      const p = byId.get(i.productId);
      if (!p) throw badRequest(`Produit introuvable ou inactif : ${i.productId}`);
      const unitPrice = Number(p.sellPrice);
      const lineTotal = unitPrice * i.quantity;
      subtotal += lineTotal;
      return { productId: i.productId, quantity: i.quantity, unitPrice, lineTotal, name: p.name };
    });

    const discount = input.discountAmount ?? 0;
    const insurance = input.insuranceAmount ?? 0;
    const taxBase = Math.max(0, subtotal - discount);
    const taxAmount = Math.round(taxBase * VAT_RATE);
    const total = taxBase + taxAmount;
    const isSale = input.type === SaleType.SALE;

    const number = await nextNumber(tx, tenantId, input.type);
    const paidInit = isSale ? Math.min(insurance, total) : 0;
    const status = !isSale
      ? SaleStatus.DRAFT
      : paidInit >= total
        ? SaleStatus.PAID
        : SaleStatus.CONFIRMED;

    const sale = await tx.sale.create({
      data: {
        tenantId,
        branchId: input.branchId,
        customerId: input.customerId ?? null,
        cashierId: userId,
        number,
        type: input.type,
        status,
        subtotal,
        discountAmount: discount,
        taxAmount,
        insuranceAmount: insurance,
        totalAmount: total,
        paidAmount: paidInit,
        currency: branch ? 'XOF' : 'XOF',
        items: {
          create: lines.map((l) => ({
            productId: l.productId,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            lineTotal: l.lineTotal,
          })),
        },
      },
      include: { items: { include: { product: true } }, customer: true },
    });

    if (isSale) {
      for (const line of lines) {
        const item = await tx.stockItem.findFirst({
          where: { productId: line.productId, branchId: input.branchId, tenantId },
        });
        if (!item || item.quantity < line.quantity) {
          throw badRequest(`Stock insuffisant pour « ${line.name} »`);
        }
        await tx.stockItem.update({
          where: { id: item.id },
          data: { quantity: item.quantity - line.quantity },
        });
        await tx.stockMovement.create({
          data: {
            tenantId,
            stockItemId: item.id,
            type: StockMovementType.SALE_OUT,
            quantity: -line.quantity,
            reason: `Vente ${number}`,
            saleId: sale.id,
            createdById: userId,
          },
        });
      }
    }

    return sale;
  });
}

/** Annule une vente et réapprovisionne le stock le cas échéant. */
export async function cancelSale(tenantId: string, saleId: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findFirst({ where: { id: saleId, tenantId }, include: { items: true } });
    if (!sale) throw notFound('Vente introuvable');
    if (sale.status === SaleStatus.CANCELLED) throw conflict('Vente déjà annulée');

    const wasStockMoved =
      sale.type === SaleType.SALE &&
      [SaleStatus.CONFIRMED, SaleStatus.PARTIALLY_PAID, SaleStatus.PAID].includes(
        sale.status as SaleStatus,
      );

    if (wasStockMoved) {
      for (const line of sale.items) {
        const item = await tx.stockItem.findFirst({
          where: { productId: line.productId, branchId: sale.branchId, tenantId },
        });
        if (item) {
          await tx.stockItem.update({
            where: { id: item.id },
            data: { quantity: item.quantity + line.quantity },
          });
          await tx.stockMovement.create({
            data: {
              tenantId,
              stockItemId: item.id,
              type: StockMovementType.RETURN_IN,
              quantity: line.quantity,
              reason: `Annulation ${sale.number}`,
              saleId: sale.id,
              createdById: userId,
            },
          });
        }
      }
    }

    return tx.sale.update({ where: { id: sale.id }, data: { status: SaleStatus.CANCELLED } });
  });
}

/** Convertit un devis en vente : re-vérifie et décrémente le stock. */
export async function convertQuote(tenantId: string, saleId: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const quote = await tx.sale.findFirst({
      where: { id: saleId, tenantId },
      include: { items: true },
    });
    if (!quote) throw notFound('Devis introuvable');
    if (quote.type !== SaleType.QUOTE) throw conflict("Cette vente n'est pas un devis");

    for (const line of quote.items) {
      const item = await tx.stockItem.findFirst({
        where: { productId: line.productId, branchId: quote.branchId, tenantId },
      });
      if (!item || item.quantity < line.quantity) {
        throw badRequest('Stock insuffisant pour convertir ce devis');
      }
      await tx.stockItem.update({
        where: { id: item.id },
        data: { quantity: item.quantity - line.quantity },
      });
      await tx.stockMovement.create({
        data: {
          tenantId,
          stockItemId: item.id,
          type: StockMovementType.SALE_OUT,
          quantity: -line.quantity,
          reason: `Conversion devis ${quote.number}`,
          saleId: quote.id,
          createdById: userId,
        },
      });
    }

    const number = await nextNumber(tx, tenantId, SaleType.SALE);
    const paidInit = Math.min(Number(quote.insuranceAmount), Number(quote.totalAmount));
    const status = paidInit >= Number(quote.totalAmount) ? SaleStatus.PAID : SaleStatus.CONFIRMED;

    return tx.sale.update({
      where: { id: quote.id },
      data: { type: SaleType.SALE, number, status, paidAmount: paidInit },
    });
  });
}

/**
 * Ajoute un paiement à une vente : crée le Payment, lance le fournisseur
 * (simulation ou CinetPay), et règle immédiatement si encaissement direct.
 */
export async function addPayment(
  tenantId: string,
  userId: string,
  saleId: string,
  data: { method: PaymentMethod; amount: number; customerPhone?: string },
) {
  const sale = await prisma.sale.findFirst({
    where: { id: saleId, tenantId },
    include: { customer: true },
  });
  if (!sale) throw notFound('Vente introuvable');
  if (sale.status === SaleStatus.CANCELLED) throw conflict('Vente annulée');

  const payment = await prisma.payment.create({
    data: {
      tenantId,
      saleId,
      method: data.method,
      amount: data.amount,
      currency: sale.currency,
      status: PaymentStatus.PENDING,
    },
  });

  const provider = await resolveProvider(tenantId);
  const customerName = sale.customer
    ? `${sale.customer.firstName} ${sale.customer.lastName}`
    : 'Client comptant';

  const result = await provider.initiatePayment({
    paymentId: payment.id,
    amount: data.amount,
    currency: sale.currency,
    method: data.method,
    customerName,
    customerPhone: data.customerPhone,
    saleNumber: sale.number,
  });

  await prisma.payment.update({
    where: { id: payment.id },
    data: { provider: provider.name, providerRef: result.providerRef, status: result.status },
  });

  // Encaissement immédiat (cash/carte/simulation non-mobile) → règlement direct.
  const isMobile = MOBILE_MONEY_METHODS.includes(data.method);
  if (result.status === PaymentStatus.SUCCESS && !isMobile) {
    await settlePayment(payment.id, PaymentStatus.SUCCESS, result.raw);
  }

  return {
    paymentId: payment.id,
    status: result.status,
    providerRef: result.providerRef,
    instruction: result.instruction,
    redirectUrl: result.redirectUrl,
  };
}
