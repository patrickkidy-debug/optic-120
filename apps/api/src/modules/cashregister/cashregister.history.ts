import type { TenantPrisma } from '../../lib/prisma-tenant.js';

/**
 * Historique des sessions de caisse et rapport détaillé (« rapport Z »).
 *
 * Chaque session est bornée à [ouverture, fermeture] (maintenant si elle est
 * encore ouverte) : un encaissement n'appartient qu'à une seule session. Les
 * dépenses et versements suivent la même règle que la fermeture : depuis le
 * début de la journée d'ouverture, sans repasser avant la fermeture précédente
 * du même magasin, et jusqu'à la fermeture de la session.
 */

interface RegisterRow {
  id: string;
  branchId: string;
  openedAt: Date;
  closedAt: Date | null;
  openedById: string;
  closedById: string | null;
  openingAmount: unknown;
  closingAmount: unknown;
  expectedAmount: unknown;
  status: string;
}

async function periodStart(db: TenantPrisma, r: RegisterRow): Promise<Date> {
  const dayStart = new Date(r.openedAt);
  dayStart.setUTCHours(0, 0, 0, 0);
  const previous = await db.cashRegister.findFirst({
    where: { branchId: r.branchId, id: { not: r.id }, closedAt: { not: null, lte: r.openedAt } },
    orderBy: { closedAt: 'desc' },
    select: { closedAt: true },
  });
  const prev = previous?.closedAt;
  return prev && prev > dayStart ? prev : dayStart;
}

function windowWhere(branchId: string, since: Date, until: Date) {
  return {
    AND: [
      { OR: [{ branchId }, { branchId: null }] },
      { OR: [{ createdAt: { gte: since, lte: until } }, { date: { gte: since, lte: until } }] },
    ],
  };
}

/** Chiffres d'une session (liste et rapport). */
async function computeTotals(db: TenantPrisma, r: RegisterRow) {
  const until = r.closedAt ?? new Date();
  const paymentWhere = { status: 'SUCCESS' as const, createdAt: { gte: r.openedAt, lte: until }, sale: { branchId: r.branchId } };
  const since = await periodStart(db, r);
  const ww = windowWhere(r.branchId, since, until);
  const [groups, expenses, tIn, tOut] = await Promise.all([
    db.payment.groupBy({ by: ['method'], where: paymentWhere, _sum: { amount: true }, _count: { _all: true } }),
    db.expense.aggregate({ where: ww, _sum: { amount: true }, _count: { _all: true } }),
    db.cashTransfer.aggregate({ where: { direction: 'IN', ...ww }, _sum: { amount: true } }),
    db.cashTransfer.aggregate({ where: { direction: 'OUT', ...ww }, _sum: { amount: true } }),
  ]);
  const byMethod = groups
    .map((g) => ({ method: g.method as string, amount: Number(g._sum.amount ?? 0), count: g._count._all }))
    .filter((m) => m.amount !== 0)
    .sort((a, b) => b.amount - a.amount);
  const salesTotal = byMethod.reduce((s, m) => s + m.amount, 0);
  const cashSales = byMethod.find((m) => m.method === 'CASH')?.amount ?? 0;
  const paymentsCount = byMethod.reduce((s, m) => s + m.count, 0);
  const expensesTotal = Number(expenses._sum.amount ?? 0);
  const transfersIn = Number(tIn._sum.amount ?? 0);
  const transfersOut = Number(tOut._sum.amount ?? 0);
  const opening = Number(r.openingAmount);
  // Attendu figé à la fermeture quand il existe : c'est le chiffre sur lequel
  // l'écart a été constaté. Sinon (session ouverte), calcul en direct.
  const expected = r.expectedAmount != null ? Number(r.expectedAmount) : opening + cashSales + transfersIn - transfersOut - expensesTotal;
  const counted = r.closingAmount != null ? Number(r.closingAmount) : null;
  return {
    since,
    until,
    byMethod,
    salesTotal,
    cashSales,
    paymentsCount,
    expensesTotal,
    expensesCount: expenses._count._all,
    transfersIn,
    transfersOut,
    netTotal: salesTotal + transfersIn - transfersOut - expensesTotal,
    openingAmount: opening,
    expectedAmount: expected,
    countedAmount: counted,
    variance: counted != null ? counted - expected : null,
  };
}

async function userNames(db: TenantPrisma, ids: (string | null)[]) {
  const unique = [...new Set(ids.filter((x): x is string => Boolean(x)))];
  if (!unique.length) return new Map<string, string>();
  const users = await db.user.findMany({ where: { id: { in: unique } }, select: { id: true, firstName: true, lastName: true } });
  return new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]));
}

function sessionBase(r: RegisterRow, names: Map<string, string>) {
  return {
    id: r.id,
    status: r.status,
    openedAt: r.openedAt,
    closedAt: r.closedAt,
    durationMinutes: Math.round(((r.closedAt ?? new Date()).getTime() - r.openedAt.getTime()) / 60000),
    openedBy: names.get(r.openedById) ?? null,
    closedBy: r.closedById ? names.get(r.closedById) ?? null : null,
  };
}

