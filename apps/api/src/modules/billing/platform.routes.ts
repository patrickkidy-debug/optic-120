import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  planUpsertSchema,
  SubscriptionStatus,
  operatorCreateSchema,
  userActiveSchema,
  type PartnerStatus,
  type PartnerCommissionStatus,
  partnerUpdateStatusSchema,
  partnerUpdateTierSchema,
  partnerCommissionRuleUpsertSchema,
  partnerCommissionActionSchema,
} from '@oculo/shared-types';
import { requireAuth } from '../../middlewares/auth-guard.js';
import { forbidden, notFound, badRequest } from '../../lib/http-error.js';
import { prisma } from '../../lib/prisma.js';
import { recordAudit, requestMeta } from '../../lib/audit.js';
import * as billing from './billing.service.js';
import * as platform from './platform.service.js';
import * as partners from '../partners/partner.service.js';
import * as support from '../support/support.service.js';
import { getEngagementForFounder } from '../demo/demo-video.service.js';
import { getOperatorEmails, isEnvOperator } from '../../lib/operators.js';

/** Garde opérateur : réservé aux emails déclarés comme administrateurs plateforme. */
async function requirePlatformOperator(req: FastifyRequest): Promise<void> {
  const email = req.auth?.email?.toLowerCase();
  if (!email || !getOperatorEmails().has(email)) {
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

  // Notifications de la console fondateur (ex. nouvel établissement).
  app.get('/notifications', async (_req, reply) => {
    return reply.send(await platform.listNotifications());
  });

  app.post('/notifications/read', async (req, reply) => {
    const { ids } = (req.body ?? {}) as { ids?: string[] };
    await platform.markNotificationsRead(ids);
    return reply.send({ ok: true });
  });

  // Durée de l'essai gratuit offert aux nouveaux inscrits (réglable, effet immédiat).
  app.get('/settings/trial', async (_req, reply) => {
    return reply.send({ minutes: await billing.getTrialDurationMinutes() });
  });

  app.patch('/settings/trial', async (req, reply) => {
    const { minutes } = (req.body ?? {}) as { minutes?: number };
    if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes < 0) {
      throw badRequest('minutes doit être un nombre positif');
    }
    const saved = await billing.setTrialDurationMinutes(Math.round(minutes));
    await recordAudit({
      tenantId: req.auth!.tenantId,
      userId: req.auth!.userId,
      action: 'PLATFORM_TRIAL_DURATION_UPDATED',
      metadata: { minutes: saved },
      ...requestMeta(req),
    });
    return reply.send({ minutes: saved });
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

  // Réservations de démonstration gratuite (suivi commercial).
  app.get('/demo-requests', async (_req, reply) => {
    const demos = await prisma.demoRequest.findMany({
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
    return reply.send({ demos });
  });

  // Engagement sur les vidéos de démonstration : qui rappeler en priorité.
  app.get('/demo-engagement', async (_req, reply) => {
    const rows = await getEngagementForFounder();
    return reply.send({ rows });
  });

  app.patch('/demo-requests/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { status } = (req.body ?? {}) as { status?: string };
    const allowed = ['PENDING', 'CONFIRMED', 'DONE', 'CANCELLED'];
    const next = allowed.includes(status ?? '') ? (status as string) : 'PENDING';
    const demo = await prisma.demoRequest.update({ where: { id }, data: { status: next } });
    return reply.send({ demo });
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

  // Activation MANUELLE (paiement reçu en direct) : rend l'accès sans Moneroo.
  app.post('/subscriptions/:tenantId/activate', async (req, reply) => {
    const { tenantId } = req.params as { tenantId: string };
    const { months, planCode } = (req.body ?? {}) as { months?: number; planCode?: string };
    const sub = await billing.activateSubscriptionManually(tenantId, months ?? 1, planCode);
    await recordAudit({
      tenantId,
      userId: req.auth!.userId,
      action: 'PLATFORM_ACTIVATE_MANUAL',
      entity: 'Subscription',
      metadata: { months: months ?? 1, planCode },
      ...requestMeta(req),
    });
    return reply.send({ subscription: sub });
  });

  // Reconduit l'essai gratuit d'un tenant précis, à la demande (statut TRIALING,
  // sans paiement — distinct de l'activation manuelle payante ci-dessus).
  app.post('/subscriptions/:tenantId/extend-trial', async (req, reply) => {
    const { tenantId } = req.params as { tenantId: string };
    const { minutes } = (req.body ?? {}) as { minutes?: number };
    if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes <= 0) {
      throw badRequest('minutes doit être un nombre positif');
    }
    const result = await billing.extendTrial(tenantId, Math.round(minutes));
    await recordAudit({
      tenantId,
      userId: req.auth!.userId,
      action: 'PLATFORM_TRIAL_EXTENDED',
      entity: 'Subscription',
      metadata: { minutes: Math.round(minutes) },
      ...requestMeta(req),
    });
    return reply.send(result);
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

  /* --------------------------- Équipe & accès --------------------------- */

  // Liste complète : emails env (bootstrap, lecture seule) + équipe ajoutée via la console.
  app.get('/operators', async (_req, reply) => {
    const [envEmails, team] = [
      [...getOperatorEmails()].filter((e) => isEnvOperator(e)),
      await platform.listOperators(),
    ];
    return reply.send({
      operators: [
        ...envEmails.map((email) => ({ id: email, email, name: null, readOnly: true, createdAt: null })),
        ...team.map((o) => ({ ...o, readOnly: false })),
      ],
    });
  });

  app.post('/operators', async (req, reply) => {
    const input = operatorCreateSchema.parse(req.body);
    const row = await platform.addOperator(input.email, input.name, req.auth!.userId);
    await recordAudit({
      tenantId: req.auth!.tenantId,
      userId: req.auth!.userId,
      action: 'PLATFORM_OPERATOR_ADDED',
      entity: 'PlatformOperator',
      entityId: row.id,
      metadata: { email: row.email },
      ...requestMeta(req),
    });
    return reply.status(201).send({ operator: row });
  });

  app.delete('/operators/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    await platform.removeOperator(id);
    await recordAudit({
      tenantId: req.auth!.tenantId,
      userId: req.auth!.userId,
      action: 'PLATFORM_OPERATOR_REMOVED',
      entity: 'PlatformOperator',
      entityId: id,
      ...requestMeta(req),
    });
    return reply.send({ ok: true });
  });

  /* ------------------------------- Finances ------------------------------- */

  app.get('/finance/summary', async (_req, reply) => {
    return reply.send({ summary: await platform.getFinanceSummary() });
  });

  app.get('/finance/revenue', async (req, reply) => {
    const { days } = req.query as { days?: string };
    const n = Math.min(180, Math.max(7, Number(days) || 30));
    return reply.send({ series: await platform.getRevenueSeries(n) });
  });

  app.get('/finance/invoices', async (req, reply) => {
    const { status } = req.query as { status?: string };
    return reply.send({ invoices: await platform.listAllInvoices(status, 150) });
  });

  /* ----------------------- Utilisateurs (cross-tenant) ----------------------- */

  app.patch('/users/:id/active', async (req, reply) => {
    const { id } = req.params as { id: string };
    if (id === req.auth!.userId) throw forbidden('Vous ne pouvez pas vous désactiver vous-même');
    const { isActive } = userActiveSchema.parse(req.body);
    const { tenantId } = await platform.setUserActiveCrossTenant(id, isActive);
    await recordAudit({
      tenantId,
      userId: req.auth!.userId,
      action: isActive ? 'PLATFORM_USER_REACTIVATED' : 'PLATFORM_USER_DEACTIVATED',
      entity: 'User',
      entityId: id,
      ...requestMeta(req),
    });
    return reply.send({ ok: true });
  });

  app.post('/users/:id/force-logout', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { tenantId } = await platform.forceLogoutUser(id);
    await recordAudit({
      tenantId,
      userId: req.auth!.userId,
      action: 'PLATFORM_USER_FORCE_LOGOUT',
      entity: 'User',
      entityId: id,
      ...requestMeta(req),
    });
    return reply.send({ ok: true });
  });

  // Débloque un compte (page de connexion, mot de passe oublié...) même sans
  // admin actif côté tenant — sans dépendre de l'envoi d'email.
  app.post('/users/:id/reset-password', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { tenantId, tempPassword } = await platform.resetUserPasswordCrossTenant(id);
    await recordAudit({
      tenantId,
      userId: req.auth!.userId,
      action: 'PLATFORM_USER_PASSWORD_RESET',
      entity: 'User',
      entityId: id,
      ...requestMeta(req),
    });
    return reply.send({ tempPassword });
  });

  // Réinitialise l'historique de vente + clients d'un établissement (stock
  // conservé). confirm=false (par défaut) : aperçu des compteurs seulement.
  // Action irréversible une fois confirm=true — journalisée.
  app.post('/tenants/reset-history', async (req, reply) => {
    const { email, confirm } = (req.body ?? {}) as { email?: string; confirm?: boolean };
    if (!email) throw badRequest('email requis');
    const result = await platform.resetTenantHistoryByEmail(email, confirm === true);
    if (result.executed) {
      await recordAudit({
        tenantId: result.tenantId,
        userId: req.auth!.userId,
        action: 'PLATFORM_TENANT_HISTORY_RESET',
        entity: 'Tenant',
        entityId: result.tenantId,
        metadata: { email, counts: result.counts },
        ...requestMeta(req),
      });
    }
    return reply.send(result);
  });

  /* ------------------------------ OculoPartners ----------------------------- */

  app.get('/partners', async (req, reply) => {
    const { status } = req.query as { status?: string };
    const rows = await partners.listPartnersForAdmin(status as PartnerStatus | undefined);
    return reply.send({ partners: rows });
  });

  app.patch('/partners/:id/status', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { status } = partnerUpdateStatusSchema.parse(req.body);
    const partner = await partners.setPartnerStatus(id, status, req.auth!.userId, requestMeta(req));
    return reply.send({ partner });
  });

  app.patch('/partners/:id/tier', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { tier } = partnerUpdateTierSchema.parse(req.body);
    const partner = await partners.setPartnerTier(id, tier, req.auth!.userId, requestMeta(req));
    return reply.send({ partner });
  });

  app.get('/partners/commission-rules', async (_req, reply) => {
    const rules = await partners.listCommissionRules();
    return reply.send({ rules });
  });

  app.put('/partners/commission-rules', async (req, reply) => {
    const input = partnerCommissionRuleUpsertSchema.parse(req.body);
    const rule = await partners.upsertCommissionRule(input, req.auth!.userId, requestMeta(req));
    return reply.status(201).send({ rule });
  });

  app.get('/partners/commissions', async (req, reply) => {
    const { status } = req.query as { status?: string };
    const commissions = await partners.listAllCommissionsForAdmin(status as PartnerCommissionStatus | undefined);
    return reply.send({ commissions });
  });

  app.post('/partners/commissions/:id/action', async (req, reply) => {
    const { id } = req.params as { id: string };
    const input = partnerCommissionActionSchema.parse(req.body);
    const commission = await partners.applyCommissionAction(id, input, req.auth!.userId, requestMeta(req));
    return reply.send({ commission });
  });
}
