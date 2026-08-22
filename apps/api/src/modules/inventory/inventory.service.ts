import {
  InventoryCountStatus,
  StockMovementType,
  INVENTORY_REASON_LABELS,
  isMadeToOrderCategory,
  type InventoryAdjustmentReason,
  type ProductCategory,
} from '@oculo/shared-types';
import { prisma } from '../../lib/prisma.js';
import { badRequest, notFound } from '../../lib/http-error.js';

export interface CreateInventoryCountInput {
  branchId: string;
  scopeCategory?: ProductCategory;
  scopeBrand?: string;
  scopeLocation?: string;
  note?: string;
}

/**
 * Démarre une session d'inventaire : snapshot du stock de la succursale (filtré
 * par le périmètre choisi si fourni), une ligne par article, quantité théorique
 * figée dès maintenant (jamais recalculée pendant le comptage). Une seule
 * session en cours (DRAFT) autorisée par succursale à la fois.
 */
export async function createInventoryCount(
  tenantId: string,
  userId: string,
  input: CreateInventoryCountInput,
) {
  const branch = await prisma.branch.findFirst({ where: { id: input.branchId, tenantId } });
  if (!branch) throw notFound('Succursale introuvable');

  const existing = await prisma.inventoryCount.findFirst({
    where: { tenantId, branchId: input.branchId, status: InventoryCountStatus.DRAFT },
  });
  if (existing) throw badRequest('Un inventaire est déjà en cours pour cette succursale');

  const products = await prisma.product.findMany({
    where: {
      tenantId,
      isActive: true,
      ...(input.scopeCategory ? { category: input.scopeCategory } : {}),
      ...(input.scopeBrand ? { brand: input.scopeBrand } : {}),
    },
    include: { stockItems: { where: { branchId: input.branchId } } },
  });

  // Lunettes fabriquées sur commande : stock illimité, jamais comptées (même règle que l'ancien module).
  let scoped = products.filter((p) => !isMadeToOrderCategory(p.category));
  if (input.scopeLocation) {
    scoped = scoped.filter((p) => p.stockItems[0]?.location === input.scopeLocation);
  }
  if (scoped.length === 0) throw badRequest('Aucun article à compter pour ce périmètre');

  const count = await prisma.inventoryCount.create({
    data: {
      tenantId,
      branchId: input.branchId,
      scopeCategory: input.scopeCategory,
      scopeBrand: input.scopeBrand,
      scopeLocation: input.scopeLocation,
      note: input.note || undefined,
      startedById: userId,
    },
  });

  // Un seul createMany (pas de boucle) : indispensable pour rester rapide sur un
  // catalogue de plusieurs milliers d'articles.
  await prisma.inventoryCountLine.createMany({
    data: scoped.map((p) => ({
      tenantId,
      inventoryCountId: count.id,
      productId: p.id,
      theoreticalQty: p.stockItems[0]?.quantity ?? 0,
      locationSnapshot: p.stockItems[0]?.location ?? null,
    })),
  });

  return count;
}

/** Session DRAFT en cours pour la succursale, ou null (permet de proposer reprise vs démarrage). */
export async function getActiveInventoryCount(tenantId: string, branchId: string) {
  return prisma.inventoryCount.findFirst({
    where: { tenantId, branchId, status: InventoryCountStatus.DRAFT },
    orderBy: { createdAt: 'desc' },
  });
}

export interface InventoryLineFilter {
  status?: 'all' | 'to_count' | 'counted' | 'conforme' | 'ecart' | 'manquant' | 'surplus';
  search?: string;
  page?: number;
  pageSize?: number;
}

const STATUS_WHERE: Record<NonNullable<InventoryLineFilter['status']>, Record<string, unknown>> = {
  all: {},
  to_count: { countedQty: null },
  counted: { countedQty: { not: null } },
  conforme: { deltaQty: 0 },
  ecart: { deltaQty: { not: 0 } },
  manquant: { deltaQty: { lt: 0 } },
  surplus: { deltaQty: { gt: 0 } },
};

/**
 * Détail d'une session : résumé calculé par agrégats SQL (jamais en chargeant
 * toutes les lignes en mémoire — indispensable à 5000+ articles) + page de
 * lignes filtrées/recherchées côté serveur.
 */
