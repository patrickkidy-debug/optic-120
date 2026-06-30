import type { FastifyInstance, FastifyRequest } from 'fastify';
import { subscribeSchema, subscriptionPaySchema, PaymentStatus } from '@oculo/shared-types';
import { requireAuth } from '../../middlewares/auth-guard.js';
import { requirePermission } from '../../middlewares/rbac-guard.js';
import { recordAudit, requestMeta } from '../../lib/audit.js';
import { notFound } from '../../lib/http-error.js';
import { isProd } from '../../config/env.js';
import * as billing from './billing.service.js';
import type { CapiContext } from './billing.service.js';
import { resolvePlatformProvider } from './platform-provider.js';

/** Contexte Meta CAPI à partir de la requête : IP/UA + cookies posés par le Pixel navigateur. */
function capiContext(req: FastifyRequest): CapiContext {
  const cookies = req.cookies as Record<string, string | undefined>;
  return {
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    fbp: cookies._fbp,
    fbc: cookies._fbc,
  };
}

/** Routes d'abonnement accessibles au tenant (préfixe /billing). */
export async function billingRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  // Statut minimal (offre + échéance), accessible à tout utilisateur connecté
  // (pas seulement billing.view) : sert au badge d'essai et au verrouillage des
  // fonctionnalités premium pour TOUT le personnel, pas uniquement les gérants.
  app.get('/plan-status', async (req, reply) => {
    const status = await billing.getSubscriptionStatus(req.auth!.tenantId);
    return reply.send({ status });
  });

  app.get('/plans', { preHandler: requirePermission('billing.view') }, async (_req, reply) => {
    const plans = await billing.listPlans();
    return reply.send({
      plans: plans.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        description: p.description,
        priceMonthly: Number(p.priceMonthly),
        currency: p.currency,
        trialDays: p.trialDays,
        maxUsers: p.maxUsers,
        maxBranches: p.maxBranches,
        maxPatients: p.maxPatients,
        maxSales: p.maxSales,
        features: (p.features as string[] | null) ?? [],
      })),
    });
  });

  app.get('/subscription', { preHandler: requirePermission('billing.view') }, async (req, reply) => {
    const subscription = await billing.getSubscription(req.auth!.tenantId);
    return reply.send({ subscription });
  });

  app.get('/invoices', { preHandler: requirePermission('billing.view') }, async (req, reply) => {
    const invoices = await billing.listInvoices(req.auth!.tenantId);
    return reply.send({ invoices });
  });

  app.post('/subscribe', { preHandler: requirePermission('billing.manage') }, async (req, reply) => {
    const input = subscribeSchema.parse(req.body);
    const result = await billing.subscribe(
      req.auth!.tenantId,
      input.planId,
      input.method,
      input.customerPhone,
      capiContext(req),
    );
    await recordAudit({
      tenantId: req.auth!.tenantId,
      userId: req.auth!.userId,
      action: 'SUBSCRIPTION_SUBSCRIBE',
      entity: 'Subscription',
      metadata: { planId: input.planId },
      ...requestMeta(req),
    });
    return reply.status(201).send(result);
  });

  app.post('/subscribe-manual', { preHandler: requirePermission('billing.manage') }, async (req, reply) => {
    const { planId } = req.body as { planId?: string };
    if (!planId) return reply.status(400).send({ error: 'planId manquant' });
    const result = await billing.subscribeManual(req.auth!.tenantId, planId);
    await recordAudit({
      tenantId: req.auth!.tenantId,
      userId: req.auth!.userId,
      action: 'SUBSCRIPTION_MANUAL_REQUEST',
      entity: 'SubscriptionInvoice',
      metadata: { planId },
      ...requestMeta(req),
    });
    return reply.status(201).send(result);
  });

  app.post('/invoices/:id/pay', { preHandler: requirePermission('billing.manage') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const input = subscriptionPaySchema.parse(req.body);
    const result = await billing.payInvoice(req.auth!.tenantId, id, input.method, input.customerPhone, capiContext(req));
    return reply.status(201).send(result);
  });

  app.get('/payments/:id/status', { preHandler: requirePermission('billing.view') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const status = await billing.getPaymentStatus(req.auth!.tenantId, id);
    return reply.send(status);
  });

  app.post('/payments/:id/simulate-callback', { preHandler: requirePermission('billing.manage') }, async (req, reply) => {
    // Confirmation simulée : strictement réservée au développement/tests. En
    // production, seul un paiement réel (webhook Moneroo/PayTech) peut activer un
    // abonnement — sinon n'importe quel gérant débloquerait son accès sans payer.
    if (isProd) throw notFound('Ressource introuvable');
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as { status?: PaymentStatus };
    await billing.getPaymentStatus(req.auth!.tenantId, id); // vérifie l'appartenance
    const status = body.status === PaymentStatus.FAILED ? PaymentStatus.FAILED : PaymentStatus.SUCCESS;
    const result = await billing.settleSubscriptionPayment(id, status, { simulated: true });
    return reply.send({ ok: true, status: result?.status ?? status });
  });
}

/** Webhook public PayTech (IPN) pour les paiements d'abonnement (/webhooks). */
export async function billingWebhookRoutes(app: FastifyInstance): Promise<void> {
  app.post('/paytech-subscription', async (req, reply) => {
    const body = (req.body ?? {}) as { token?: string; ref_command?: string };
    const providerRef = body.token ?? body.ref_command;
    if (!providerRef) return reply.status(400).send({ error: 'providerRef manquant' });
    const payment = await billing.findPaymentByProviderRef(providerRef);
    if (!payment) return reply.status(404).send({ error: 'Paiement inconnu' });
    // Le provider authentifie l'IPN (sha256 des clés) avant de renvoyer un statut.
    const provider = resolvePlatformProvider();
    const result = await provider.handleWebhook(req.body);
    await billing.settleSubscriptionPayment(payment.id, result.status, result.raw);
    return reply.send({ ok: true });
  });

  // Webhook public Moneroo pour les paiements d'abonnement.
  app.post('/moneroo-subscription', async (req, reply) => {
    const body = (req.body ?? {}) as { data?: { id?: string }; providerRef?: string };
    const providerRef = body.data?.id ?? body.providerRef;
    if (!providerRef) return reply.status(400).send({ error: 'providerRef manquant' });
    const payment = await billing.findPaymentByProviderRef(providerRef);
    if (!payment) return reply.status(404).send({ error: 'Paiement inconnu' });
    // Statut authentique re-vérifié côté serveur (corps du webhook non fiable).
    const provider = resolvePlatformProvider();
    const verified = await provider.verifyPayment(providerRef);
    await billing.settleSubscriptionPayment(payment.id, verified.status, verified.raw);
    return reply.send({ ok: true });
  });
}
