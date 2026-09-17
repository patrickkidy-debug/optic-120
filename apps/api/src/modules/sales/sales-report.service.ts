import { SaleType } from '@oculo/shared-types';
import type { TenantPrisma } from '../../lib/prisma-tenant.js';

/**
 * Module de reporting commercial : agrégats, série temporelle, répartition par
 * statut et lignes paginées, tous calculés à partir du MÊME filtre.
 *
 * Tout est agrégé côté serveur. L'ancienne version chargeait toutes les ventes
 * de la période puis résumait en mémoire : au-delà de quelques milliers de
 * ventes la page devenait lourde, et le tableau n'affichait que les 50
 * premières lignes alors que les indicateurs portaient sur le reste — deux
 * chiffres pour une même question.
 *
 * Vocabulaire, fixé ici une fois pour toutes (la page l'affiche tel quel) :
 *   revenue     — chiffre d'affaires : somme des totaux facturés
 *   collected   — encaissements : somme des montants réellement payés, part
 *                 assurance comprise puisqu'elle est déduite de ce que doit le
 *                 client dès la création de la vente
 *   outstanding — reste à encaisser : revenue - collected, jamais négatif
 *
 * Les ventes annulées sont exclues partout : elles ne sont ni du chiffre
 * d'affaires, ni une créance.
 */

export interface ReportFilter {
  from: Date;
  to: Date;
  branchId?: string;
  /** Statuts de règlement retenus ; vide = tous (hors annulées). */
  statuses?: string[];
  cashierId?: string;
  customerId?: string;
  /** Moyen de paiement réellement encaissé sur la vente. */
  method?: string;
  search?: string;
}

export interface ReportPaging {
  page: number;
  pageSize: number;
  sortBy: 'date' | 'total' | 'paid' | 'balance' | 'customer' | 'number';
  sortDir: 'asc' | 'desc';
}

const ACTIVE_STATUSES = ['CONFIRMED', 'PARTIALLY_PAID', 'PAID'] as const;

const n = (v: unknown): number => Number(v ?? 0);

/** Clause Prisma commune : le même filtre alimente KPI, graphique et tableau. */
export function reportWhere(f: ReportFilter): Record<string, unknown> {
  const statuses =
    f.statuses && f.statuses.length > 0
      ? f.statuses.filter((s) => (ACTIVE_STATUSES as readonly string[]).includes(s))
      : [...ACTIVE_STATUSES];

  const where: Record<string, unknown> = {
    type: SaleType.SALE,
    createdAt: { gte: f.from, lte: f.to },
    status: { in: statuses.length > 0 ? statuses : [...ACTIVE_STATUSES] },
  };
  if (f.branchId) where.branchId = f.branchId;
  if (f.cashierId) where.cashierId = f.cashierId;
  if (f.customerId) where.customerId = f.customerId;
  // Un moyen de paiement ne qualifie une vente que s'il a réellement abouti :
  // un paiement annulé ou échoué ne doit pas la faire ressortir.
  if (f.method) where.payments = { some: { method: f.method, status: 'SUCCESS' } };

  const search = f.search?.trim();
  if (search) {
    where.OR = [
      { number: { contains: search, mode: 'insensitive' } },
      { customer: { firstName: { contains: search, mode: 'insensitive' } } },
      { customer: { lastName: { contains: search, mode: 'insensitive' } } },
      { customer: { phone: { contains: search } } },
      { cashier: { firstName: { contains: search, mode: 'insensitive' } } },
      { cashier: { lastName: { contains: search, mode: 'insensitive' } } },
    ];
  }
  return where;
}

export interface ReportTotals {
  revenue: number;
  collected: number;
  outstanding: number;
  count: number;
  avgBasket: number;
  collectionRate: number;
  /** Nombre de ventes avec un solde restant — « X ventes concernées ». */
  unpaidCount: number;
}

/**
 * Agrégats monétaires d'une période. Deux requêtes seulement, quel que soit le
 * volume : une somme et un comptage des ventes à solde.
 */
