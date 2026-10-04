import type { TenantPrisma } from '../../lib/prisma-tenant.js';
import { getOpticalSettings } from '../../lib/optical-settings.js';

/**
 * Annuaire clients (page Clients) : liste paginée enrichie de ce qu'un opticien
 * cherche d'un coup d'œil — dernière visite, dernier achat, état de
 * l'ordonnance, total dépensé, client actif ou à relancer — et les quatre
 * compteurs du haut de page.
 *
 * Tout est dérivé des données réelles (ventes, ordonnances, commandes de
 * verres, réparations) ; aucun champ n'est ajouté au schéma. Les agrégats sont
 * calculés en quelques requêtes groupées, puis filtrés et paginés en mémoire :
 * les filtres portent sur des valeurs calculées (dernière visite, actif…) que
 * la base ne sait pas filtrer directement. Un fichier de plusieurs milliers de
 * clients reste léger (quelques colonnes par client).
 */

export const DIRECTORY_SEGMENTS = [
  'new',
  'active',
  'inactive',
  'withRx',
  'withoutRx',
  'withPurchase',
  'withoutPurchase',
  'followUp',
] as const;
export type DirectorySegment = (typeof DIRECTORY_SEGMENTS)[number];
export const DIRECTORY_VISITS = ['today', '7d', '30d', '3m', 'over6m'] as const;
export type DirectoryVisit = (typeof DIRECTORY_VISITS)[number];
export type DirectorySort = 'recent' | 'visit' | 'name' | 'spent';

export interface DirectoryQuery {
  scope: object;
  search?: string;
  segments: DirectorySegment[];
  visit?: DirectoryVisit;
  sort: DirectorySort;
  page: number;
  pageSize: number;
}

const DAY = 86_400_000;

/** Identifiant court affiché et recherchable (« CL-3F9A1C »). */
export function customerCode(id: string): string {
  return `CL-${id.replace(/-/g, '').slice(0, 6).toUpperCase()}`;
}

function searchWhere(raw?: string) {
  const s = raw?.trim();
  if (!s) return {};
  const ci = 'insensitive' as const;
  const or: object[] = [
    { firstName: { contains: s, mode: ci } },
    { lastName: { contains: s, mode: ci } },
    { email: { contains: s, mode: ci } },
    { phone: { contains: s } },
  ];
  // Numéro saisi avec ou sans espaces, avec ou sans indicatif.
  const digits = s.replace(/\D/g, '');
  if (digits.length >= 4 && digits !== s) or.push({ phone: { contains: digits } });
  // Nom complet, dans un ordre ou dans l'autre : chaque mot doit figurer
  // dans le prénom ou le nom.
  const words = s.split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    or.push({
      AND: words.map((w) => ({ OR: [{ firstName: { contains: w, mode: ci } }, { lastName: { contains: w, mode: ci } }] })),
    });
  }
  // Identifiant patient « CL-3F9A1C » (ou ses premiers caractères).
  const code = s.replace(/^#?(cl-?)?/i, '').toLowerCase();
  if (/^[0-9a-f]{4,8}$/.test(code)) or.push({ id: { startsWith: code } });
  return { OR: or };
}

