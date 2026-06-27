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
  ] = await Promise.all([
    prisma.sale.aggregate({
      where: { ...saleBase, createdAt: { gte: startOfToday() } },
      _sum: { paidAmount: true, totalAmount: true },
    }),
    prisma.sale.aggregate({
      where: { ...saleBase, createdAt: { gte: startOfMonth() } },
      _sum: { paidAmount: true, totalAmount: true },
    }),
    prisma.sale.count({ where: { ...saleBase, createdAt: { gte: startOfToday() } } }),
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
  };
}