export async function getTotals(db: TenantPrisma, f: ReportFilter): Promise<ReportTotals> {
  const where = reportWhere(f);
  const [agg, unpaidCount] = await Promise.all([
    db.sale.aggregate({ where, _sum: { totalAmount: true, paidAmount: true }, _count: true }),
    db.sale.count({ where: { ...where, status: { in: ['CONFIRMED', 'PARTIALLY_PAID'] } } }),
  ]);

  const revenue = n(agg._sum.totalAmount);
  const collected = n(agg._sum.paidAmount);
  const count = agg._count;
  return {
    revenue,
    collected,
    // Plancher à 0 : un encaissement supérieur au facturé relève d'une
    // incohérence à corriger, pas d'une créance négative à afficher.
    outstanding: Math.max(0, revenue - collected),
    count,
    avgBasket: count > 0 ? Math.round(revenue / count) : 0,
    collectionRate: revenue > 0 ? (collected / revenue) * 100 : 0,
    unpaidCount,
  };
}

/**
 * Période précédente de MÊME durée, contiguë à la période courante.
 * Bornes inclusives des deux côtés : une période du 1er au 30 dure 30 jours,
 * la précédente va donc du 2 du mois d'avant au 31, sans chevauchement ni trou.
 */
export function previousPeriod(from: Date, to: Date): { from: Date; to: Date } {
  const span = to.getTime() - from.getTime();
  return {
    from: new Date(from.getTime() - span - 1),
    to: new Date(from.getTime() - 1),
  };
}

export type Granularity = 'day' | 'week' | 'month';

/** Granularité lisible : ~30 points au plus, jamais un graphique illisible. */
export function pickGranularity(from: Date, to: Date): Granularity {
  const days = Math.ceil((to.getTime() - from.getTime()) / 86_400_000);
  if (days <= 31) return 'day';
  if (days <= 182) return 'week';
  return 'month';
}

export interface SeriesBucket {
  bucket: string;
  revenue: number;
  collected: number;
  count: number;
}

/**
 * Série temporelle. Le regroupement se fait en mémoire sur les seules colonnes
 * utiles (date, total, payé) plutôt qu'en SQL brut : `req.db` est l'instance
 * cloisonnée par tenant, et un `$queryRaw` contournerait ce cloisonnement.
 */
export async function getSeries(
  db: TenantPrisma,
  f: ReportFilter,
  granularity: Granularity,
): Promise<SeriesBucket[]> {
  const sales = await db.sale.findMany({
    where: reportWhere(f),
    select: { createdAt: true, totalAmount: true, paidAmount: true },
    orderBy: { createdAt: 'asc' },
  });

  const key = (d: Date): string => {
    const iso = d.toISOString();
    if (granularity === 'month') return iso.slice(0, 7);
    if (granularity === 'week') {
      // Lundi de la semaine ISO, pour que deux points voisins soient à 7 jours.
      const monday = new Date(d);
      const weekday = (monday.getUTCDay() + 6) % 7;
      monday.setUTCDate(monday.getUTCDate() - weekday);
      return monday.toISOString().slice(0, 10);
    }
    return iso.slice(0, 10);
  };

  const buckets = new Map<string, SeriesBucket>();
  for (const s of sales) {
    const k = key(s.createdAt);
    const b = buckets.get(k) ?? { bucket: k, revenue: 0, collected: 0, count: 0 };
    b.revenue += n(s.totalAmount);
    b.collected += n(s.paidAmount);
    b.count += 1;
    buckets.set(k, b);
  }
  return [...buckets.values()].sort((a, b) => a.bucket.localeCompare(b.bucket));
}

export interface StatusBucket {
  status: string;
  count: number;
  total: number;
  paid: number;
  balance: number;
}

/**
 * Répartition par statut de règlement. Ignore volontairement un éventuel filtre
 * de statut : masquer les autres tranches ferait d'un camembert « 100 % payées »
 * une réponse à une question que personne n'a posée.
 */
export async function getStatusBreakdown(db: TenantPrisma, f: ReportFilter): Promise<StatusBucket[]> {
  const where = reportWhere({ ...f, statuses: undefined });
  const groups = await db.sale.groupBy({
    by: ['status'],
    where,
    _count: { _all: true },
    _sum: { totalAmount: true, paidAmount: true },
  });

  return (ACTIVE_STATUSES as readonly string[]).map((status) => {
    const g = groups.find((x) => x.status === status);
    const total = n(g?._sum.totalAmount);
    const paid = n(g?._sum.paidAmount);
    return {
      status,
      count: g?._count._all ?? 0,
      total,
      paid,
      balance: Math.max(0, total - paid),
    };
  });
}

