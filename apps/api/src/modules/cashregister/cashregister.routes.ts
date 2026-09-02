import type { FastifyInstance } from 'fastify';
import { cashOpenSchema, cashCloseSchema, CashRegisterStatus } from '@oculo/shared-types';
import { requireAuth } from '../../middlewares/auth-guard.js';
import { requirePermission, assertBranchAccess } from '../../middlewares/rbac-guard.js';
import { badRequest, conflict, notFound } from '../../lib/http-error.js';

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
    const expenses = await req.db!.expense.aggregate({
      where: { branchId: register.branchId, date: { gte: register.openedAt } },
      _sum: { amount: true },
      _count: { _all: true },
    });
    const expensesTotal = Number(expenses._sum.amount ?? 0);

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
      expensesTotal,
      expensesCount: expenses._count._all,
      netTotal: total - expensesTotal,
      cancelled,
      cancelledCount: cancelled.length,
      cancelledCashedTotal,
      openingAmount: Number(register.openingAmount),
      expectedCash: Number(register.openingAmount) + cash - expensesTotal,
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

    // Espèces attendues : fond + ventes espèces - dépenses de la session.
    const [cashSales, expenses] = await Promise.all([
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
        where: { branchId: register.branchId, date: { gte: register.openedAt } },
        _sum: { amount: true },
      }),
    ]);
    const expensesTotal = Number(expenses._sum.amount ?? 0);
    const expected = Number(register.openingAmount) + Number(cashSales._sum.amount ?? 0) - expensesTotal;

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
    return reply.send({ register: result, expectedAmount: expected, expensesTotal });
  });
}
