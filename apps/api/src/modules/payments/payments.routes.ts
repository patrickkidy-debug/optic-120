import type { FastifyInstance } from 'fastify';
import { paymentConfigSchema, collectInfoSchema, PaymentStatus } from '@oculo/shared-types';
import { requireAuth } from '../../middlewares/auth-guard.js';
import { requirePermission } from '../../middlewares/rbac-guard.js';
import { notFound } from '../../lib/http-error.js';
import { isProd } from '../../config/env.js';
import * as paymentService from './payment.service.js';
import { recordAudit, requestMeta } from '../../lib/audit.js';

/** Routes authentifiées de gestion des paiements (préfixe /payments). */
export async function paymentsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  app.get(
    '/config',
    { preHandler: requirePermission('settings.payments.view') },
    async (req, reply) => {
      const config = await paymentService.getMaskedPaymentConfig(req.auth!.tenantId);
      return reply.send({ config });
    },
  );

  app.put(
    '/config',
    { preHandler: requirePermission('settings.payments.update') },
    async (req, reply) => {
      const input = paymentConfigSchema.parse(req.body);
      const config = await paymentService.savePaymentConfig(req.auth!.tenantId, input);
      await recordAudit({
        tenantId: req.auth!.tenantId,
        userId: req.auth!.userId,
        action: 'PAYMENT_CONFIG_UPDATED',
        ...requestMeta(req),
      });
      return reply.send({ config });
    },
  );

  // Coordonnées d'encaissement manuel de la boutique (QR + numéro).
  app.get('/collect-info', { preHandler: requirePermission('optique.sales.create') }, async (req, reply) => {
    return reply.send({ collect: await paymentService.getCollectInfo(req.auth!.tenantId) });
  });

  app.put('/collect-info', { preHandler: requirePermission('settings.payments.update') }, async (req, reply) => {
    const input = collectInfoSchema.parse(req.body);
    const collect = await paymentService.saveCollectInfo(req.auth!.tenantId, input);
    await recordAudit({
      tenantId: req.auth!.tenantId,
      userId: req.auth!.userId,
      action: 'COLLECT_INFO_UPDATED',
      ...requestMeta(req),
    });
    return reply.send({ collect });
  });

  app.get('/:id/status', async (req, reply) => {
    const { id } = req.params as { id: string };
    const payment = await req.db!.payment.findFirst({ where: { id } });
    if (!payment) throw notFound('Paiement introuvable');
    return reply.send({
      status: payment.status,
      amount: Number(payment.amount),
      method: payment.method,
    });
  });

  // Déclencheur manuel de confirmation (mode simulation uniquement).
  app.post('/:id/simulate-callback', async (req, reply) => {
    // Simulation réservée au hors-production : en prod, seul un webhook réel
    // (Moneroo/PayTech) peut confirmer un paiement (jamais un appel utilisateur).
    if (isProd) throw notFound('Ressource introuvable');
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as { status?: PaymentStatus };
    const payment = await req.db!.payment.findFirst({ where: { id } });
    if (!payment) throw notFound('Paiement introuvable');

    const status = body.status === PaymentStatus.FAILED ? PaymentStatus.FAILED : PaymentStatus.SUCCESS;
    const result = await paymentService.settlePayment(id, status, {
      simulated: true,
      triggeredBy: req.auth!.userId,
    });
    return reply.send({ ok: true, status: result?.status ?? status });
  });
}

/** Webhook public PayTech (IPN, pas d'auth JWT, préfixe /webhooks). */
export async function paymentWebhookRoutes(app: FastifyInstance): Promise<void> {
  app.post('/paytech', async (req, reply) => {
    const body = (req.body ?? {}) as { token?: string; ref_command?: string };
    const providerRef = body.token ?? body.ref_command;
    if (!providerRef) return reply.status(400).send({ error: 'providerRef manquant' });

    const payment = await paymentService.findPaymentByProviderRef(providerRef);
    if (!payment) return reply.status(404).send({ error: 'Paiement inconnu' });

    // SÉCURITÉ : le provider authentifie l'IPN (sha256 des clés) avant de
    // renvoyer un statut. Un IPN falsifié lève une erreur (non crédité).
    const provider = await paymentService.resolveProvider(payment.tenantId);
    const result = await provider.handleWebhook(req.body);
    await paymentService.settlePayment(payment.id, result.status, result.raw);

    return reply.send({ ok: true });
  });

  app.post('/moneroo', async (req, reply) => {
    const body = (req.body ?? {}) as { data?: { id?: string }; providerRef?: string };
    const providerRef = body.data?.id ?? body.providerRef;
    if (!providerRef) return reply.status(400).send({ error: 'providerRef Moneroo manquant' });

    const payment = await paymentService.findPaymentByProviderRef(providerRef);
    if (!payment) return reply.status(404).send({ error: 'Paiement inconnu' });

    // SÉCURITÉ : statut authentique re-vérifié auprès de Moneroo (corps non fiable).
    const provider = await paymentService.resolveProvider(payment.tenantId);
    const verified = await provider.verifyPayment(providerRef);
    await paymentService.settlePayment(payment.id, verified.status, verified.raw);

    return reply.send({ ok: true });
  });
}
