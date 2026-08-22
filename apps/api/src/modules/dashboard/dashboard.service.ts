import { PaymentStatus, SaleStatus, SaleType, StockMovementType, isMadeToOrderCategory } from '@oculo/shared-types';
import { prisma } from '../../lib/prisma.js';

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function startOfMonth(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

const PAID_LIKE = [SaleStatus.PAID, SaleStatus.PARTIALLY_PAID, SaleStatus.CONFIRMED];

/**
 * COMPTABILITÉ DE CAISSE : le chiffre d'affaires est rattaché au jour où
 * l'argent est RÉELLEMENT encaissé, pas au jour de la vente. Un client qui
 * règle son reliquat deux semaines plus tard fait monter le CA du jour de ce
 * second encaissement — et les journées déjà closes ne changent plus jamais
 * rétroactivement.
 *
 * La source de vérité est donc la table Payment (un Payment SUCCESS par
 * encaissement, horodaté), et NON Sale.paidAmount (qui est un cumul rattaché
 * à la date de la vente). La part prise en charge par une assurance fait
 * exception : elle est injectée dans Sale.paidAmount à la vente sans créer de
 * Payment, elle reste donc rattachée à la date de la vente.
 */
function paymentWhere(tenantId: string, branchId: string | undefined, from: Date, to?: Date) {
  return {
    tenantId,
    status: PaymentStatus.SUCCESS,
    createdAt: to ? { gte: from, lt: to } : { gte: from },
    sale: {
      type: SaleType.SALE,
      status: { in: PAID_LIKE },
      ...(branchId ? { branchId } : {}),
    },
  };
}

export async function getDashboard(tenantId: string, branchId?: string) {
  const branchFilter = branchId ? { branchId } : {};
  const saleBase = { tenantId, type: SaleType.SALE, ...branchFilter };

  const [
    todayAgg,
    monthAgg,
    todayPaidAgg,
    monthPaidAgg,
    todayCount,
    customersCount,
    lowStockItems,
    recentSales,
    weekSales,
    paymentGroups,
    monthCount,
    newCustomersMonth,
    topProductGroups,
    prevWeekAgg,
    activeCustomersRaw,
    activeCustomersPrevRaw,
  ] = await Promise.all([
    // Part assurance : acquise a la vente (aucun Payment n'est cree pour elle).
    prisma.sale.aggregate({
      where: { ...saleBase, status: { in: PAID_LIKE }, createdAt: { gte: startOfToday() } },
      _sum: { insuranceAmount: true },
    }),
    prisma.sale.aggregate({
      where: { ...saleBase, status: { in: PAID_LIKE }, createdAt: { gte: startOfMonth() } },
      _sum: { insuranceAmount: true },
    }),
    // Encaisse reel du jour / du mois, date au jour ou l'argent est rentre.
    prisma.payment.aggregate({
      where: paymentWhere(tenantId, branchId, startOfToday()),
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: paymentWhere(tenantId, branchId, startOfMonth()),
      _sum: { amount: true },
    }),
    prisma.sale.count({ where: { ...saleBase, status: { in: PAID_LIKE }, createdAt: { gte: startOfToday() } } }),
    prisma.customer.count({ where: { tenantId } }),
    prisma.stockItem.findMany({
      where: { tenantId, ...branchFilter },
      select: { quantity: true, minAlert: true, product: { select: { category: true } } },
    }),
    prisma.sale.findMany({
      where: { tenantId, ...branchFilter },
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: { customer: true, branch: true },
    }),
    prisma.payment.findMany({
      where: paymentWhere(tenantId, branchId, new Date(Date.now() - 6 * 24 * 3600 * 1000)),
      select: { createdAt: true, amount: true },
    }),
    prisma.payment.groupBy({
      by: ['method'],
      where: { tenantId, status: 'SUCCESS', createdAt: { gte: startOfMonth() } },
      _sum: { amount: true },
    }),
    // Nombre de ventes du mois (pour le panier moyen).
    prisma.sale.count({ where: { ...saleBase, status: { in: PAID_LIKE }, createdAt: { gte: startOfMonth() } } }),
    // Nouveaux clients ce mois.
    prisma.customer.count({ where: { tenantId, createdAt: { gte: startOfMonth() } } }),
    // Top 5 produits du mois (par chiffre d'affaires).
    prisma.saleItem.groupBy({
      by: ['productId'],
      where: {
        sale: { ...saleBase, status: { in: PAID_LIKE }, createdAt: { gte: startOfMonth() } },
      },
      _sum: { lineTotal: true, quantity: true },
      orderBy: { _sum: { lineTotal: 'desc' } },
      take: 5,
    }),
    // CA de la semaine précédente (pour la tendance 7 jours).
    prisma.payment.aggregate({
      where: paymentWhere(
        tenantId,
        branchId,
        new Date(Date.now() - 13 * 24 * 3600 * 1000),
        new Date(Date.now() - 6 * 24 * 3600 * 1000),
      ),
      _sum: { amount: true },
    }),
    // Clients actifs : au moins un achat sur les 30 derniers jours (et les 30
    // précédents, pour calculer une évolution).
    prisma.sale.findMany({
      where: {
        ...saleBase,
        status: { in: PAID_LIKE },
        customerId: { not: null },
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 3600 * 1000) },
      },
      distinct: ['customerId'],
      select: { customerId: true },
    }),
    prisma.sale.findMany({
      where: {
        ...saleBase,
        status: { in: PAID_LIKE },
        customerId: { not: null },
        createdAt: {
          gte: new Date(Date.now() - 60 * 24 * 3600 * 1000),
          lt: new Date(Date.now() - 30 * 24 * 3600 * 1000),
        },
      },
      distinct: ['customerId'],
      select: { customerId: true },
    }),
  ]);

  // Série des 7 derniers jours (CA encaissé + nombre de ventes, pour le mini
  // graphique et le panier moyen quotidien côté client).
  const days: { date: string; revenue: number; sales: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    days.push({ date: d.toISOString().slice(0, 10), revenue: 0, sales: 0 });
  }
  const indexByDate = new Map(days.map((d, idx) => [d.date, idx]));
  for (const p of weekSales) {
    const key = p.createdAt.toISOString().slice(0, 10);
    const idx = indexByDate.get(key);
    if (idx !== undefined) {
      days[idx].revenue += Number(p.amount);
      days[idx].sales += 1;
    }
  }

  const activeCustomers = activeCustomersRaw.length;
  const activeCustomersPrev = activeCustomersPrevRaw.length;

  const weekRevenue = days.reduce((sum, d) => sum + d.revenue, 0);
  const prevWeekRevenue = Number(prevWeekAgg._sum.amount ?? 0);
  // CA = encaisse reel (date au jour du paiement) + part assurance (acquise a la vente).
  const todayCollectedValue = Number(todayPaidAgg._sum.amount ?? 0);
  const monthCollectedValue = Number(monthPaidAgg._sum.amount ?? 0);
  const monthRevenueValue = monthCollectedValue + Number(monthAgg._sum.insuranceAmount ?? 0);
  const avgBasket = monthCount > 0 ? Math.round(monthRevenueValue / monthCount) : 0;

  const topProductNames = topProductGroups.length
    ? await prisma.product.findMany({
        where: { tenantId, id: { in: topProductGroups.map((g) => g.productId) } },
        select: { id: true, name: true },
      })
    : [];
  const topProducts = topProductGroups.map((g) => ({
    name: topProductNames.find((p) => p.id === g.productId)?.name ?? '—',
    revenue: Number(g._sum.lineTotal ?? 0),
    quantity: Number(g._sum.quantity ?? 0),
  }));

  // Répartition du CA : part prise en charge par les assurances (rattachée à
  // la date de la vente) vs encaissé auprès des clients (daté au paiement).
  const todayInsurance = Number(todayAgg._sum.insuranceAmount ?? 0);
  const monthInsurance = Number(monthAgg._sum.insuranceAmount ?? 0);

  return {
    todayRevenue: todayCollectedValue + todayInsurance,
    monthRevenue: monthRevenueValue,
    todayInsurance,
    monthInsurance,
    todayCollected: todayCollectedValue,
    monthCollected: monthCollectedValue,
    todaySalesCount: todayCount,
    customersCount,
    // Verres (fabriqués sur commande) exclus des alertes de stock bas.
    lowStockCount: lowStockItems.filter(
      (i) => !isMadeToOrderCategory(i.product.category) && i.quantity <= i.minAlert,
    ).length,
    recentSales: recentSales.map((s) => ({
      id: s.id,
      number: s.number,
      total: Number(s.totalAmount),
      paid: Number(s.paidAmount),
      status: s.status,
      type: s.type,
      customer: s.customer ? `${s.customer.firstName} ${s.customer.lastName}` : null,
      branch: s.branch.name,
      createdAt: s.createdAt,
    })),
    revenueByDay: days,
    paymentBreakdown: paymentGroups.map((g) => ({
      method: g.method,
      total: Number(g._sum.amount ?? 0),
    })),
    monthSalesCount: monthCount,
    avgBasket,
    newCustomersMonth,
    weekRevenue,
    prevWeekRevenue,
    topProducts,
    activeCustomers,
    activeCustomersPrev,
  };
}