export async function getDirectory(db: TenantPrisma, tenantId: string, q: DirectoryQuery) {
  const now = Date.now();
  const settings = await getOpticalSettings(tenantId);
  const MONTH = 30 * DAY;
  const rxCutoff = now - settings.prescriptionReminderMonths * MONTH;
  const saleCutoff = now - settings.purchaseReminderMonths * MONTH;
  // « Actif » : une visite (achat, devis, ordonnance, commande, SAV) dans la
  // même fenêtre que celle qui déclenche la relance de réachat.
  const activeCutoff = saleCutoff;
  const d = new Date();
  const monthStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);

  const [all, matched, sales, quotes, rx, lens, repairs] = await Promise.all([
    db.customer.findMany({ where: q.scope, select: { id: true, createdAt: true, firstName: true, lastName: true } }),
    q.search?.trim()
      ? db.customer.findMany({ where: { AND: [q.scope, searchWhere(q.search)] }, select: { id: true } })
      : Promise.resolve(null),
    db.sale.groupBy({
      by: ['customerId'],
      where: { customerId: { not: null }, type: 'SALE', status: { not: 'CANCELLED' } },
      _max: { createdAt: true },
      _sum: { totalAmount: true },
      _count: { _all: true },
    }),
    db.sale.groupBy({ by: ['customerId'], where: { customerId: { not: null }, type: 'QUOTE' }, _max: { createdAt: true } }),
    db.opticalPrescription.groupBy({ by: ['customerId'], _max: { date: true, expiresAt: true } }),
    db.lensOrder.groupBy({ by: ['customerId'], where: { customerId: { not: null } }, _max: { createdAt: true } }),
    db.repair.groupBy({ by: ['customerId'], where: { customerId: { not: null } }, _max: { createdAt: true } }),
  ]);

  const ms = (v: Date | null | undefined) => (v ? v.getTime() : 0);
  const saleBy = new Map(sales.map((g) => [g.customerId as string, g]));
  const quoteBy = new Map(quotes.map((g) => [g.customerId as string, ms(g._max.createdAt)]));
  const rxBy = new Map(rx.map((g) => [g.customerId, g._max]));
  const lensBy = new Map(lens.map((g) => [g.customerId as string, ms(g._max.createdAt)]));
  const repairBy = new Map(repairs.map((g) => [g.customerId as string, ms(g._max.createdAt)]));

  const rows = all.map((c) => {
    const s = saleBy.get(c.id);
    const lastSaleAt = ms(s?._max.createdAt);
    const r = rxBy.get(c.id);
    const lastRxAt = ms(r?.date);
    const lastVisit = Math.max(lastSaleAt, quoteBy.get(c.id) ?? 0, lastRxAt, lensBy.get(c.id) ?? 0, repairBy.get(c.id) ?? 0);
    const rxStatus: 'none' | 'valid' | 'expired' = !r
      ? 'none'
      : r.expiresAt && r.expiresAt.getTime() < now
        ? 'expired'
        : 'valid';
    return {
      id: c.id,
      createdAt: c.createdAt.getTime(),
      name: `${c.lastName} ${c.firstName}`.toLowerCase(),
      lastVisit,
      lastSaleAt,
      lastRxAt,
      rxStatus,
      totalSpent: Number(s?._sum.totalAmount ?? 0),
      salesCount: s?._count._all ?? 0,
      isNew: c.createdAt.getTime() >= monthStart,
      active: lastVisit >= activeCutoff,
      followUp: (lastRxAt > 0 && lastRxAt < rxCutoff) || (lastSaleAt > 0 && lastSaleAt < saleCutoff),
    };
  });

  const stats = {
    total: rows.length,
    newThisMonth: rows.filter((r) => r.isNew).length,
    active: rows.filter((r) => r.active).length,
    followUp: rows.filter((r) => r.followUp).length,
  };

  const matchedSet = matched ? new Set(matched.map((m) => m.id)) : null;
  const test: Record<DirectorySegment, (r: (typeof rows)[number]) => boolean> = {
    new: (r) => r.isNew,
    active: (r) => r.active,
    inactive: (r) => !r.active,
    withRx: (r) => r.rxStatus !== 'none',
    withoutRx: (r) => r.rxStatus === 'none',
    withPurchase: (r) => r.salesCount > 0,
    withoutPurchase: (r) => r.salesCount === 0,
    followUp: (r) => r.followUp,
  };
  const startOfToday = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const visitTest: Record<DirectoryVisit, (v: number) => boolean> = {
    today: (v) => v >= startOfToday,
    '7d': (v) => v >= now - 7 * DAY,
    '30d': (v) => v >= now - 30 * DAY,
    '3m': (v) => v >= now - 91 * DAY,
    over6m: (v) => v > 0 && v < now - 182 * DAY,
  };

  let list = rows.filter(
    (r) =>
      (!matchedSet || matchedSet.has(r.id)) &&
      q.segments.every((seg) => test[seg](r)) &&
      (!q.visit || visitTest[q.visit](r.lastVisit)),
  );
  const cmp: Record<DirectorySort, (a: (typeof rows)[number], b: (typeof rows)[number]) => number> = {
    recent: (a, b) => b.createdAt - a.createdAt,
    visit: (a, b) => b.lastVisit - a.lastVisit || b.createdAt - a.createdAt,
    name: (a, b) => a.name.localeCompare(b.name, 'fr'),
    spent: (a, b) => b.totalSpent - a.totalSpent,
  };
  list = list.sort(cmp[q.sort]);
  const total = list.length;
  const slice = list.slice((q.page - 1) * q.pageSize, q.page * q.pageSize);
  const ids = slice.map((r) => r.id);

  const [details, lastSales] = ids.length
    ? await Promise.all([
        db.customer.findMany({ where: { id: { in: ids } } }),
        db.sale.findMany({
          where: { customerId: { in: ids }, type: 'SALE', status: { not: 'CANCELLED' } },
          orderBy: { createdAt: 'desc' },
          distinct: ['customerId'],
          select: {
            customerId: true,
            id: true,
            number: true,
            totalAmount: true,
            createdAt: true,
            items: { take: 2, select: { product: { select: { name: true } } } },
          },
        }),
      ])
    : [[], []];
  const detailBy = new Map(details.map((c) => [c.id, c]));
  const lastSaleBy = new Map(lastSales.map((s) => [s.customerId as string, s]));
  const iso = (v: number) => (v ? new Date(v).toISOString() : null);

  const customers = slice.flatMap((r) => {
    const c = detailBy.get(r.id);
    if (!c) return [];
    const ls = lastSaleBy.get(r.id);
    return [
      {
        ...c,
        code: customerCode(c.id),
        lastVisitAt: iso(r.lastVisit),
        lastPrescriptionAt: iso(r.lastRxAt),
        rxStatus: r.rxStatus,
        totalSpent: r.totalSpent,
        salesCount: r.salesCount,
        active: r.active,
        followUp: r.followUp,
        isNew: r.isNew,
        lastPurchase: ls
          ? {
              id: ls.id,
              number: ls.number,
              total: Number(ls.totalAmount),
              at: ls.createdAt.toISOString(),
              label: ls.items.map((i) => i.product.name).join(', ') || null,
            }
          : null,
      },
    ];
  });

  return { customers, total, page: q.page, pageSize: q.pageSize, stats };
}

