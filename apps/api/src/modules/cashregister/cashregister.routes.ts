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

  app.post('/open', { preHandler: requirePermission('optique.cashregister.open') }, async (req, reply) => {
    const input = cashOpenSchema.parse(req.body);
    assertBranchAccess(req, input.branchId);
    const existing = await req.db!.cashRegister.findFirst({
      where: { branchId: input.branchId, status: CashRegisterStatus.OPEN },
    });
    if (existing) throw conflict('Une caisse est déjà ouverte pour cette succursale');

    const register = await req.db!.cashRegister.create({
      data: {
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

    // Total encaissé en espèces depuis l'ouverture (contrôle d'écart).
    const cashSales = await req.db!.payment.aggregate({
      where: {
        method: 'CASH',
        status: 'SUCCESS',
        createdAt: { gte: register.openedAt },
        sale: { branchId: register.branchId },
      },
      _sum: { amount: true },
    });
    const expected = Number(register.openingAmount) + Number(cashSales._sum.amount ?? 0);

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
    return reply.send({ register: result, expectedAmount: expected });
  });
}
