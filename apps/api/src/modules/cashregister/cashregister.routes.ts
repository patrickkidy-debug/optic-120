import type { FastifyInstance, FastifyRequest } from 'fastify';
import { cashOpenSchema, cashCloseSchema, CashRegisterStatus } from '@oculo/shared-types';
import { requireAuth } from '../../middlewares/auth-guard.js';
import { requirePermission, assertBranchAccess } from '../../middlewares/rbac-guard.js';
import { badRequest, conflict, notFound } from '../../lib/http-error.js';
import { listSessions, sessionReport } from './cashregister.history.js';

type Db = NonNullable<FastifyRequest['db']>;

/**
 * Début de la période dont la session répond, pour les dépenses et versements.
 *
 * Pas l'heure d'ouverture seule : une dépense saisie le matin avant d'ouvrir
 * la caisse (ou depuis « Dépenses / Versements ») était ignorée à la fermeture.
 * On remonte donc au début de la journée d'ouverture, sans jamais repasser
 * avant la fermeture précédente du même magasin : une dépense déjà déduite
 * par une session n'est pas déduite deux fois.
 */
async function sessionStart(db: Db, register: { id: string; branchId: string; openedAt: Date }): Promise<Date> {
  const dayStart = new Date(register.openedAt);
  dayStart.setUTCHours(0, 0, 0, 0);
  const previous = await db.cashRegister.findFirst({
    where: { branchId: register.branchId, id: { not: register.id }, closedAt: { not: null, lte: register.openedAt } },
    orderBy: { closedAt: 'desc' },
    select: { closedAt: true },
  });
  const prevClose = previous?.closedAt;
  return prevClose && prevClose > dayStart ? prevClose : dayStart;
}

/** Filtre « magasin de la caisse (ou sans magasin) » + « saisi ou daté depuis `since` ». */
function sessionWhere(branchId: string, since: Date) {
  return {
    AND: [
      { OR: [{ branchId }, { branchId: null }] },
      { OR: [{ createdAt: { gte: since } }, { date: { gte: since } }] },
    ],
  };
}

