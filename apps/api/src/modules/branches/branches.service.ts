import { Prisma } from '@prisma/client';
import { SaleStatus, SaleType, type BranchPeriod } from '@oculo/shared-types';
import { prisma } from '../../lib/prisma.js';

/**
 * Magasins & succursales : synthèse par magasin, fiche détaillée et contrôles
 * avant archivage. Toutes les requêtes reçoivent la liste des magasins
 * autorisés (`scope`) calculée par la route : un responsable ne voit jamais
 * les chiffres d'un magasin qui ne lui est pas affecté.
 */

const PAID_LIKE = [SaleStatus.PAID, SaleStatus.PARTIALLY_PAID, SaleStatus.CONFIRMED];

/** null = tous les magasins de l'établissement ; sinon la liste autorisée. */
export type BranchScope = string[] | null;

export function periodStart(period: BranchPeriod): Date {
  const d = new Date();
  if (period === '30d') return new Date(d.getTime() - 30 * 24 * 3600 * 1000);
  d.setHours(0, 0, 0, 0);
  if (period === 'month') d.setDate(1);
  return d;
}

const scopeWhere = (tenantId: string, scope: BranchScope) =>
  scope ? { tenantId, id: { in: scope.length ? scope : ['__none__'] } } : { tenantId };

/** Champs utiles au quotidien : leur absence met le magasin « en configuration ». */
export function missingFields(b: { address: string | null; phone: string | null; city: string | null; managerId: string | null }) {
  const out: ('address' | 'phone' | 'city' | 'manager')[] = [];
  if (!b.city?.trim()) out.push('city');
  if (!b.address?.trim()) out.push('address');
  if (!b.phone?.trim()) out.push('phone');
  if (!b.managerId) out.push('manager');
  return out;
}

export function branchStatus(b: { isActive: boolean; archivedAt: Date | null }, missing: string[]) {
  if (b.archivedAt) return 'ARCHIVED' as const;
  if (!b.isActive) return 'INACTIVE' as const;
  return missing.length ? ('SETUP' as const) : ('ACTIVE' as const);
}

const branchSelect = {
  id: true,
  name: true,
  code: true,
  city: true,
  countryCode: true,
  address: true,
  phone: true,
  whatsapp: true,
  email: true,
  logoUrl: true,
  isActive: true,
  archivedAt: true,
  createdAt: true,
  openingHours: true,
  managerId: true,
  manager: { select: { id: true, firstName: true, lastName: true, isActive: true } },
} satisfies Prisma.BranchSelect;

/** Références sous le seuil d'alerte, par magasin (mêmes règles que le tableau de bord). */
async function lowStockByBranch(tenantId: string, ids: string[]) {
  if (!ids.length) return new Map<string, number>();
  const rows = await prisma.$queryRaw<{ branchId: string; n: bigint }[]>`
    SELECT si."branchId", COUNT(*)::bigint AS n
    FROM "StockItem" si JOIN "Product" p ON p."id" = si."productId"
    WHERE si."tenantId" = ${tenantId} AND si."branchId" IN (${Prisma.join(ids)})
      AND si."quantity" <= si."minAlert" AND p."trackStock" = true
      AND p."category"::text NOT IN ('VERRE', 'SERVICE')
    GROUP BY si."branchId"`;
  return new Map(rows.map((r) => [r.branchId, Number(r.n)]));
}

/** CA de la période par magasin : encaissements datés au paiement + part assurance (comme le tableau de bord). */
async function revenueByBranch(tenantId: string, ids: string[], from: Date) {
  if (!ids.length) return { revenue: new Map<string, number>(), sales: new Map<string, number>(), collected: new Map<string, number>() };
  const [paid, sales] = await Promise.all([
    prisma.$queryRaw<{ branchId: string; total: Prisma.Decimal | null }[]>`
      SELECT s."branchId", SUM(p."amount") AS total
      FROM "Payment" p JOIN "Sale" s ON s."id" = p."saleId"
      WHERE p."tenantId" = ${tenantId} AND p."status"::text = 'SUCCESS' AND p."createdAt" >= ${from}
        AND s."type"::text = 'SALE' AND s."status"::text IN ('PAID', 'PARTIALLY_PAID', 'CONFIRMED')
        AND s."branchId" IN (${Prisma.join(ids)})
      GROUP BY s."branchId"`,
    prisma.sale.groupBy({
      by: ['branchId'],
      where: { tenantId, branchId: { in: ids }, type: SaleType.SALE, status: { in: PAID_LIKE }, createdAt: { gte: from } },
      _sum: { insuranceAmount: true },
      _count: { _all: true },
    }),
  ]);
  const collected = new Map(paid.map((r) => [r.branchId, Number(r.total ?? 0)]));
  const revenue = new Map<string, number>();
  const count = new Map<string, number>();
  for (const id of ids) revenue.set(id, collected.get(id) ?? 0);
  for (const g of sales) {
    revenue.set(g.branchId, (revenue.get(g.branchId) ?? 0) + Number(g._sum.insuranceAmount ?? 0));
    count.set(g.branchId, g._count._all);
  }
  return { revenue, sales: count, collected };
}