export async function getInventoryCount(
  tenantId: string,
  id: string,
  filter: InventoryLineFilter = {},
) {
  const count = await prisma.inventoryCount.findFirst({
    where: { id, tenantId },
    include: {
      branch: { select: { id: true, name: true } },
      startedBy: { select: { firstName: true, lastName: true } },
      completedBy: { select: { firstName: true, lastName: true } },
    },
  });
  if (!count) throw notFound('Inventaire introuvable');

  const page = Math.max(1, filter.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, filter.pageSize ?? 50));
  const statusWhere = STATUS_WHERE[filter.status ?? 'all'];
  const search = filter.search?.trim();

  const where = {
    inventoryCountId: id,
    tenantId,
    ...statusWhere,
    ...(search
      ? {
          product: {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { sku: { contains: search, mode: 'insensitive' as const } },
            ],
          },
        }
      : {}),
  };

  const [total, toCount, counted, conforme, ecart, manquant, surplus, netValueAgg, lines] =
    await Promise.all([
      prisma.inventoryCountLine.count({ where: { inventoryCountId: id, tenantId } }),
      prisma.inventoryCountLine.count({ where: { inventoryCountId: id, tenantId, countedQty: null } }),
      prisma.inventoryCountLine.count({
        where: { inventoryCountId: id, tenantId, countedQty: { not: null } },
      }),
      prisma.inventoryCountLine.count({ where: { inventoryCountId: id, tenantId, deltaQty: 0 } }),
      prisma.inventoryCountLine.count({
        where: { inventoryCountId: id, tenantId, deltaQty: { not: 0 } },
      }),
      prisma.inventoryCountLine.count({
        where: { inventoryCountId: id, tenantId, deltaQty: { lt: 0 } },
      }),
      prisma.inventoryCountLine.count({
        where: { inventoryCountId: id, tenantId, deltaQty: { gt: 0 } },
      }),
      prisma.inventoryCountLine.aggregate({
        where: { inventoryCountId: id, tenantId },
        _sum: { deltaValue: true },
      }),
      prisma.inventoryCountLine.findMany({
        where,
        include: { product: { select: { id: true, name: true, sku: true, brand: true, buyPrice: true } } },
        orderBy: { product: { name: 'asc' } },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

  return {
    count,
    summary: {
      total,
      toCount,
      counted,
      conforme,
      ecart,
      manquant,
      surplus,
      netValue: netValueAgg._sum.deltaValue != null ? Number(netValueAgg._sum.deltaValue) : 0,
    },
    lines,
    page,
    pageSize,
  };
}

/** Sauvegarde progressive : chaque saisie est immédiatement persistée (pas de brouillon local). */
export async function updateCountedQty(
  tenantId: string,
  userId: string,
  lineId: string,
  countedQty: number,
) {
  const line = await prisma.inventoryCountLine.findFirst({
    where: { id: lineId, tenantId },
    include: { inventoryCount: true, product: { select: { buyPrice: true } } },
  });
  if (!line) throw notFound('Ligne introuvable');
  if (line.inventoryCount.status !== InventoryCountStatus.DRAFT || line.inventoryCount.validatedAt) {
    throw badRequest('Ce comptage est verrouillé');
  }

  const deltaQty = countedQty - line.theoreticalQty;
  const deltaValue = deltaQty * Number(line.product.buyPrice);

  return prisma.inventoryCountLine.update({
    where: { id: lineId },
    data: { countedQty, countedById: userId, countedAt: new Date(), deltaQty, deltaValue },
  });
}

/**
 * Scan d'un code-barres/SKU : incrémente la quantité comptée de 1, en partant
 * de 0 si l'article n'a jamais été touché — reproduit le comportement d'une
 * douchette de caisse (chaque scan = +1 exemplaire physiquement vu). Les
 * douchettes USB/Bluetooth du commerce émulent un clavier + Entrée : un simple
 * champ texte suffit côté frontend, aucune lib de lecture caméra nécessaire.
 */
export async function scanProduct(
  tenantId: string,
  userId: string,
  inventoryCountId: string,
  code: string,
) {
  return prisma.$transaction(async (tx) => {
    const count = await tx.inventoryCount.findFirst({ where: { id: inventoryCountId, tenantId } });
    if (!count) throw notFound('Inventaire introuvable');
    if (count.status !== InventoryCountStatus.DRAFT || count.validatedAt) {
      throw badRequest('Ce comptage est verrouillé');
    }

    const line = await tx.inventoryCountLine.findFirst({
      where: { inventoryCountId, tenantId, product: { sku: code } },
      include: { product: { select: { id: true, name: true, sku: true, brand: true, buyPrice: true } } },
    });
    if (!line) throw notFound("Aucun article de cet inventaire ne correspond à ce code");

    const nextCounted = (line.countedQty ?? 0) + 1;
    const deltaQty = nextCounted - line.theoreticalQty;
    const deltaValue = deltaQty * Number(line.product.buyPrice);

    return tx.inventoryCountLine.update({
      where: { id: line.id },
      data: { countedQty: nextCounted, countedById: userId, countedAt: new Date(), deltaQty, deltaValue },
      include: { product: { select: { id: true, name: true, sku: true, brand: true } } },
    });
  });
}

/** Termine la phase de comptage : verrouille la saisie avant la revue des écarts. */
export async function validateInventoryCount(tenantId: string, id: string) {
  const count = await prisma.inventoryCount.findFirst({ where: { id, tenantId } });
  if (!count) throw notFound('Inventaire introuvable');
  if (count.status !== InventoryCountStatus.DRAFT) throw badRequest("Cet inventaire n'est plus en cours");
  if (count.validatedAt) return count; // idempotent
  return prisma.inventoryCount.update({ where: { id }, data: { validatedAt: new Date() } });
}

export interface RegularizeLine {
  lineId: string;
  reason: InventoryAdjustmentReason;
  note?: string;
}

/**
 * Régularise UNIQUEMENT les lignes sélectionnées (jamais toutes les lignes en
 * écart automatiquement) : aligne StockItem.quantity, trace un StockMovement
 * ADJUSTMENT par ligne. `lines` vide = "terminer sans rien régulariser".
 * Exige que le comptage ait déjà été validé (ordre des phases imposé).
 */
export async function regularizeInventoryCount(
  tenantId: string,
  userId: string,
  id: string,
  lines: RegularizeLine[],
) {
  return prisma.$transaction(
    async (tx) => {
      const count = await tx.inventoryCount.findFirst({ where: { id, tenantId } });
      if (!count) throw notFound('Inventaire introuvable');
      if (count.status !== InventoryCountStatus.DRAFT) throw badRequest("Cet inventaire n'est plus en cours");
      if (!count.validatedAt) throw badRequest('Terminez le comptage avant de régulariser');

      let net = 0;
      let regularized = 0;

      for (const sel of lines) {
        const line = await tx.inventoryCountLine.findFirst({
          where: { id: sel.lineId, inventoryCountId: id, tenantId },
        });
        if (!line || line.regularized || line.countedQty == null) continue;
        if (line.deltaQty == null || line.deltaQty === 0) continue;

        const stockItem = await tx.stockItem.upsert({
          where: { productId_branchId: { productId: line.productId, branchId: count.branchId } },
          create: {
            tenantId,
            productId: line.productId,
            branchId: count.branchId,
            quantity: line.countedQty,
          },
          update: { quantity: line.countedQty },
        });

        const stamp = count.createdAt.toLocaleDateString('fr-FR');
        const movement = await tx.stockMovement.create({
          data: {
            tenantId,
            stockItemId: stockItem.id,
            type: StockMovementType.ADJUSTMENT,
            quantity: line.deltaQty,
            reason:
              `Inventaire du ${stamp} — ${INVENTORY_REASON_LABELS[sel.reason]}` +
              (sel.note ? ` (${sel.note})` : ''),
            createdById: userId,
          },
        });

        await tx.inventoryCountLine.update({
          where: { id: line.id },
          data: {
            regularized: true,
            movementId: movement.id,
            reason: sel.reason,
            reasonNote: sel.note || null,
          },
        });

        net += line.deltaQty;
        regularized += 1;
      }

      const updated = await tx.inventoryCount.update({
        where: { id },
        data: { status: InventoryCountStatus.COMPLETED, completedById: userId, completedAt: new Date() },
      });

      return { inventoryCount: updated, regularized, net };
    },
    { timeout: 20000 },
  );
}

/** Abandonne une session en cours sans régulariser (ex. inventaire lancé par erreur). */
export async function cancelInventoryCount(tenantId: string, id: string) {
  const count = await prisma.inventoryCount.findFirst({ where: { id, tenantId } });
  if (!count) throw notFound('Inventaire introuvable');
  if (count.status !== InventoryCountStatus.DRAFT) throw badRequest("Cet inventaire n'est plus en cours");
  return prisma.inventoryCount.update({
    where: { id },
    data: { status: InventoryCountStatus.CANCELLED },
  });
}

/** Historique paginé des sessions (toutes succursales confondues, filtrable). */
export async function listInventoryCounts(
  tenantId: string,
  filter: { branchId?: string; page?: number; pageSize?: number } = {},
) {
  const page = Math.max(1, filter.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filter.pageSize ?? 20));
  const where = { tenantId, ...(filter.branchId ? { branchId: filter.branchId } : {}) };

  const [total, rows] = await Promise.all([
    prisma.inventoryCount.count({ where }),
    prisma.inventoryCount.findMany({
      where,
      include: {
        branch: { select: { id: true, name: true } },
        startedBy: { select: { firstName: true, lastName: true } },
        completedBy: { select: { firstName: true, lastName: true } },
        _count: { select: { lines: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  // Écarts + valeur nette par session (agrégats groupés, pas une requête par ligne).
  const ids = rows.map((r) => r.id);
  const [gapCounts, netSums] = ids.length
    ? await Promise.all([
        prisma.inventoryCountLine.groupBy({
          by: ['inventoryCountId'],
          where: { inventoryCountId: { in: ids }, deltaQty: { not: 0 } },
          _count: { _all: true },
        }),
        prisma.inventoryCountLine.groupBy({
          by: ['inventoryCountId'],
          where: { inventoryCountId: { in: ids } },
          _sum: { deltaValue: true },
        }),
      ])
    : [[], []];
  const gapById = new Map(gapCounts.map((g) => [g.inventoryCountId, g._count._all]));
  const netById = new Map(netSums.map((s) => [s.inventoryCountId, Number(s._sum.deltaValue ?? 0)]));

  const items = rows.map((r) => ({
    ...r,
    gapCount: gapById.get(r.id) ?? 0,
    netValue: netById.get(r.id) ?? 0,
  }));

  return { items, total, page, pageSize };
}
