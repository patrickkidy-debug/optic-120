import { StockMovementType, isMadeToOrderCategory } from '@oculo/shared-types';
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

/**
 * Récupère (ou crée) la ligne de stock d'un produit dans une succursale.
 * Mutualisé par la réception, le transfert et l'inventaire.
 */
async function ensureStockItem(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  tenantId: string,
  productId: string,
  branchId: string,
) {
  const existing = await tx.stockItem.findFirst({ where: { productId, branchId, tenantId } });
  if (existing) return existing;
  return tx.stockItem.create({
    data: { tenantId, productId, branchId, quantity: 0, minAlert: 0 },
  });
}

/**
 * Réception d'une commande fournisseur : entrée de stock tracée (PURCHASE_IN)
 * avec le fournisseur et le coût d'achat unitaire. Met à jour le prix d'achat
 * du produit quand un coût est fourni, pour suivre les marges.
 */
export async function receiveStock(
  tenantId: string,
  userId: string,
  input: {
    branchId: string;
    supplierId?: string;
    reference?: string;
    items: { productId: string; quantity: number; unitCost?: number }[];
  },
) {
  return prisma.$transaction(async (tx) => {
    const branch = await tx.branch.findFirst({ where: { id: input.branchId, tenantId } });
    if (!branch) throw notFound('Succursale introuvable');
    if (input.supplierId) {
      const supplier = await tx.supplier.findFirst({ where: { id: input.supplierId, tenantId } });
      if (!supplier) throw badRequest('Fournisseur invalide');
    }

    const reason = input.reference
      ? `Réception fournisseur — ${input.reference}`
      : 'Réception fournisseur';
    let received = 0;

    for (const line of input.items) {
      const product = await tx.product.findFirst({ where: { id: line.productId, tenantId } });
      if (!product) throw badRequest(`Produit introuvable : ${line.productId}`);

      const item = await ensureStockItem(tx, tenantId, line.productId, input.branchId);
      await tx.stockItem.update({
        where: { id: item.id },
        data: { quantity: item.quantity + line.quantity },
      });
      await tx.stockMovement.create({
        data: {
          tenantId,
          stockItemId: item.id,
          type: StockMovementType.PURCHASE_IN,
          quantity: line.quantity,
          reason,
          supplierId: input.supplierId ?? null,
          unitCost: line.unitCost ?? null,
          createdById: userId,
        },
      });
      // Dernier prix d'achat connu : sert au calcul de marge.
      if (line.unitCost != null && line.unitCost >= 0) {
        await tx.product.update({
          where: { id: line.productId },
          data: { buyPrice: line.unitCost },
        });
      }
      received += line.quantity;
    }

    return { lines: input.items.length, received };
  });
}

/**
 * Transfert de stock entre deux magasins : sortie de la source et entrée dans
 * la destination, tracées des deux côtés. Rejeté si la source est insuffisante.
 */
/**
 * Demande de transfert de stock entre deux magasins : le stock est déduit de la
 * source immédiatement (en transit) et un transfert PENDING est créé. La
 * destination doit confirmer la réception pour créditer son stock.
 */
export async function transferStock(
  tenantId: string,
  userId: string,
  input: {
    fromBranchId: string;
    toBranchId: string;
    reason?: string;
    items: { productId: string; quantity: number }[];
  },
) {
  return prisma.$transaction(async (tx) => {
    const [from, to] = await Promise.all([
      tx.branch.findFirst({ where: { id: input.fromBranchId, tenantId } }),
      tx.branch.findFirst({ where: { id: input.toBranchId, tenantId } }),
    ]);
    if (!from) throw notFound('Magasin source introuvable');
    if (!to) throw notFound('Magasin destination introuvable');

    const number = `TRF-${Date.now().toString(36).toUpperCase()}`;

    for (const line of input.items) {
      const product = await tx.product.findFirst({ where: { id: line.productId, tenantId } });
      if (!product) throw badRequest(`Produit introuvable : ${line.productId}`);

      const source = await tx.stockItem.findFirst({
        where: { productId: line.productId, branchId: input.fromBranchId, tenantId },
      });
      if (!source || source.quantity < line.quantity) {
        throw badRequest(`Stock insuffisant pour « ${product.name} » dans ${from.name}`);
      }

      await tx.stockItem.update({
        where: { id: source.id },
        data: { quantity: source.quantity - line.quantity },
      });
      await tx.stockMovement.create({
        data: {
          tenantId,
          stockItemId: source.id,
          type: StockMovementType.TRANSFER,
          quantity: -line.quantity,
          reason: `Transfert vers ${to.name} (${number})${input.reason ? ` — ${input.reason}` : ''}`,
          createdById: userId,
        },
      });
    }

    const transfer = await tx.stockTransfer.create({
      data: {
        tenantId,
        number,
        fromBranchId: input.fromBranchId,
        toBranchId: input.toBranchId,
        reason: input.reason,
        createdById: userId,
        status: 'PENDING',
        items: {
          create: input.items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
          })),
        },
      },
      include: {
        fromBranch: true,
        toBranch: true,
        items: { include: { product: true } },
      },
    });

    return transfer;
  });
}

/**
 * Confirmation de réception d'un transfert par le magasin destinataire.
 * Les articles sont crédités au stock de la destination et le statut passe à CONFIRMED.
 */
