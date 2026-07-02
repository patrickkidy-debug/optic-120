import { prisma } from '../../lib/prisma.js';
import { SaleType } from '@oculo/shared-types';

const DAY = 24 * 3600 * 1000;
const WEEKDAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

export interface ForecastResult {
  hasEnoughData: boolean;
  history: { date: string; revenue: number }[];
  forecast: { date: string; revenue: number }[];
  actualMonthRevenue: number;
  projectedMonthRevenue: number;
  lastMonthRevenue: number;
  trendPct: number;
  next7Total: number;
  bestWeekday: { label: string; avg: number } | null;
  stockRisks: { product: string; stock: number; daysLeft: number }[];
}

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Analyse prédictive du comportement économique de l'établissement, calculée à
 * partir de l'historique des ventes (90 jours) : régression linéaire de tendance
 * + saisonnalité par jour de semaine → prévision du CA sur 14 jours, projection
 * du mois, et détection des ruptures de stock à venir (vélocité des ventes).
 */
export async function getForecast(tenantId: string, branchId?: string): Promise<ForecastResult> {
  const branchFilter = branchId ? { branchId } : {};
  const now = new Date();
  const since = new Date(now.getTime() - 90 * DAY);

  const sales = await prisma.sale.findMany({
    where: { tenantId, type: SaleType.SALE, ...branchFilter, createdAt: { gte: since } },
    select: { createdAt: true, paidAmount: true },
  });

  const byDay = new Map<string, number>();
  for (const s of sales) {
    const k = dayKey(s.createdAt);
    byDay.set(k, (byDay.get(k) ?? 0) + Number(s.paidAmount));
  }

  const N = 90;
  const series: { date: string; ts: number; value: number; weekday: number }[] = [];
  for (let i = N - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * DAY);
    series.push({ date: dayKey(d), ts: d.getTime(), value: byDay.get(dayKey(d)) ?? 0, weekday: d.getUTCDay() });
  }

  const ys = series.map((p) => p.value);
  const n = series.length;
  const daysWithSales = ys.filter((v) => v > 0).length;
  const hasEnoughData = daysWithSales >= 5;

  // Régression linéaire (moindres carrés) sur l'index temporel.
  const sumX = (n * (n - 1)) / 2;
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = ys.reduce((a, y, i) => a + i * y, 0);
  const sumX2 = ys.reduce((a, _y, i) => a + i * i, 0);
  const denom = n * sumX2 - sumX * sumX;
  const slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
  const intercept = (sumY - slope * sumX) / n;

  // Saisonnalité par jour de semaine (facteur relatif à la moyenne).
  const overallAvg = sumY / n || 0;
  const wdSum = new Array(7).fill(0);
  const wdCount = new Array(7).fill(0);
  for (const p of series) {
    wdSum[p.weekday] += p.value;
    wdCount[p.weekday] += 1;
  }
  const wdAvg = wdSum.map((s, i) => (wdCount[i] ? s / wdCount[i] : overallAvg));
  const wdFactor = wdAvg.map((a) => (overallAvg > 0 ? a / overallAvg : 1));

  // Prévision des 14 prochains jours (tendance × saisonnalité).
  const forecast: { date: string; revenue: number }[] = [];
  for (let k = 1; k <= 14; k++) {
    const d = new Date(now.getTime() + k * DAY);
    const trendVal = Math.max(0, slope * (n - 1 + k) + intercept);
    forecast.push({ date: dayKey(d), revenue: Math.round(trendVal * wdFactor[d.getUTCDay()]) });
  }

  // Tendance : 14 derniers jours vs 14 précédents.
  const last14 = ys.slice(-14).reduce((a, b) => a + b, 0);
  const prev14 = ys.slice(-28, -14).reduce((a, b) => a + b, 0);
  const trendPct = prev14 > 0 ? Math.round(((last14 - prev14) / prev14) * 100) : 0;

  // Projection du mois en cours.
  const monthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const actualMonthRevenue = series.filter((p) => p.ts >= monthStart).reduce((a, p) => a + p.value, 0);
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const remaining = Math.max(0, daysInMonth - now.getUTCDate());
  const remainingForecast = forecast.slice(0, remaining).reduce((a, f) => a + f.revenue, 0);
  const projectedMonthRevenue = actualMonthRevenue + remainingForecast;

  const lastMonthAgg = await prisma.sale.aggregate({
    where: {
      tenantId,
      type: SaleType.SALE,
      ...branchFilter,
      createdAt: {
        gte: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)),
        lt: new Date(monthStart),
      },
    },
    _sum: { paidAmount: true },
  });
  const lastMonthRevenue = Number(lastMonthAgg._sum.paidAmount ?? 0);

  const next7Total = forecast.slice(0, 7).reduce((a, f) => a + f.revenue, 0);

  let bestWeekday: { label: string; avg: number } | null = null;
  if (hasEnoughData) {
    let bi = 0;
    for (let i = 1; i < 7; i++) if (wdAvg[i] > wdAvg[bi]) bi = i;
    bestWeekday = { label: WEEKDAYS[bi], avg: Math.round(wdAvg[bi]) };
  }

  const stockRisks = await computeStockRisks(tenantId, branchId);
  const history = series.slice(-30).map((p) => ({ date: p.date, revenue: p.value }));

  return {
    hasEnoughData,
    history,
    forecast,
    actualMonthRevenue,
    projectedMonthRevenue,
    lastMonthRevenue,
    trendPct,
    next7Total,
    bestWeekday,
    stockRisks,
  };
}

/** Prévoit les ruptures de stock : stock actuel ÷ vélocité de vente (30 j). */
async function computeStockRisks(tenantId: string, branchId?: string) {
  const branchFilter = branchId ? { branchId } : {};
  const since = new Date(Date.now() - 30 * DAY);
  const sold = await prisma.saleItem.groupBy({
    by: ['productId'],
    where: { sale: { tenantId, type: SaleType.SALE, createdAt: { gte: since }, ...branchFilter } },
    _sum: { quantity: true },
  });
  if (sold.length === 0) return [];

  const productIds = sold.map((s) => s.productId);
  const stock = await prisma.stockItem.groupBy({
    by: ['productId'],
    where: { tenantId, productId: { in: productIds }, ...branchFilter },
    _sum: { quantity: true },
  });
  const stockMap = new Map(stock.map((s) => [s.productId, Number(s._sum.quantity ?? 0)]));
  const products = await prisma.product.findMany({
    where: { tenantId, id: { in: productIds } },
    select: { id: true, name: true },
  });
  const nameMap = new Map(products.map((p) => [p.id, p.name]));

  return sold
    .map((s) => {
      const rate = Number(s._sum.quantity ?? 0) / 30;
      const stk = stockMap.get(s.productId) ?? 0;
      const daysLeft = rate > 0 ? Math.round(stk / rate) : Infinity;
      return { product: nameMap.get(s.productId) ?? '—', stock: stk, daysLeft };
    })
    .filter((r) => Number.isFinite(r.daysLeft) && r.daysLeft <= 21)
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, 5);
}