/** Synthèse du dossier patient (vue d'ensemble), sur tout l'historique. */
export async function getCustomerSummary(db: TenantPrisma, customerId: string) {
  const [spent, salesCount, quotesCount, rxCount, lensCount, repairCount] = await Promise.all([
    db.sale.aggregate({
      where: { customerId, type: 'SALE', status: { not: 'CANCELLED' } },
      _sum: { totalAmount: true, paidAmount: true },
    }),
    db.sale.count({ where: { customerId, type: 'SALE', status: { not: 'CANCELLED' } } }),
    db.sale.count({ where: { customerId, type: 'QUOTE' } }),
    db.opticalPrescription.count({ where: { customerId } }),
    db.lensOrder.count({ where: { customerId } }),
    db.repair.count({ where: { customerId } }),
  ]);
  const total = Number(spent._sum.totalAmount ?? 0);
  return {
    totalSpent: total,
    totalPaid: Number(spent._sum.paidAmount ?? 0),
    balance: Math.max(0, total - Number(spent._sum.paidAmount ?? 0)),
    salesCount,
    quotesCount,
    prescriptionsCount: rxCount,
    lensOrdersCount: lensCount,
    repairsCount: repairCount,
    // Une « visite » = un passage ayant laissé une trace : vente, devis,
    // ordonnance, commande de verres ou SAV.
    visits: salesCount + quotesCount + rxCount + lensCount + repairCount,
  };
}