export async function cashRegisterRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  // Caisse ouverte pour une succursale (le cas échéant).
  app.get('/current', { preHandler: requirePermission('optique.cashregister.view') }, async (req, reply) => {
    const q = req.query as { branchId?: string };
    if (!q.branchId) throw badRequest('branchId requis');
    assertBranchAccess(req, q.branchId);
    const register = await req.db!.cashRegister.findFirst({
      where: { branchId: q.branchId, status: CashRegisterStatus.OPEN },
      orderBy: { openedAt: 'desc' },
    });
    return reply.send({ register });
  });

  // Historique des sessions d'un magasin (plus récentes d'abord), avec les
  // chiffres de chaque session et les totaux de la période demandée.
  app.get('/history', { preHandler: requirePermission('optique.cashregister.view') }, async (req, reply) => {
    const q = req.query as { branchId?: string; from?: string; to?: string; page?: string; pageSize?: string };
    if (!q.branchId) throw badRequest('branchId requis');
    assertBranchAccess(req, q.branchId);
    const day = (v?: string, end = false) => {
      if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
      return new Date(`${v}T${end ? '23:59:59.999' : '00:00:00.000'}Z`);
    };
    return reply.send(
      await listSessions(req.db!, {
        branchId: q.branchId,
        from: day(q.from),
        to: day(q.to, true),
        page: Math.max(1, Number.parseInt(q.page ?? '1', 10) || 1),
        pageSize: Math.min(50, Math.max(5, Number.parseInt(q.pageSize ?? '15', 10) || 15)),
      }),
    );
  });

  // Rapport détaillé d'une session (rapport Z) : encaissements un par un,
  // dépenses, versements, ventes annulées et rapprochement des espèces.
  app.get('/:id/report', { preHandler: requirePermission('optique.cashregister.view') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const report = await sessionReport(req.db!, id);
    if (!report) throw notFound('Caisse introuvable');
    const reg = await req.db!.cashRegister.findFirst({ where: { id }, select: { branchId: true } });
    assertBranchAccess(req, reg!.branchId);
    return reply.send({ report });
  });

  // Résumé en direct de la session : encaissements par moyen de paiement depuis
  // l'ouverture, dépenses de session et espèces attendues.
  app.get('/:id/summary', { preHandler: requirePermission('optique.cashregister.view') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const register = await req.db!.cashRegister.findFirst({ where: { id } });
    if (!register) throw notFound('Caisse introuvable');

    const groups = await req.db!.payment.groupBy({
      by: ['method'],
      where: {
        status: 'SUCCESS',
        createdAt: { gte: register.openedAt },
        sale: { branchId: register.branchId },
      },
      _sum: { amount: true },
      _count: { _all: true },
    });
    const byMethod = groups
      .map((g) => ({ method: g.method, amount: Number(g._sum.amount ?? 0), count: g._count._all }))
      .filter((m) => m.amount !== 0)
      .sort((a, b) => b.amount - a.amount);
    const cash = byMethod.find((m) => m.method === 'CASH')?.amount ?? 0;
    const total = byMethod.reduce((s, m) => s + m.amount, 0);
    const since = await sessionStart(req.db!, register);
    const expenseWhere = sessionWhere(register.branchId, since);

    const [expensesAgg, expensesList, transfersInAgg, transfersOutAgg] = await Promise.all([
      req.db!.expense.aggregate({
        where: expenseWhere,
        _sum: { amount: true },
        _count: { _all: true },
      }),
      req.db!.expense.findMany({
        where: expenseWhere,
        select: {
          id: true,
          label: true,
          amount: true,
          category: true,
          date: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      req.db!.cashTransfer.aggregate({
        where: {
          direction: 'IN',
          ...sessionWhere(register.branchId, since),
        },
        _sum: { amount: true },
      }),
      req.db!.cashTransfer.aggregate({
        where: {
          direction: 'OUT',
          ...sessionWhere(register.branchId, since),
        },
        _sum: { amount: true },
      }),
    ]);
    const expensesTotal = Number(expensesAgg._sum.amount ?? 0);
    const expenses = expensesList.map((e) => ({
      id: e.id,
      label: e.label,
      amount: Number(e.amount),
      category: e.category,
      date: e.date,
      createdAt: e.createdAt,
    }));
    const transfersInTotal = Number(transfersInAgg._sum.amount ?? 0);
    const transfersOutTotal = Number(transfersOutAgg._sum.amount ?? 0);
    const transfersNet = transfersInTotal - transfersOutTotal;

    // Ventes annulées pendant la session. L'annulation remet le stock mais ne
    // supprime pas les encaissements déjà passés : le caissier doit voir à
    // quelles ventes annulées correspond l'argent présent en caisse.
    // Sale n'a pas de date d'annulation dédiée ; updatedAt en tient lieu (une
    // vente annulée n'est plus modifiable ensuite).
    const cancelledRows = await req.db!.sale.findMany({
      where: {
        branchId: register.branchId,
        status: 'CANCELLED',
        updatedAt: { gte: register.openedAt },
      },
      select: {
        id: true,
        number: true,
        totalAmount: true,
        updatedAt: true,
        customer: { select: { firstName: true, lastName: true } },
        payments: {
          where: { status: 'SUCCESS', createdAt: { gte: register.openedAt } },
          select: { amount: true, method: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
    const cancelled = cancelledRows.map((s) => ({
      id: s.id,
      number: s.number,
      total: Number(s.totalAmount),
      cancelledAt: s.updatedAt,
      customerName: s.customer ? `${s.customer.firstName} ${s.customer.lastName}` : null,
      // Encaissé sur cette vente pendant la session : ce montant est compté
      // dans le total ci-dessus alors que la vente n'existe plus.
      cashedAmount: s.payments.reduce((sum, p) => sum + Number(p.amount), 0),
      methods: [...new Set(s.payments.map((p) => p.method))],
    }));
    const cancelledCashedTotal = cancelled.reduce((sum, s) => sum + s.cashedAmount, 0);

    return reply.send({
      byMethod,
      cash,
      total,
      expenses,
      expensesTotal,
      expensesCount: expensesAgg._count._all,
      transfersInTotal,
      transfersOutTotal,
      transfersNet,
      netTotal: total + transfersNet - expensesTotal,
      cancelled,
      cancelledCount: cancelled.length,
      cancelledCashedTotal,
      openingAmount: Number(register.openingAmount),
      expectedCash: Number(register.openingAmount) + cash + transfersNet - expensesTotal,
      openedAt: register.openedAt,
    });
  });

  app.post('/open', { preHandler: requirePermission('optique.cashregister.open') }, async (req, reply) => {
    const input = cashOpenSchema.parse(req.body);
    assertBranchAccess(req, input.branchId);
    const existing = await req.db!.cashRegister.findFirst({
      where: { branchId: input.branchId, status: CashRegisterStatus.OPEN },
    });
    if (existing) throw conflict('Une caisse est déjà ouverte pour cette succursale');

    const register = await req.db!.cashRegister.create({
      data: {
        tenantId: req.auth!.tenantId,
        branchId: input.branchId,
        openedById: req.auth!.userId,
        openingAmount: input.openingAmount,
        status: CashRegisterStatus.OPEN,
      },
    });
    return reply.status(201).send({ register });
  });

  app.post('/:id/close', { preHandler: requirePermission('optique.cashregister.close') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const input = cashCloseSchema.parse(req.body);
    const register = await req.db!.cashRegister.findFirst({ where: { id } });
    if (!register) throw notFound('Caisse introuvable');
    if (register.status === CashRegisterStatus.CLOSED) throw conflict('Caisse déjà fermée');

    const since = await sessionStart(req.db!, register);
    const expenseWhere = sessionWhere(register.branchId, since);

    // Espèces attendues : fond + ventes espèces + apports - retraits - dépenses de la session.
    const [cashSales, expensesAgg, transfersInAgg, transfersOutAgg] = await Promise.all([
      req.db!.payment.aggregate({
        where: {
          method: 'CASH',
          status: 'SUCCESS',
          createdAt: { gte: register.openedAt },
          sale: { branchId: register.branchId },
        },
        _sum: { amount: true },
      }),
      req.db!.expense.aggregate({
        where: expenseWhere,
        _sum: { amount: true },
      }),
      req.db!.cashTransfer.aggregate({
        where: {
          direction: 'IN',
          ...sessionWhere(register.branchId, since),
        },
        _sum: { amount: true },
      }),
      req.db!.cashTransfer.aggregate({
        where: {
          direction: 'OUT',
          ...sessionWhere(register.branchId, since),
        },
        _sum: { amount: true },
      }),
    ]);
    const expensesTotal = Number(expensesAgg._sum.amount ?? 0);
    const transfersInTotal = Number(transfersInAgg._sum.amount ?? 0);
    const transfersOutTotal = Number(transfersOutAgg._sum.amount ?? 0);
    const transfersNet = transfersInTotal - transfersOutTotal;
    const cashSalesTotal = Number(cashSales._sum.amount ?? 0);
    const openingAmount = Number(register.openingAmount);
    const expected = openingAmount + cashSalesTotal + transfersNet - expensesTotal;
    // Total encaissé tous moyens confondus, et net après dépenses : ce que
    // l'opticien appelle « la vente de la journée ».
    const allSales = await req.db!.payment.aggregate({
      where: { status: 'SUCCESS', createdAt: { gte: register.openedAt }, sale: { branchId: register.branchId } },
      _sum: { amount: true },
    });
    const salesTotal = Number(allSales._sum.amount ?? 0);

    const updated = await req.db!.cashRegister.updateMany({
      where: { id },
      data: {
        status: CashRegisterStatus.CLOSED,
        closedAt: new Date(),
        closedById: req.auth!.userId,
        closingAmount: input.closingAmount,
        expectedAmount: expected,
      },
    });
    if (updated.count === 0) throw notFound('Caisse introuvable');
    const result = await req.db!.cashRegister.findFirst({ where: { id } });
    return reply.send({
      register: result,
      expectedAmount: expected,
      expensesTotal,
      cashSalesTotal,
      openingAmount,
      transfersNet,
      salesTotal,
      netTotal: salesTotal + transfersNet - expensesTotal,
    });
  });
}