export async function listSessions(
  db: TenantPrisma,
  q: { branchId: string; from?: Date; to?: Date; page: number; pageSize: number },
) {
  const where = {
    branchId: q.branchId,
    ...(q.from || q.to ? { openedAt: { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) } } : {}),
  };
  const [total, rows, allInPeriod] = await Promise.all([
    db.cashRegister.count({ where }),
    db.cashRegister.findMany({ where, orderBy: { openedAt: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
    // Totaux de période : toutes les sessions de la période (bornées à 500).
    db.cashRegister.findMany({
      where,
      orderBy: { openedAt: 'desc' },
      take: 500,
      select: { status: true, openedAt: true, closedAt: true, closingAmount: true, expectedAmount: true },
    }),
  ]);
  const names = await userNames(db, rows.flatMap((r) => [r.openedById, r.closedById]));
  const sessions = await Promise.all(
    rows.map(async (r) => {
      const t = await computeTotals(db, r as RegisterRow);
      const { since: _s, until: _u, byMethod, ...rest } = t;
      return { ...sessionBase(r as RegisterRow, names), ...rest, methods: byMethod.map((m) => m.method) };
    }),
  );

  // Encaissé de la période = somme des encaissements faits PENDANT les
  // sessions (et non tous les paiements de la période, dont certains ont pu
  // être saisis hors caisse).
  const windows = allInPeriod.map((r) => ({ createdAt: { gte: r.openedAt, lte: r.closedAt ?? new Date() } }));
  const periodPayments = windows.length
    ? await db.payment.aggregate({
        where: { status: 'SUCCESS', sale: { branchId: q.branchId }, OR: windows },
        _sum: { amount: true },
      })
    : { _sum: { amount: null } };
  let varianceTotal = 0;
  let withVariance = 0;
  const closedRows = allInPeriod.filter((r) => r.status === 'CLOSED');
  for (const r of closedRows) {
    if (r.closingAmount == null || r.expectedAmount == null) continue;
    const v = Number(r.closingAmount) - Number(r.expectedAmount);
    varianceTotal += v;
    if (Math.abs(v) >= 1) withVariance++;
  }

  return {
    sessions,
    total,
    page: q.page,
    pageSize: q.pageSize,
    stats: {
      sessions: total,
      closed: closedRows.length,
      salesTotal: Number(periodPayments._sum.amount ?? 0),
      varianceTotal,
      withVariance,
    },
  };
}

/** Rapport détaillé d'une session : tout ce qui a fait bouger la caisse. */
export async function sessionReport(db: TenantPrisma, id: string) {
  const r = (await db.cashRegister.findFirst({ where: { id } })) as RegisterRow | null;
  if (!r) return null;
  const t = await computeTotals(db, r);
  const ww = windowWhere(r.branchId, t.since, t.until);
  const [payments, expenses, transfers, cancelled, branch, names] = await Promise.all([
    db.payment.findMany({
      where: { status: 'SUCCESS', createdAt: { gte: r.openedAt, lte: t.until }, sale: { branchId: r.branchId } },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        method: true,
        amount: true,
        createdAt: true,
        sale: { select: { id: true, number: true, type: true, status: true, customer: { select: { firstName: true, lastName: true } } } },
      },
    }),
    db.expense.findMany({ where: ww, orderBy: { createdAt: 'asc' }, select: { id: true, label: true, category: true, amount: true, createdAt: true, date: true } }),
    db.cashTransfer.findMany({ where: ww, orderBy: { createdAt: 'asc' }, select: { id: true, direction: true, label: true, amount: true, createdAt: true, date: true } }),
    db.sale.findMany({
      where: { branchId: r.branchId, status: 'CANCELLED', updatedAt: { gte: r.openedAt, lte: t.until } },
      select: { id: true, number: true, totalAmount: true, updatedAt: true, customer: { select: { firstName: true, lastName: true } } },
      orderBy: { updatedAt: 'asc' },
    }),
    db.branch.findFirst({ where: { id: r.branchId }, select: { name: true } }),
    userNames(db, [r.openedById, r.closedById]),
  ]);
  // Nombre de ventes distinctes réglées pendant la session.
  const salesCount = new Set(payments.map((p) => p.sale.id)).size;
  return {
    ...sessionBase(r, names),
    branchName: branch?.name ?? null,
    ...t,
    salesCount,
    payments: payments.map((p) => ({
      id: p.id,
      method: p.method,
      amount: Number(p.amount),
      at: p.createdAt,
      saleId: p.sale.id,
      saleNumber: p.sale.number,
      saleType: p.sale.type,
      cancelled: p.sale.status === 'CANCELLED',
      customerName: p.sale.customer ? `${p.sale.customer.firstName} ${p.sale.customer.lastName}` : null,
    })),
    expenses: expenses.map((e) => ({ ...e, amount: Number(e.amount) })),
    transfers: transfers.map((x) => ({ ...x, amount: Number(x.amount) })),
    cancelled: cancelled.map((s) => ({
      id: s.id,
      number: s.number,
      total: Number(s.totalAmount),
      at: s.updatedAt,
      customerName: s.customer ? `${s.customer.firstName} ${s.customer.lastName}` : null,
    })),
  };
}
