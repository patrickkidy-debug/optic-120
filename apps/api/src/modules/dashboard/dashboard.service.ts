import { SaleStatus, SaleType } from '@oculo/shared-types';
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

export async function getDashboard(tenantId: string, branchId?: string) {
  const branchFilter = branchId ? { branchId } : {};
  const saleBase = { tenantId, type: SaleType.SALE, ...branchFilter };

  const [
    todayAgg,
    monthAgg,
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
  ] = await Promise.all([
    prisma.sale.aggregate({
      where: { ...saleBase, status: { in: PAID_LIKE }, createdAt: { gte: startOfToday() } },
      _sum: { paidAmount: true, totalAmount: true },
    }),
    prisma.sale.aggregate({
      where: { ...saleBase, status: { in: PAID_LIKE }, createdAt: { gte: startOfMonth() } },
      _sum: { paidAmount: true, totalAmount: true },
    }),
    prisma.sale.count({ where: { ...saleBase, status: { in: PAID_LIKE }, createdAt: { gte: startOfToday() } } }),
    prisma.customer.count({ where: { tenantId } }),
    prisma.stockItem.findMany({
      where: { tenantId, ...branchFilter },
      select: { quantity: true, minAlert: true },
    }),
    prisma.sale.findMany({
      where: { tenantId, ...branchFilter },
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: { customer: true, branch: true },
    }),
    prisma.sale.findMany({
      where: {
        ...saleBase,
        status: { in: PAID_LIKE },
        createdAt: { gte: new Date(Date.now() - 6 * 24 * 3600 * 1000) },
      },
      select: { createdAt: true, paidAmount: true },
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
    prisma.sale.aggregate({
      where: {
        ...saleBase,
        status: { in: PAID_LIKE },
        createdAt: {
          gte: new Date(Date.now() - 13 * 24 * 3600 * 1000),
          lt: new Date(Date.now() - 6 * 24 * 3600 * 1000),
        },
      },
      _sum: { paidAmount: true },
    }),
  ]);

  // Série des 7 derniers jours.
  const days: { date: string; revenue: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    days.push({ date: d.toISOString().slice(0, 10), revenue: 0 });
  }
  const indexByDate = new Map(days.map((d, idx) => [d.date, idx]));
  for (const s of weekSales) {
    const key = s.createdAt.toISOString().slice(0, 10);
    const idx = indexByDate.get(key);
    if (idx !== undefined) days[idx].revenue += Number(s.paidAmount);
  }

  const weekRevenue = days.reduce((sum, d) => sum + d.revenue, 0);
  const prevWeekRevenue = Number(prevWeekAgg._sum.paidAmount ?? 0);
  const monthRevenueValue = Number(monthAgg._sum.paidAmount ?? 0);
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

  return {
    todayRevenue: Number(todayAgg._sum.paidAmount ?? 0),
    monthRevenue: Number(monthAgg._sum.paidAmount ?? 0),
    todaySalesCount: todayCount,
    customersCount,
    lowStockCount: lowStockItems.filter((i) => i.quantity <= i.minAlert).length,
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
  };
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

  const [perBranch, perCashier, revenueAgg, expenseAgg, usersTotal, usersActive] = await Promise.all([
    prisma.sale.groupBy({ by: ['branchId'], where: saleWhere, _sum: { paidAmount: true }, _count: { _all: true } }),
    prisma.sale.groupBy({ by: ['cashierId'], where: saleWhere, _sum: { paidAmount: true }, _count: { _all: true } }),
    prisma.sale.aggregate({ where: saleWhere, _sum: { paidAmount: true } }),
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

  const branchBreakdown = branches
    .map((b) => {
      const g = perBranch.find((x) => x.branchId === b.id);
      return { name: b.name, revenue: Number(g?._sum.paidAmount ?? 0), salesCount: g?._count._all ?? 0 };
    })
    .sort((a, b) => b.revenue - a.revenue);

  const top = [...perCashier]
    .sort((a, b) => Number(b._sum.paidAmount ?? 0) - Number(a._sum.paidAmount ?? 0))
    .slice(0, 5);
  const sellers = await prisma.user.findMany({
    where: { id: { in: top.map((t) => t.cashierId) } },
    select: { id: true, firstName: true, lastName: true },
  });
  const topSellers = top.map((t) => {
    const u = sellers.find((s) => s.id === t.cashierId);
    return {
      name: u ? `${u.firstName} ${u.lastName}` : '—',
      revenue: Number(t._sum.paidAmount ?? 0),
      salesCount: t._count._all,
    };
  });

  const monthRevenue = Number(revenueAgg._sum.paidAmount ?? 0);
  const monthExpenses = Number(expenseAgg._sum.amount ?? 0);

  return {
    branchBreakdown,
    topSellers,
    team: { usersTotal, usersActive },
    finance: { monthRevenue, monthExpenses, net: monthRevenue - monthExpenses },
  };
}
