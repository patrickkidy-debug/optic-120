import { StockMovementType } from '@oculo/shared-types';
import { prisma } from '../../lib/prisma.js';
import { badRequest, notFound } from '../../lib/http-error.js';

export interface AdjustStockInput {
  productId: string;
  branchId: string;
  delta: number;
  reason?: string;
  type?: StockMovementType;
  minAlert?: number;
}

/**
 * Ajuste le stock d'un produit dans une succursale de façon atomique :
 * crée le StockItem si absent, applique le delta, enregistre le mouvement.
 * tenantId est passé explicitement (les extensions Prisma ne s'appliquent pas
 * dans une transaction interactive).
 */
export async function adjustStock(tenantId: string, input: AdjustStockInput, userId: string) {
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findFirst({ where: { id: input.productId, tenantId } });
    if (!product) throw notFound('Produit introuvable');
    const branch = await tx.branch.findFirst({ where: { id: input.branchId, tenantId } });
    if (!branch) throw notFound('Succursale introuvable');

    let item = await tx.stockItem.findFirst({
      where: { productId: input.productId, branchId: input.branchId, tenantId },
    });
    if (!item) {
      item = await tx.stockItem.create({
        data: {
          tenantId,
          productId: input.productId,
          branchId: input.branchId,
          quantity: 0,
          minAlert: input.minAlert ?? 0,
        },
      });
    }

    const newQty = item.quantity + input.delta;
    if (newQty < 0) throw badRequest('Stock insuffisant pour cet ajustement');

    item = await tx.stockItem.update({
      where: { id: item.id },
      data: {
        quantity: newQty,
        ...(input.minAlert !== undefined ? { minAlert: input.minAlert } : {}),
      },
    });

    await tx.stockMovement.create({
      data: {
        tenantId,
        stockItemId: item.id,
        type: input.type ?? StockMovementType.ADJUSTMENT,
        quantity: input.delta,
        reason: input.reason,
        createdById: userId,
      },
    });

    return item;
  });
}

/** Liste l'état du stock pour une succursale (tous les produits actifs). */
export async function getStockForBranch(tenantId: string, branchId: string, lowStockOnly: boolean) {
  const products = await prisma.product.findMany({
    where: { tenantId, isActive: true },
    include: { stockItems: { where: { branchId } } },
    orderBy: { name: 'asc' },
  });

  const rows = products.map((p) => {
    const item = p.stockItems[0];
    return {
      productId: p.id,
      sku: p.sku,
      name: p.name,
      brand: p.brand,
      category: p.category,
      sellPrice: Number(p.sellPrice),
      stockItemId: item?.id ?? null,
      quantity: item?.quantity ?? 0,
      minAlert: item?.minAlert ?? 0,
      low: item ? item.quantity <= item.minAlert : false,
    };
  });

  return lowStockOnly ? rows.filter((r) => r.low && r.stockItemId) : rows;
}

export async function getMovements(tenantId: string, productId: string, branchId: string) {
  const item = await prisma.stockItem.findFirst({ where: { tenantId, productId, branchId } });
  if (!item) return [];
  return prisma.stockMovement.findMany({
    where: { tenantId, stockItemId: item.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}

/** Nombre de références sous le seuil d'alerte (badge de navigation). */
export async function getLowStockCount(tenantId: string, branchId?: string): Promise<number> {
  const items = await prisma.stockItem.findMany({
    where: { tenantId, ...(branchId ? { branchId } : {}) },
    select: { quantity: true, minAlert: true },
  });
  return items.filter((i) => i.quantity <= i.minAlert).length;
}
