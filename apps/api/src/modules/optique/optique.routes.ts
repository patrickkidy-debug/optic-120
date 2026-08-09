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
import { getOpticalSettings } from '../../lib/optical-settings.js';
import { recordAudit, requestMeta } from '../../lib/audit.js';
import { prisma } from '../../lib/prisma.js';

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
      include: {
        customer: { select: { firstName: true, lastName: true, phone: true } },
        // Vignette Kanban : nom + photo de la monture associée, si choisie.
        frameProduct: { select: { id: true, name: true, brand: true, photoUrl: true } },
      },
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
    // La monture choisie doit appartenir à l'établissement (vignette Kanban).
    if (input.frameProductId) {
      const frame = await req.db!.product.findFirst({ where: { id: input.frameProductId } });
      if (!frame) throw notFound('Monture introuvable');
    }
    const order = await retryOnDuplicateNumber(async () =>
      req.db!.lensOrder.create({
        data: {
          tenantId: req.auth!.tenantId,
          number: await nextNumber(req.db!, 'lensOrder', 'LO'),
          customerId: input.customerId || null,
          category: input.category ?? null,
          supplierName: input.supplierName ?? null,
          description: input.description,
          odLens: input.odLens ?? null,
          ogLens: input.ogLens ?? null,
          frameProductId: input.frameProductId || null,
          expectedAt: input.expectedAt ? new Date(input.expectedAt) : null,
          cost: input.cost ?? null,
          notes: input.notes ?? null,
          createdById: req.auth!.userId,
        },
      }),
    );
    await recordAudit({
      tenantId: req.auth!.tenantId,
      userId: req.auth!.userId,
      action: 'LENS_ORDER_CREATED',
      entity: 'LensOrder',
      entityId: order.id,
      metadata: { number: order.number },
      ...requestMeta(req),
    });
    return reply.status(201).send({ order });
  });

  // Déplacement d'une carte Kanban : change le statut, horodate la remise au
  // premier passage à « Livré », et journalise (date + utilisateur) pour la
  // timeline de la fiche commande.
  app.patch('/lens-orders/:id', { preHandler: requirePermission('optique.sales.create') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { status } = lensOrderStatusSchema.parse(req.body);
    const current = await req.db!.lensOrder.findFirst({ where: { id }, select: { status: true, deliveredAt: true, number: true } });
    if (!current) throw notFound('Commande introuvable');
    const data: { status: typeof status; deliveredAt?: Date } = { status };
    if (status === 'DELIVERED' && !current.deliveredAt) data.deliveredAt = new Date();
    await req.db!.lensOrder.updateMany({ where: { id }, data });
    if (current.status !== status) {
      await recordAudit({
        tenantId: req.auth!.tenantId,
        userId: req.auth!.userId,
        action: 'LENS_ORDER_STATUS_CHANGED',
        entity: 'LensOrder',
        entityId: id,
        metadata: { number: current.number, from: current.status, to: status },
        ...requestMeta(req),
      });
    }
    return reply.send({ ok: true, status });
  });

  // Timeline de la fiche commande : entrées du journal d'audit pour cette
  // commande (créations, changements de statut, rappels client), triées
  // chronologiquement, avec le nom de l'utilisateur à l'origine.
  app.get('/lens-orders/:id/timeline', { preHandler: requirePermission('optique.sales.view') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const order = await req.db!.lensOrder.findFirst({ where: { id }, select: { id: true } });
    if (!order) throw notFound('Commande introuvable');
    const events = await prisma.auditLog.findMany({
      where: { tenantId: req.auth!.tenantId, entity: 'LensOrder', entityId: id },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { firstName: true, lastName: true } } },
    });
    return reply.send({
      events: events.map((e) => ({
        id: e.id,
        action: e.action,
        metadata: e.metadata,
        createdAt: e.createdAt,
        userName: e.user ? `${e.user.firstName} ${e.user.lastName}` : null,
      })),
    });
  });

  // Rappel client envoyé (bouton « Notifier le client ») : horodate et journalise.
  app.post('/lens-orders/:id/notified', { preHandler: requirePermission('optique.sales.create') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const order = await req.db!.lensOrder.findFirst({ where: { id }, select: { number: true } });
    if (!order) throw notFound('Commande introuvable');
    const notifiedAt = new Date();
    await req.db!.lensOrder.updateMany({ where: { id }, data: { notifiedAt } });
    await recordAudit({
      tenantId: req.auth!.tenantId,
      userId: req.auth!.userId,
      action: 'LENS_ORDER_CLIENT_NOTIFIED',
      entity: 'LensOrder',
      entityId: id,
      metadata: { number: order.number },
      ...requestMeta(req),
    });
    return reply.send({ ok: true, notifiedAt });
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
    // Seuils paramétrables dans les réglages du cabinet (valeurs par défaut :
    // 18 mois pour l'ordonnance, 12 mois sans achat).
    const settings = await getOpticalSettings(req.auth!.tenantId);
    const rxCutoff = new Date(now - settings.prescriptionReminderMonths * MONTH);
    const saleCutoff = new Date(now - settings.purchaseReminderMonths * MONTH);

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