/**
 * Liste enrichie des magasins + totaux. `revenue` : l'utilisateur peut-il voir
 * le chiffre d'affaires (sinon aucune donnée financière n'est calculée ni renvoyée).
 */
export async function getOverview(
  tenantId: string,
  scope: BranchScope,
  opts: { period: BranchPeriod; revenue: boolean; includeArchived: boolean },
) {
  const from = periodStart(opts.period);
  const [tenant, branches] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { mainBranchId: true, currency: true } }),
    prisma.branch.findMany({
      where: { ...scopeWhere(tenantId, scope), ...(opts.includeArchived ? {} : { archivedAt: null }) },
      orderBy: { createdAt: 'asc' },
      select: branchSelect,
    }),
  ]);
  const ids = branches.map((b) => b.id);
  const [staff, low, pendingIn, pendingOut, money] = await Promise.all([
    prisma.userBranch.groupBy({ by: ['branchId'], where: { branchId: { in: ids }, user: { tenantId, isActive: true } }, _count: { _all: true } }),
    lowStockByBranch(tenantId, ids),
    prisma.stockTransfer.groupBy({ by: ['toBranchId'], where: { tenantId, status: 'PENDING', toBranchId: { in: ids } }, _count: { _all: true } }),
    prisma.stockTransfer.groupBy({ by: ['fromBranchId'], where: { tenantId, status: 'PENDING', fromBranchId: { in: ids } }, _count: { _all: true } }),
    opts.revenue ? revenueByBranch(tenantId, ids, from) : Promise.resolve(null),
  ]);

  const rows = branches.map((b) => {
    const missing = missingFields(b);
    return {
      ...b,
      isMain: tenant?.mainBranchId === b.id,
      status: branchStatus(b, missing),
      missing,
      staffCount: staff.find((s) => s.branchId === b.id)?._count._all ?? 0,
      lowStock: low.get(b.id) ?? 0,
      pendingIn: pendingIn.find((p) => p.toBranchId === b.id)?._count._all ?? 0,
      pendingOut: pendingOut.find((p) => p.fromBranchId === b.id)?._count._all ?? 0,
      revenue: money ? money.revenue.get(b.id) ?? 0 : null,
      salesCount: money ? money.sales.get(b.id) ?? 0 : null,
    };
  });

  // Collaborateurs : comptes actifs distincts ayant accès aux magasins listés.
  const activeIds = rows.filter((r) => !r.archivedAt).map((r) => r.id);
  const collaborators = scope
    ? await prisma.user.count({ where: { tenantId, isActive: true, branches: { some: { branchId: { in: activeIds.length ? activeIds : ['__none__'] } } } } })
    : await prisma.user.count({ where: { tenantId, isActive: true } });

  return {
    period: opts.period,
    from,
    currency: tenant?.currency ?? 'XOF',
    mainBranchId: tenant?.mainBranchId ?? null,
    branches: rows,
    totals: {
      branches: rows.filter((r) => !r.archivedAt).length,
      active: rows.filter((r) => !r.archivedAt && r.isActive).length,
      archived: rows.filter((r) => r.archivedAt).length,
      collaborators,
      revenue: money ? rows.reduce((s, r) => s + (r.revenue ?? 0), 0) : null,
    },
  };
}

