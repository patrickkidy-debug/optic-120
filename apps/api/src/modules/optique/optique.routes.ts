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
import { retryOnDuplicateNumber } from '../../lib/prisma-retry.js';

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
      include: { customer: { select: { firstName: true, lastName: true, phone: true } } },
    });
    return reply.send({ orders });
  });

  // Nombre de commandes de verres en retard : échéance dépassée, pas encore
  // livrées ni annulées. Sert au rappel (pastille) sur le menu.
  app.get('/lens-orders/alerts/count', { preHandler: requirePermission('optique.sales.view') }, async (req, reply) => {
    const count = await req.db!.lensOrder.count({
      where: {
        expectedAt: { lt: new Date() },
        status: { notIn: ['DELIVERED', 'CANCELLED'] },
      },
    });
    return reply.send({ count });
  });

  app.post('/lens-orders', { preHandler: requirePermission('optique.sales.create') }, async (req, reply) => {
    const input = nullifyEmpty(lensOrderCreateSchema.parse(req.body));
    const order = await retryOnDuplicateNumber(async () =>
      req.db!.lensOrder.create({
        data: {
          tenantId: req.auth!.tenantId,
          number: await nextNumber(req.db!, 'lensOrder', 'LO'),
          customerId: input.customerId || null,
          category: input.category ?? null,
          supplierName: input.supplierName ?? null,
          description: input.description,
          expectedAt: input.expectedAt ? new Date(input.expectedAt) : null,
          cost: input.cost ?? null,
          notes: input.notes ?? null,
          createdById: req.auth!.userId,
        },
      }),
    );
    return reply.status(201).send({ order });
  });

  app.patch('/lens-orders/:id', { preHandler: requirePermission('optique.sales.create') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { status } = lensOrderStatusSchema.parse(req.body);
    const current = await req.db!.lensOrder.findFirst({ where: { id }, select: { deliveredAt: true } });
    if (!current) throw notFound('Commande introuvable');
    // Horodate la remise au client au premier passage à « Livré » (pour le délai).
    const data: { status: typeof status; deliveredAt?: Date } = { status };
    if (status === 'DELIVERED' && !current.deliveredAt) data.deliveredAt = new Date();
    await req.db!.lensOrder.updateMany({ where: { id }, data });
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
      include: { customer: { select: { firstName: true, lastName: true, phone: true } } },
    });
    return reply.send({ repairs });
  });

  app.post('/repairs', { preHandler: requirePermission('optique.sales.create') }, async (req, reply) => {
    const input = nullifyEmpty(repairCreateSchema.parse(req.body));
    const repair = await retryOnDuplicateNumber(async () =>
      req.db!.repair.create({
        data: {
          tenantId: req.auth!.tenantId,
          number: await nextNumber(req.db!, 'repair', 'REP'),
          customerId: input.customerId || null,
          category: input.category ?? null,
          description: input.description,
          cost: input.cost ?? null,
          notes: input.notes ?? null,
          createdById: req.auth!.userId,
        },
      }),
    );
    return reply.status(201).send({ repair });
  });

  app.patch('/repairs/:id', { preHandler: requirePermission('optique.sales.create') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { status } = repairStatusSchema.parse(req.body);
    const res = await req.db!.repair.updateMany({ where: { id }, data: { status } });
    if (res.count === 0) throw notFound('Réparation introuvable');
    return reply.send({ ok: true, status });
  });

  /* -------------------- Rappels de renouvellement -------------------- */
  app.get('/renewals', { preHandler: requirePermission('optique.customers.view') }, async (req, reply) => {
    const MONTH = 30 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const rxCutoff = new Date(now - 18 * MONTH); // ordonnance de plus de 18 mois
    const saleCutoff = new Date(now - 12 * MONTH); // aucun achat depuis 12 mois

    const rxGrouped = await req.db!.opticalPrescription.groupBy({
      by: ['customerId'],
      _max: { date: true },
    });
    const rxLast = new Map(rxGrouped.map((g) => [g.customerId, g._max.date]));
    const rxDue = new Set(
      rxGrouped.filter((g) => g._max.date && g._max.date < rxCutoff).map((g) => g.customerId),
    );

    const saleGrouped = await req.db!.sale.groupBy({
      by: ['customerId'],
      where: { type: 'SALE', customerId: { not: null } },
      _max: { createdAt: true },
    });
    const saleLast = new Map(
      saleGrouped.filter((g) => g.customerId).map((g) => [g.customerId as string, g._max.createdAt]),
    );
    const saleDue = new Set(
      saleGrouped
        .filter((g) => g.customerId && g._max.createdAt && g._max.createdAt < saleCutoff)
        .map((g) => g.customerId as string),
    );

    const ids = [...new Set([...rxDue, ...saleDue])];
    if (ids.length === 0) return reply.send({ renewals: [] });
    const customers = await req.db!.customer.findMany({
      where: { id: { in: ids } },
      select: { id: true, firstName: true, lastName: true, phone: true, email: true },
    });
    const renewals = customers.map((c) => ({
      ...c,
      renewPrescription: rxDue.has(c.id),
      reorder: saleDue.has(c.id),
      lastPrescriptionAt: rxLast.get(c.id) ?? null,
      lastPurchaseAt: saleLast.get(c.id) ?? null,
    }));
    return reply.send({ renewals });
  });
}