export type DashboardRange = '7d' | '30d' | '3m' | '12m';
type Granularity = 'day' | 'week' | 'month';

function granularityForRange(range: DashboardRange): Granularity {
  if (range === '7d' || range === '30d') return 'day';
  if (range === '3m') return 'week';
  return 'month';
}
function rangeStart(range: DashboardRange): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (range === '7d') d.setDate(d.getDate() - 6);
  else if (range === '30d') d.setDate(d.getDate() - 29);
  else if (range === '3m') d.setDate(d.getDate() - 7 * 12);
  else d.setMonth(d.getMonth() - 11);
  return d;
}
function bucketKey(date: Date, granularity: Granularity): string {
  if (granularity === 'day') return date.toISOString().slice(0, 10);
  if (granularity === 'week') {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const dayIdx = (d.getDay() + 6) % 7; // 0 = lundi
    d.setDate(d.getDate() - dayIdx);
    return d.toISOString().slice(0, 10);
  }
  return date.toISOString().slice(0, 7);
}
function buildBuckets(range: DashboardRange): string[] {
  const granularity = granularityForRange(range);
  const cursor = rangeStart(range);
  const now = new Date();
  const keys: string[] = [];
  while (cursor <= now) {
    const key = bucketKey(cursor, granularity);
    if (keys[keys.length - 1] !== key) keys.push(key);
    if (granularity === 'day') cursor.setDate(cursor.getDate() + 1);
    else if (granularity === 'week') cursor.setDate(cursor.getDate() + 7);
    else cursor.setMonth(cursor.getMonth() + 1);
  }
  return keys;
}

