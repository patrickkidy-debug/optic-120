import type { FastifyInstance } from 'fastify';
import {
  lensOrderCreateSchema,
  lensOrderStatusSchema,
  repairCreateSchema,
  repairStatusSchema,
} from '@oculo/shared-types';
import { requireAuth } from '../../middlewares/auth-guard.js';
import { requirePermission } from '../../middlewares/rbac-guard.js';
import { notFound } from '../../lib/http-error.js';

function nullifyEmpty<T extends Record<string, unknown>>(obj: T): T {
  const out = { ...obj } as Record<string, unknown>;
  for (const k of Object.keys(out)) if (out[k] === '') out[k] = null;
  return out as T;
}

async function nextNumber(
  db: NonNullable<import('fastify').FastifyRequest['db']>,
  model: 'lensOrder' | 'repair',
  prefix: string,
): Promise<string> {
  const year = new Date().getFullYear();
  const count = await (db[model] as { count: (a?: unknown) => Promise<number> }).count();
  return `${prefix}-${year}-${String(count + 1).padStart(5, '0')}`;
}

/**
 * Fonctionnalités optique : commandes de verres (laboratoire) et SAV/réparations.
 * Réutilise les permissions ventes (le personnel de comptoir les gère).
 */
export async function optiqueRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  /* -------------------- Commandes de verres (labo) -------------------- */
  app.get('/lens-orders', { preHandler: requirePermission('optique.sales.view') }, async (req, reply) => {
    const q = req.query as { status?: string };
    const where = q.status ? { status: q.status as never } : {};
    const orders = await req.db!.lensOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { customer: { select: { firstName: true, lastName: true } } },
    });
    return reply.send({ orders });
  });

  app.post('/lens-orders', { preHandler: requirePermission('optique.sales.create') }, async (req, reply) => {
    const input = nullifyEmpty(lensOrderCreateSchema.parse(req.body));
    const order = await req.db!.lensOrder.create({
      data: {
        tenantId: req.auth!.tenantId,
        number: await nextNumber(req.db!, 'lensOrder', 'LO'),
        customerId: input.customerId || null,
        supplierName: input.supplierName ?? null,
        description: input.description,
        expectedAt: input.expectedAt ? new Date(input.expectedAt) : null,
        cost: input.cost ?? null,
        notes: input.notes ?? null,
        createdById: req.auth!.userId,
      },
    });
    return reply.status(201).send({ order });
  });

  app.patch('/lens-orders/:id', { preHandler: requirePermission('optique.sales.create') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { status } = lensOrderStatusSchema.parse(req.body);
    const res = await req.db!.lensOrder.updateMany({ where: { id }, data: { status } });
    if (res.count === 0) throw notFound('Commande introuvable');
    return reply.send({ ok: true, status });
  });

  /* -------------------- SAV / Réparations -------------------- */
  app.get('/repairs', { preHandler: requirePermission('optique.sales.view') }, async (req, reply) => {
    const q = req.query as { status?: string };
    const where = q.status ? { status: q.status as never } : {};
    const repairs = await req.db!.repair.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { customer: { select: { firstName: true, lastName: true } } },
    });
    return reply.send({ repairs });
  });

  app.post('/repairs', { preHandler: requirePermission('optique.sales.create') }, async (req, reply) => {
    const input = nullifyEmpty(repairCreateSchema.parse(req.body));
    const repair = await req.db!.repair.create({
      data: {
        tenantId: req.auth!.tenantId,
        number: await nextNumber(req.db!, 'repair', 'REP'),
        customerId: input.customerId || null,
        description: input.description,
        cost: input.cost ?? null,
        notes: input.notes ?? null,
        createdById: req.auth!.userId,
      },
    });
    return reply.status(201).send({ repair });
  });

  app.patch('/repairs/:id', { preHandler: requirePermission('optique.sales.create') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { status } = repairStatusSchema.parse(req.body);
    const res = await req.db!.repair.updateMany({ where: { id }, data: { status } });
    if (res.count === 0) throw notFound('Réparation introuvable');
    return reply.send({ ok: true, status });
  });
}
