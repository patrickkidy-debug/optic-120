import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  PaymentMethod,
  billingSettingsSchema,
  cancelInvoiceSchema,
  manualInvoiceSchema,
  recordPaymentSchema,
  refundSchema,
  type InvoiceFilter,
  type InvoiceMessageKind,
} from '@oculo/shared-types';
import { badRequest } from '../../lib/http-error.js';
import { prisma } from '../../lib/prisma.js';
import * as invoicing from './invoicing.service.js';

/**
 * Routes de facturation de l'éditeur, montées sous /platform/billing.
 *
 * Aucune garde d'authentification n'est posée ici : ce module est enregistré
 * comme greffon ENFANT de platformRoutes, dont les hooks `requireAuth` et
 * `requirePlatformOperator` s'appliquent à toute la branche (§26). Les déclarer
 * une seconde fois donnerait l'illusion qu'ils sont optionnels ailleurs.
 */

function actorOf(req: FastifyRequest): invoicing.Actor {
  return { id: req.auth?.userId ?? null, name: req.auth?.email ?? null };
}

export async function invoicingRoutes(app: FastifyInstance): Promise<void> {
  /* ----------------------------- Vue d'ensemble ----------------------------- */

  app.get('/overview', async (req, reply) => {
    const { from, to } = req.query as { from?: string; to?: string };
    return reply.send({ overview: await invoicing.getBillingOverview({ from, to }) });
  });

  /* ------------------------------ Paramètres ------------------------------ */

  app.get('/settings', async (_req, reply) => {
    return reply.send({ settings: await invoicing.getBillingSettings() });
  });

  app.put('/settings', async (req, reply) => {
    const input = billingSettingsSchema.parse(req.body);
    const settings = await invoicing.updateBillingSettings(input, actorOf(req));
    return reply.send({ settings });
  });

  /* -------------------------------- Factures -------------------------------- */

  app.get('/invoices', async (req, reply) => {
    const q = req.query as {
      filter?: string;
      search?: string;
      from?: string;
      to?: string;
      tenantId?: string;
      page?: string;
      pageSize?: string;
    };
    const result = await invoicing.listInvoices({
      filter: q.filter as InvoiceFilter | undefined,
      search: q.search,
      from: q.from,
      to: q.to,
      tenantId: q.tenantId,
      page: q.page ? Number(q.page) : undefined,
      pageSize: q.pageSize ? Number(q.pageSize) : undefined,
    });
    return reply.send(result);
  });

  app.post('/invoices', async (req, reply) => {
    const input = manualInvoiceSchema.parse(req.body);
    const invoice = await invoicing.createManualInvoice(input, actorOf(req));
    return reply.status(201).send({ invoice });
  });

  app.get('/invoices/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    return reply.send({ invoice: await invoicing.getInvoice(id) });
  });

  app.post('/invoices/:id/payments', async (req, reply) => {
    const { id } = req.params as { id: string };
    const input = recordPaymentSchema.parse(req.body);
    const invoice = await invoicing.recordInvoicePayment(id, input, actorOf(req));
    return reply.status(201).send({ invoice });
  });

  app.post('/invoices/:id/mark-paid', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { method } = (req.body ?? {}) as { method?: string };
    const resolved = (method ?? PaymentMethod.OTHER) as PaymentMethod;
    if (!Object.values(PaymentMethod).includes(resolved)) throw badRequest('Moyen de paiement inconnu');
    const invoice = await invoicing.markInvoicePaid(id, resolved, actorOf(req));
    return reply.send({ invoice });
  });

  app.post('/invoices/:id/refund', async (req, reply) => {
    const { id } = req.params as { id: string };
    const input = refundSchema.parse(req.body);
    const invoice = await invoicing.refundInvoice(id, input, actorOf(req));
    return reply.status(201).send({ invoice });
  });

  app.post('/invoices/:id/cancel', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { reason } = cancelInvoiceSchema.parse(req.body);
    const invoice = await invoicing.cancelInvoice(id, reason, actorOf(req));
    return reply.send({ invoice });
  });

  app.post('/invoices/:id/credit-note', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { amount } = (req.body ?? {}) as { amount?: number };
    const invoice = await invoicing.issueCreditNote(id, actorOf(req), amount);
    return reply.status(201).send({ invoice });
  });

  app.post('/invoices/:id/duplicate', async (req, reply) => {
    const { id } = req.params as { id: string };
    const invoice = await invoicing.duplicateInvoice(id, actorOf(req));
    return reply.status(201).send({ invoice });
  });

  /* ------------------------------- WhatsApp ------------------------------- */

  app.get('/invoices/:id/message', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { kind } = req.query as { kind?: string };
    const allowed: InvoiceMessageKind[] = ['invoice', 'before', 'due', 'after'];
    const resolved = allowed.includes(kind as InvoiceMessageKind)
      ? (kind as InvoiceMessageKind)
      : 'invoice';
    const { message, whatsapp } = await invoicing.buildInvoiceMessage(id, resolved);
    return reply.send({ message, whatsapp, kind: resolved });
  });

  app.post('/invoices/:id/sent', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { channel } = (req.body ?? {}) as { channel?: string };
    const resolved = channel === 'email' ? 'email' : 'whatsapp';
    return reply.send(await invoicing.markInvoiceSent(id, resolved, actorOf(req)));
  });

  /* ------------------------- Abonnements et relances ------------------------- */

  app.get('/subscriptions', async (_req, reply) => {
    return reply.send({ subscriptions: await invoicing.listBillingSubscriptions() });
  });

  app.get('/reminders', async (_req, reply) => {
    return reply.send({ reminders: await invoicing.listDueReminders() });
  });

  /* ------------------------- Facturation d'un client ------------------------- */

  app.get('/tenants/:tenantId', async (req, reply) => {
    const { tenantId } = req.params as { tenantId: string };
    return reply.send(await invoicing.getTenantBilling(tenantId));
  });

  /**
   * Annuaire léger pour le sélecteur d'établissement du formulaire de facture.
   * Les établissements de démonstration sont exclus : ce ne sont pas des
   * clients, leur facturer quelque chose n'a aucun sens.
   */
  app.get('/clients', async (_req, reply) => {
    const tenants = await prisma.tenant.findMany({
      where: { isDemo: false },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        whatsappPhone: true,
        contactPhone: true,
        contactEmail: true,
        location: true,
        countryCode: true,
        currency: true,
        subscription: {
          select: {
            status: true,
            currentPeriodEnd: true,
            plan: { select: { id: true, name: true, code: true, priceMonthly: true, currency: true } },
          },
        },
      },
    });
    return reply.send({
      clients: tenants.map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        whatsapp: t.whatsappPhone ?? t.contactPhone,
        email: t.contactEmail,
        address: t.location,
        country: t.countryCode,
        currency: t.currency,
        planId: t.subscription?.plan.id ?? null,
        planName: t.subscription?.plan.name ?? null,
        priceMonthly: t.subscription ? Number(t.subscription.plan.priceMonthly) : null,
        status: t.subscription?.status ?? null,
        currentPeriodEnd: t.subscription?.currentPeriodEnd ?? null,
      })),
    });
  });
}