/**
 * Série multi-métrique (CA, ventes, encaissé, marge) pour le graphique
 * interactif du tableau de bord. Bucketing quotidien (7j/30j), hebdomadaire
 * (3 mois) ou mensuel (12 mois). La marge est approximée avec le prix
 * d'achat ACTUEL du produit : le SaleItem ne conserve pas de coût
 * historique, donc une variation de prix d'achat rétroactive légèrement
 * la marge des ventes passées.
 */
export async function getSeries(tenantId: string, branchId: string | undefined, range: DashboardRange) {
  const branchFilter = branchId ? { branchId } : {};
  const saleBase = { tenantId, type: SaleType.SALE, ...branchFilter };
  const granularity = granularityForRange(range);
  const since = rangeStart(range);

  const [payments, sales, items] = await Promise.all([
    // Encaissements reels, dates au jour ou l'argent est rentre.
    prisma.payment.findMany({
      where: paymentWhere(tenantId, branchId, since),
      select: { createdAt: true, amount: true },
    }),
    // Part assurance : rattachee a la date de la vente.
    prisma.sale.findMany({
      where: { ...saleBase, status: { in: PAID_LIKE }, createdAt: { gte: since } },
      select: { createdAt: true, insuranceAmount: true },
    }),
    prisma.saleItem.findMany({
      where: { sale: { ...saleBase, status: { in: PAID_LIKE }, createdAt: { gte: since } } },
      select: {
        quantity: true,
        lineTotal: true,
        sale: { select: { createdAt: true } },
        product: { select: { buyPrice: true } },
      },
    }),
  ]);

  const keys = buildBuckets(range);
  const byKey = new Map(
    keys.map((k) => [k, { date: k, revenue: 0, sales: 0, collected: 0, margin: 0 }]),
  );

  for (const p of payments) {
    const row = byKey.get(bucketKey(p.createdAt, granularity));
    if (!row) continue;
    const amount = Number(p.amount);
    row.revenue += amount;
    row.collected += amount;
    row.sales += 1;
  }
  for (const sale of sales) {
    const row = byKey.get(bucketKey(sale.createdAt, granularity));
    if (!row) continue;
    row.revenue += Number(sale.insuranceAmount ?? 0);
  }
  for (const it of items) {
    const row = byKey.get(bucketKey(it.sale.createdAt, granularity));
    if (!row) continue;
    row.margin += Number(it.lineTotal) - Number(it.product.buyPrice) * it.quantity;
  }

  return keys.map((k) => byKey.get(k)!);
}