export async function confirmTransfer(tenantId: string, userId: string, transferId: string) {
  return prisma.$transaction(async (tx) => {
    const transfer = await tx.stockTransfer.findFirst({
      where: { id: transferId, tenantId },
      include: { fromBranch: true, toBranch: true, items: { include: { product: true } } },
    });
    if (!transfer) throw notFound('Transfert introuvable');
    if (transfer.status !== 'PENDING') throw badRequest('Ce transfert n\'est plus en attente');

    for (const item of transfer.items) {
      const target = await ensureStockItem(tx, tenantId, item.productId, transfer.toBranchId);
      await tx.stockItem.update({
        where: { id: target.id },
        data: { quantity: target.quantity + item.quantity },
      });
      await tx.stockMovement.create({
        data: {
          tenantId,
          stockItemId: target.id,
          type: StockMovementType.TRANSFER,
          quantity: item.quantity,
          reason: `Réception transfert depuis ${transfer.fromBranch.name} (${transfer.number})`,
          createdById: userId,
        },
      });
    }

    return tx.stockTransfer.update({
      where: { id: transferId },
      data: {
        status: 'CONFIRMED',
        confirmedById: userId,
        confirmedAt: new Date(),
      },
      include: {
        fromBranch: true,
        toBranch: true,
        items: { include: { product: true } },
      },
    });
  });
}

/**
 * Annulation d'un transfert en attente : restitue les articles au magasin source.
 */
export async function cancelTransfer(tenantId: string, userId: string, transferId: string) {
  return prisma.$transaction(async (tx) => {
    const transfer = await tx.stockTransfer.findFirst({
      where: { id: transferId, tenantId },
      include: { fromBranch: true, toBranch: true, items: { include: { product: true } } },
    });
    if (!transfer) throw notFound('Transfert introuvable');
    if (transfer.status !== 'PENDING') throw badRequest('Seul un transfert en attente peut être annulé');

    for (const item of transfer.items) {
      const source = await ensureStockItem(tx, tenantId, item.productId, transfer.fromBranchId);
      await tx.stockItem.update({
        where: { id: source.id },
        data: { quantity: source.quantity + item.quantity },
      });
      await tx.stockMovement.create({
        data: {
          tenantId,
          stockItemId: source.id,
          type: StockMovementType.TRANSFER,
          quantity: item.quantity,
          reason: `Annulation du transfert vers ${transfer.toBranch.name} (${transfer.number})`,
          createdById: userId,
        },
      });
    }

    return tx.stockTransfer.update({
      where: { id: transferId },
      data: { status: 'CANCELLED' },
      include: {
        fromBranch: true,
        toBranch: true,
        items: { include: { product: true } },
      },
    });
  });
}

/**
 * Liste les transferts de stock d'un établissement (filtrables par magasin et direction).
 */
export async function listTransfers(
  tenantId: string,
  options: { branchId?: string; direction?: 'incoming' | 'outgoing' | 'all'; status?: 'PENDING' | 'CONFIRMED' | 'CANCELLED' } = {},
) {
  const where: Record<string, unknown> = { tenantId };
  if (options.status) where.status = options.status;

  if (options.branchId) {
    if (options.direction === 'incoming') {
      where.toBranchId = options.branchId;
    } else if (options.direction === 'outgoing') {
      where.fromBranchId = options.branchId;
    } else {
      where.OR = [{ fromBranchId: options.branchId }, { toBranchId: options.branchId }];
    }
  }

  return prisma.stockTransfer.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      fromBranch: true,
      toBranch: true,
      createdBy: { select: { firstName: true, lastName: true } },
      confirmedBy: { select: { firstName: true, lastName: true } },
      items: { include: { product: true } },
    },
  });
}

/**
 * Inventaire physique : aligne le stock théorique sur les quantités comptées.
 * Seuls les écarts donnent lieu à un mouvement d'ajustement, tracé avec la
 * quantité théorique et la quantité comptée.
 */
export async function applyStockCount(
  tenantId: string,
  userId: string,
  input: {
    branchId: string;
    note?: string;
    items: { productId: string; countedQuantity: number }[];
  },
) {
  return prisma.$transaction(async (tx) => {
    const branch = await tx.branch.findFirst({ where: { id: input.branchId, tenantId } });
    if (!branch) throw notFound('Succursale introuvable');

    const stamp = new Date().toLocaleDateString('fr-FR');
    let adjusted = 0;
    let net = 0;

    for (const line of input.items) {
      const product = await tx.product.findFirst({ where: { id: line.productId, tenantId } });
      if (!product) continue;

      const item = await ensureStockItem(tx, tenantId, line.productId, input.branchId);
      const delta = line.countedQuantity - item.quantity;
      if (delta === 0) continue;

      await tx.stockItem.update({
        where: { id: item.id },
        data: { quantity: line.countedQuantity },
      });
      await tx.stockMovement.create({
        data: {
          tenantId,
          stockItemId: item.id,
          type: StockMovementType.ADJUSTMENT,
          quantity: delta,
          reason:
            `Inventaire du ${stamp} — théorique ${item.quantity}, compté ${line.countedQuantity}` +
            (input.note ? ` (${input.note})` : ''),
          createdById: userId,
        },
      });
      adjusted += 1;
      net += delta;
    }

    return { counted: input.items.length, adjusted, net };
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
    // Verres (fabriqués sur commande) : stock illimité, jamais en alerte.
    const unlimited = isMadeToOrderCategory(p.category);
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
      low: unlimited ? false : item ? item.quantity <= item.minAlert : false,
      unlimited,
      createdAt: p.createdAt,
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
    select: { quantity: true, minAlert: true, product: { select: { category: true } } },
  });
  // Les verres (fabriqués sur commande) ne comptent jamais comme stock bas.
  return items.filter(
    (i) => !isMadeToOrderCategory(i.product.category) && i.quantity <= i.minAlert,
  ).length;
}