/** Fiche détaillée d'un magasin (la route a déjà vérifié l'accès). */
export async function getBranchDetail(
  tenantId: string,
  id: string,
  opts: { period: BranchPeriod; revenue: boolean; sales: boolean; team: boolean; stock: boolean },
) {
  const from = periodStart(opts.period);
  const [tenant, b] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { mainBranchId: true, currency: true, countryCode: true } }),
    prisma.branch.findFirst({ where: { id, tenantId }, select: branchSelect }),
  ]);
  if (!b) return null;
  const missing = missingFields(b);

  const [money, receivables, openQuotes, register, team, allBranchUsers, low, transfers, inTransitIn, stockUnits] = await Promise.all([
    opts.revenue ? revenueByBranch(tenantId, [id], from) : null,
    opts.sales
      ? prisma.sale.findMany({
          where: { tenantId, branchId: id, type: SaleType.SALE, status: { in: PAID_LIKE } },
          select: { totalAmount: true, paidAmount: true },
        })
      : null,
    opts.sales ? prisma.sale.count({ where: { tenantId, branchId: id, type: SaleType.QUOTE, status: { notIn: [SaleStatus.CANCELLED] } } }) : null,
    prisma.cashRegister.findFirst({ where: { tenantId, branchId: id, closedAt: null }, select: { id: true, openedAt: true } }),
    opts.team
      ? prisma.user.findMany({
          where: { tenantId, branches: { some: { branchId: id } } },
          orderBy: [{ isActive: 'desc' }, { firstName: 'asc' }],
          select: { id: true, firstName: true, lastName: true, email: true, isActive: true, lastLoginAt: true, role: { select: { name: true, allBranches: true } }, _count: { select: { branches: true } } },
        })
      : null,
    opts.team
      ? prisma.user.findMany({
          where: { tenantId, isActive: true, role: { allBranches: true } },
          orderBy: { firstName: 'asc' },
          select: { id: true, firstName: true, lastName: true, role: { select: { name: true } } },
        })
      : null,
    opts.stock
      ? prisma.$queryRaw<{ id: string; name: string; sku: string; quantity: number; minAlert: number }[]>`
          SELECT p."id", p."name", p."sku", si."quantity", si."minAlert"
          FROM "StockItem" si JOIN "Product" p ON p."id" = si."productId"
          WHERE si."tenantId" = ${tenantId} AND si."branchId" = ${id}
            AND si."quantity" <= si."minAlert" AND p."trackStock" = true
            AND p."category"::text NOT IN ('VERRE', 'SERVICE')
          ORDER BY si."quantity" ASC, p."name" ASC LIMIT 8`
      : null,
    opts.stock
      ? prisma.stockTransfer.findMany({
          where: { tenantId, OR: [{ fromBranchId: id }, { toBranchId: id }] },
          orderBy: { createdAt: 'desc' },
          take: 8,
          select: {
            id: true, number: true, status: true, createdAt: true, confirmedAt: true, fromBranchId: true, toBranchId: true,
            fromBranch: { select: { name: true } }, toBranch: { select: { name: true } },
            createdBy: { select: { firstName: true, lastName: true } }, confirmedBy: { select: { firstName: true, lastName: true } },
            items: { select: { quantity: true } },
          },
        })
      : null,
    opts.stock
      ? prisma.stockTransferItem.aggregate({ where: { transfer: { tenantId, status: 'PENDING', toBranchId: id } }, _sum: { quantity: true } })
      : null,
    opts.stock
      ? prisma.$queryRaw<{ units: bigint | null; refs: bigint }[]>`
          SELECT SUM(si."quantity")::bigint AS units, COUNT(*) FILTER (WHERE si."quantity" > 0)::bigint AS refs
          FROM "StockItem" si JOIN "Product" p ON p."id" = si."productId"
          WHERE si."tenantId" = ${tenantId} AND si."branchId" = ${id} AND p."trackStock" = true
            AND p."category"::text NOT IN ('VERRE', 'SERVICE')`
      : null,
  ]);

  const lowCount = opts.stock ? (await lowStockByBranch(tenantId, [id])).get(id) ?? 0 : null;
  const receivable = receivables
    ? receivables.reduce((s, r) => s + Math.max(0, Number(r.totalAmount) - Number(r.paidAmount)), 0)
    : null;

  return {
    branch: {
      ...b,
      isMain: tenant?.mainBranchId === b.id,
      status: branchStatus(b, missing),
      missing,
    },
    currency: tenant?.currency ?? 'XOF',
    tenantCountryCode: tenant?.countryCode ?? null,
    period: opts.period,
    from,
    activity: {
      revenue: money ? money.revenue.get(id) ?? 0 : null,
      collected: money ? money.collected.get(id) ?? 0 : null,
      salesCount: money ? money.sales.get(id) ?? 0 : null,
      receivables: receivable,
      openQuotes,
      registerOpenSince: register?.openedAt ?? null,
    },
    team: team?.map((u) => ({ ...u, branchCount: u._count.branches, _count: undefined })) ?? null,
    allBranchUsers,
    stock: opts.stock
      ? {
          lowStockCount: lowCount,
          lowStock: low,
          units: Number(stockUnits?.[0]?.units ?? 0),
          refs: Number(stockUnits?.[0]?.refs ?? 0),
          inTransitIn: inTransitIn?._sum.quantity ?? 0,
          transfers: transfers?.map((t) => ({ ...t, units: t.items.reduce((s, i) => s + i.quantity, 0), items: undefined })) ?? [],
        }
      : null,
  };
}