export interface ReportRow {
  id: string;
  number: string;
  date: Date;
  customer: string;
  customerPhone: string | null;
  branch: string;
  cashier: string;
  status: string;
  methods: string[];
  total: number;
  paid: number;
  balance: number;
}

const SORT_COLUMN: Record<ReportPaging['sortBy'], string> = {
  date: 'createdAt',
  total: 'totalAmount',
  paid: 'paidAmount',
  number: 'number',
  customer: 'number',
  balance: 'createdAt',
};

/**
 * Lignes paginées. `balance` et `customer` n'existent pas en base (l'un est
 * calculé, l'autre vit sur la relation) : ils sont triés sur la page chargée,
 * ce que la page indique plutôt que de laisser croire à un tri global.
 */
export async function getRows(
  db: TenantPrisma,
  f: ReportFilter,
  p: ReportPaging,
): Promise<{ rows: ReportRow[]; total: number }> {
  const where = reportWhere(f);
  const [sales, total] = await Promise.all([
    db.sale.findMany({
      where,
      orderBy: { [SORT_COLUMN[p.sortBy]]: p.sortDir },
      skip: (p.page - 1) * p.pageSize,
      take: p.pageSize,
      include: {
        customer: { select: { firstName: true, lastName: true, phone: true } },
        branch: { select: { name: true } },
        cashier: { select: { firstName: true, lastName: true } },
        payments: { where: { status: 'SUCCESS' }, select: { method: true } },
        insurer: { select: { name: true } },
      },
    }),
    db.sale.count({ where }),
  ]);

  const rows: ReportRow[] = sales.map((s) => {
    const totalAmount = n(s.totalAmount);
    const paid = n(s.paidAmount);
    const methods: string[] = [...new Set(s.payments.map((x) => String(x.method)))];
    // La prise en charge assurance n'est pas un Payment mais compte bien dans
    // l'encaissé : sans elle, une vente couverte afficherait « payée » sans
    // aucun moyen de paiement, ce qui se lit comme une anomalie.
    if (n(s.insuranceAmount) > 0) methods.unshift('INSURANCE');
    return {
      id: s.id,
      number: s.number,
      date: s.createdAt,
      customer: s.customer ? `${s.customer.firstName} ${s.customer.lastName}` : '',
      customerPhone: s.customer?.phone ?? null,
      branch: s.branch.name,
      cashier: s.cashier ? `${s.cashier.firstName} ${s.cashier.lastName}` : '',
      status: s.status,
      methods,
      total: totalAmount,
      paid,
      balance: Math.max(0, totalAmount - paid),
    };
  });

  if (p.sortBy === 'balance' || p.sortBy === 'customer') {
    const dir = p.sortDir === 'asc' ? 1 : -1;
    rows.sort((a, b) =>
      p.sortBy === 'balance' ? (a.balance - b.balance) * dir : a.customer.localeCompare(b.customer) * dir,
    );
  }

  return { rows, total };
}

export interface PaymentRow {
  date: Date;
  saleNumber: string;
  customer: string;
  method: string;
  amount: number;
}

/** Encaissements réels de la période, pour l'export « Paiements ». */
export async function getPayments(db: TenantPrisma, f: ReportFilter): Promise<PaymentRow[]> {
  const payments = await db.payment.findMany({
    where: {
      status: 'SUCCESS',
      createdAt: { gte: f.from, lte: f.to },
      sale: reportWhere({ ...f, from: new Date(0), to: new Date(8.64e15) }) as never,
    },
    orderBy: { createdAt: 'asc' },
    include: {
      sale: {
        select: {
          number: true,
          customer: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  return payments.map((p) => ({
    date: p.createdAt,
    saleNumber: p.sale.number,
    customer: p.sale.customer ? `${p.sale.customer.firstName} ${p.sale.customer.lastName}` : '',
    method: p.method,
    amount: n(p.amount),
  }));
}