/**
 * Fil d'activité du jour : ventes, paiements réussis, commandes de verres
 * créées, consultations et réceptions de stock, fusionnés et triés du plus
 * récent au plus ancien.
 */
export async function getActivity(tenantId: string, branchId?: string) {
  const branchFilter = branchId ? { branchId } : {};
  const start = startOfToday();

  const [sales, payments, lensOrders, consultations, movements] = await Promise.all([
    prisma.sale.findMany({
      where: { tenantId, type: SaleType.SALE, ...branchFilter, createdAt: { gte: start } },
      select: {
        id: true,
        number: true,
        paidAmount: true,
        createdAt: true,
        customer: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
    prisma.payment.findMany({
      where: {
        tenantId,
        status: 'SUCCESS',
        createdAt: { gte: start },
        ...(branchId ? { sale: { branchId } } : {}),
      },
      select: { id: true, amount: true, method: true, createdAt: true, sale: { select: { number: true } } },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
    branchId
      ? Promise.resolve([])
      : prisma.lensOrder.findMany({
          where: { tenantId, createdAt: { gte: start } },
          select: { id: true, number: true, description: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 30,
        }),
    branchId
      ? Promise.resolve([])
      : prisma.consultation.findMany({
          where: { tenantId, createdAt: { gte: start } },
          select: { id: true, createdAt: true, patient: { select: { firstName: true, lastName: true } } },
          orderBy: { createdAt: 'desc' },
          take: 30,
        }),
    prisma.stockMovement.findMany({
      where: {
        tenantId,
        type: StockMovementType.PURCHASE_IN,
        createdAt: { gte: start },
        ...(branchId ? { stockItem: { branchId } } : {}),
      },
      select: {
        id: true,
        quantity: true,
        createdAt: true,
        stockItem: { select: { product: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
  ]);

  type Row = {
    id: string;
    type: 'sale' | 'payment' | 'lens_order' | 'consultation' | 'stock_in';
    label: string;
    detail: string | null;
    amount: number | null;
    at: Date;
  };

  const items: Row[] = [
    ...sales.map((s) => ({
      id: `sale-${s.id}`,
      type: 'sale' as const,
      label: `Vente ${s.number}`,
      detail: s.customer ? `${s.customer.firstName} ${s.customer.lastName}` : null,
      amount: Number(s.paidAmount),
      at: s.createdAt,
    })),
    ...payments.map((p) => ({
      id: `payment-${p.id}`,
      type: 'payment' as const,
      label: `Paiement ${p.sale.number}`,
      detail: p.method,
      amount: Number(p.amount),
      at: p.createdAt,
    })),
    ...lensOrders.map((o) => ({
      id: `lens-${o.id}`,
      type: 'lens_order' as const,
      label: `Commande verres ${o.number}`,
      detail: o.description,
      amount: null,
      at: o.createdAt,
    })),
    ...consultations.map((c) => ({
      id: `consult-${c.id}`,
      type: 'consultation' as const,
      label: 'Consultation',
      detail: `${c.patient.firstName} ${c.patient.lastName}`,
      amount: null,
      at: c.createdAt,
    })),
    ...movements.map((m) => ({
      id: `stock-${m.id}`,
      type: 'stock_in' as const,
      label: 'Réception stock',
      detail: `${m.stockItem.product.name} (+${m.quantity})`,
      amount: null,
      at: m.createdAt,
    })),
  ];

  items.sort((a, b) => b.at.getTime() - a.at.getTime());
  return items.slice(0, 20);
}

/**
 * Vue enrichie pour les administrateurs/propriétaires (mois en cours) :
 * répartition par magasin, meilleurs vendeurs, effectif et finance.
 * Respecte le périmètre du rôle : tous les magasins ou ceux assignés.
 */
export async function getAdminDashboard(
  tenantId: string,
  opts: { allBranches: boolean; branchIds: string[] },
) {
  const monthStart = startOfMonth();
  const scopedIds = opts.branchIds.length ? opts.branchIds : ['__none__'];
  const branchWhere = opts.allBranches ? { tenantId } : { tenantId, id: { in: scopedIds } };
  const branches = await prisma.branch.findMany({ where: branchWhere, select: { id: true, name: true } });
  const saleScope = opts.allBranches ? {} : { branchId: { in: scopedIds } };
  // Exclut les ventes annulées du chiffre d'affaires (comme le tableau de bord).
  const saleWhere = {
    tenantId,
    type: SaleType.SALE,
    status: { in: PAID_LIKE },
    createdAt: { gte: monthStart },
    ...saleScope,
  };

  // CA en base ENCAISSEMENT : on part des paiements du mois (dates au jour ou
  // l'argent est rentre) et on les rattache au magasin / vendeur de leur vente.
  const paymentScopeWhere = {
    tenantId,
    status: PaymentStatus.SUCCESS,
    createdAt: { gte: monthStart },
    sale: { type: SaleType.SALE, status: { in: PAID_LIKE }, ...saleScope },
  };
  const [monthPayments, perBranch, perCashier, expenseAgg, usersTotal, usersActive] = await Promise.all([
    prisma.payment.findMany({
      where: paymentScopeWhere,
      select: { amount: true, sale: { select: { branchId: true, cashierId: true } } },
    }),
    prisma.sale.groupBy({ by: ['branchId'], where: saleWhere, _count: { _all: true } }),
    prisma.sale.groupBy({ by: ['cashierId'], where: saleWhere, _count: { _all: true } }),
    prisma.expense.aggregate({
      where: {
        tenantId,
        date: { gte: monthStart },
        ...(opts.allBranches ? {} : { OR: [{ branchId: { in: scopedIds } }, { branchId: null }] }),
      },
      _sum: { amount: true },
    }),
    prisma.user.count({ where: { tenantId } }),
    prisma.user.count({ where: { tenantId, isActive: true } }),
  ]);

  // Encaisse du mois regroupe par magasin / vendeur de la vente d'origine.
  const collectedByBranch = new Map<string, number>();
  const collectedByCashier = new Map<string, number>();
  for (const p of monthPayments) {
    const amount = Number(p.amount);
    collectedByBranch.set(p.sale.branchId, (collectedByBranch.get(p.sale.branchId) ?? 0) + amount);
    collectedByCashier.set(p.sale.cashierId, (collectedByCashier.get(p.sale.cashierId) ?? 0) + amount);
  }

  const branchBreakdown = branches
    .map((b) => {
      const g = perBranch.find((x) => x.branchId === b.id);
      return {
        name: b.name,
        revenue: collectedByBranch.get(b.id) ?? 0,
        salesCount: g?._count._all ?? 0,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  const top = [...perCashier]
    .sort(
      (a, b) =>
        (collectedByCashier.get(b.cashierId) ?? 0) - (collectedByCashier.get(a.cashierId) ?? 0),
    )
    .slice(0, 5);
  const sellers = await prisma.user.findMany({
    where: { id: { in: top.map((t) => t.cashierId) } },
    select: { id: true, firstName: true, lastName: true },
  });
  const topSellers = top.map((t) => {
    const u = sellers.find((s) => s.id === t.cashierId);
    return {
      name: u ? `${u.firstName} ${u.lastName}` : '—',
      revenue: collectedByCashier.get(t.cashierId) ?? 0,
      salesCount: t._count._all,
    };
  });

  const monthRevenue = monthPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const monthExpenses = Number(expenseAgg._sum.amount ?? 0);

  return {
    branchBreakdown,
    topSellers,
    team: { usersTotal, usersActive },
    finance: { monthRevenue, monthExpenses, net: monthRevenue - monthExpenses },
  };
}