/**
 * Contrôles avant archivage. Bloquants : opérations en cours qui deviendraient
 * inaccessibles ou incohérentes. Avertissements : conséquences à connaître.
 */
export async function archiveCheck(tenantId: string, id: string) {
  const [tenant, b, activeOthers, transfers, register, stock, quotes, soleUsers, dues] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { mainBranchId: true } }),
    prisma.branch.findFirst({ where: { id, tenantId }, select: { id: true, archivedAt: true, name: true } }),
    prisma.branch.count({ where: { tenantId, id: { not: id }, archivedAt: null, isActive: true } }),
    prisma.stockTransfer.count({ where: { tenantId, status: 'PENDING', OR: [{ fromBranchId: id }, { toBranchId: id }] } }),
    prisma.cashRegister.count({ where: { tenantId, branchId: id, closedAt: null } }),
    prisma.$queryRaw<{ units: bigint | null }[]>`
      SELECT SUM(si."quantity")::bigint AS units
      FROM "StockItem" si JOIN "Product" p ON p."id" = si."productId"
      WHERE si."tenantId" = ${tenantId} AND si."branchId" = ${id} AND si."quantity" > 0
        AND p."trackStock" = true AND p."category"::text NOT IN ('VERRE', 'SERVICE')`,
    prisma.sale.count({ where: { tenantId, branchId: id, type: SaleType.QUOTE, status: { notIn: [SaleStatus.CANCELLED] } } }),
    prisma.user.findMany({
      where: { tenantId, isActive: true, role: { allBranches: false }, branches: { some: { branchId: id }, every: { branchId: id } } },
      select: { firstName: true, lastName: true },
    }),
    prisma.sale.findMany({
      where: { tenantId, branchId: id, type: SaleType.SALE, status: { in: PAID_LIKE } },
      select: { totalAmount: true, paidAmount: true },
    }),
  ]);
  if (!b) return null;
  const blockers: { code: string; params?: Record<string, unknown> }[] = [];
  const warnings: { code: string; params?: Record<string, unknown> }[] = [];
  if (b.archivedAt) blockers.push({ code: 'alreadyArchived' });
  if (tenant?.mainBranchId === id) blockers.push({ code: 'isMain' });
  if (activeOthers === 0) blockers.push({ code: 'lastActive' });
  if (transfers > 0) blockers.push({ code: 'pendingTransfers', params: { n: transfers } });
  if (register > 0) blockers.push({ code: 'openRegister' });
  const units = Number(stock[0]?.units ?? 0);
  if (units > 0) blockers.push({ code: 'stockLeft', params: { n: units } });
  if (quotes > 0) warnings.push({ code: 'openQuotes', params: { n: quotes } });
  const due = dues.filter((s) => Number(s.totalAmount) - Number(s.paidAmount) > 0).length;
  if (due > 0) warnings.push({ code: 'receivables', params: { n: due } });
  if (soleUsers.length) warnings.push({ code: 'soleUsers', params: { n: soleUsers.length, names: soleUsers.map((u) => `${u.firstName} ${u.lastName}`).join(', ') } });
  return { canArchive: blockers.length === 0, blockers, warnings };
}

/** Prochain code interne libre : MAG-001, MAG-002… */
export async function nextBranchCode(tenantId: string): Promise<string> {
  const rows = await prisma.branch.findMany({ where: { tenantId, code: { startsWith: 'MAG-' } }, select: { code: true } });
  const max = rows.reduce((m, r) => Math.max(m, Number(/^MAG-(\d+)$/.exec(r.code ?? '')?.[1] ?? 0)), 0);
  return `MAG-${String(max + 1).padStart(3, '0')}`;
}
