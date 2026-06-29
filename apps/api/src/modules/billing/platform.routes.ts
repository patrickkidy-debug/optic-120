import type { FastifyInstance, FastifyRequest } from 'fastify';
import { planUpsertSchema, SubscriptionStatus } from '@oculo/shared-types';
import { requireAuth } from '../../middlewares/auth-guard.js';
import { forbidden, notFound } from '../../lib/http-error.js';
import { prisma } from '../../lib/prisma.js';
import { env } from '../../config/env.js';
import { recordAudit, requestMeta } from '../../lib/audit.js';
import * as billing from './billing.service.js';
import * as support from '../support/support.service.js';

function operatorEmails(): Set<string> {
  return new Set(
    env.PLATFORM_ADMIN_EMAILS.split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** Garde opérateur : réservé aux emails déclarés comme administrateurs plateforme. */
async function requirePlatformOperator(req: FastifyRequest): Promise<void> {
  const email = req.auth?.email?.toLowerCase();
  if (!email || !operatorEmails().has(email)) {
    throw forbidden('Réservé aux opérateurs de la plateforme');
  }
}

export async function platformRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);
  app.addHook('preHandler', requirePlatformOperator);

  // Indicateurs clés (console fondateur).
  app.get('/stats', async (_req, reply) => {
    const stats = await billing.getPlatformStats();
    return reply.send({ stats });
  });

  // Liste des utilisateurs de toute la plateforme (suivi).
  app.get('/users', async (_req, reply) => {
    const users = await billing.listAllUsers();
    return reply.send({ users });
  });

  // Paiements manuels en attente de confirmation.
  app.get('/payments/pending', async (_req, reply) => {
    return reply.send({ payments: await billing.listPendingManualPayments() });
  });

  app.post('/payments/:id/confirm', async (req, reply) => {
    const { id } = req.params as { id: string };
    const result = await billing.confirmManualPayment(id);
    await recordAudit({
      tenantId: req.auth!.tenantId,
      userId: req.auth!.userId,
      action: 'PLATFORM_CONFIRM_PAYMENT',
      entity: 'SubscriptionPayment',
      entityId: id,
      ...requestMeta(req),
    });
    return reply.send({ ok: true, status: result?.status });
  });

  // Tickets de support (console fondateur).
  app.get('/support', async (_req, reply) => {
    return reply.send({ tickets: await support.listTickets() });
  });

  app.patch('/support/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { status } = (req.body ?? {}) as { status?: string };
    const next = status === 'CLOSED' ? 'CLOSED' : 'OPEN';
    const ticket = await support.setTicketStatus(id, next);
    return reply.send({ ticket });
  });

  // Liste de tous les abonnements (cross-tenant).
  app.get('/subscriptions', async (_req, reply) => {
    const subscriptions = await billing.listAllSubscriptions();
    return reply.send({ subscriptions });
  });

  app.post('/subscriptions/:tenantId/suspend', async (req, reply) => {
    const { tenantId } = req.params as { tenantId: string };
    const sub = await billing.setSubscriptionStatus(tenantId, SubscriptionStatus.SUSPENDED);
    await recordAudit({
      tenantId,
      userId: req.auth!.userId,
      action: 'PLATFORM_SUSPEND',
      ...requestMeta(req),
    });
    return reply.send({ subscription: sub });
  });

  app.post('/subscriptions/:tenantId/reactivate', async (req, reply) => {
    const { tenantId } = req.params as { tenantId: string };
    const sub = await billing.setSubscriptionStatus(tenantId, SubscriptionStatus.ACTIVE);
    await recordAudit({
      tenantId,
      userId: req.auth!.userId,
      action: 'PLATFORM_REACTIVATE',
      ...requestMeta(req),
    });
    return reply.send({ subscription: sub });
  });

  // Déclenche le cycle de facturation (past-due / suspension).
  app.post('/billing/run', async (_req, reply) => {
    const result = await billing.runBillingCycle();
    return reply.send(result);
  });

  // Gestion des offres.
  app.get('/plans', async (_req, reply) => {
    const plans = await billing.listPlans(false);
    return reply.send({ plans });
  });

  app.patch('/plans/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const input = planUpsertSchema.partial().parse(req.body);
    const plan = await prisma.subscriptionPlan.findUnique({ where: { id } });
    if (!plan) throw notFound('Offre introuvable');
    const updated = await prisma.subscriptionPlan.update({
      where: { id },
      data: {
        name: input.name ?? undefined,
        description: input.description ?? undefined,
        priceMonthly: input.priceMonthly ?? undefined,
        trialDays: input.trialDays ?? undefined,
        maxUsers: input.maxUsers === undefined ? undefined : input.maxUsers,
        maxBranches: input.maxBranches === undefined ? undefined : input.maxBranches,
        maxPatients: input.maxPatients === undefined ? undefined : input.maxPatients,
        maxSales: input.maxSales === undefined ? undefined : input.maxSales,
        features: input.features ?? undefined,
        isActive: input.isActive ?? undefined,
      },
    });
    return reply.send({ plan: updated });
  });
}
