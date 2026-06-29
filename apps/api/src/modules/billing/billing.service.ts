import { PaymentStatus, SubscriptionStatus, SubInvoiceStatus, MOBILE_MONEY_METHODS } from '@oculo/shared-types';
import type { PaymentMethod } from '@oculo/shared-types';
import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { badRequest, notFound, conflict } from '../../lib/http-error.js';
import { resolvePlatformProvider, isPlatformSimulation } from './platform-provider.js';

const DAY = 24 * 60 * 60 * 1000;

function addOneMonth(from: Date): Date {
  const d = new Date(from);
  d.setMonth(d.getMonth() + 1);
  return d;
}

type LimitResource = 'users' | 'branches' | 'patients' | 'sales';

/* ----------------------------- Offres ----------------------------- */

export async function listPlans(activeOnly = true) {
  return prisma.subscriptionPlan.findMany({
    where: activeOnly ? { isActive: true } : {},
    orderBy: { sortOrder: 'asc' },
  });
}

/* --------------------- Abonnement d'un tenant --------------------- */

export async function ensureTrialSubscription(
  tx: Prisma.TransactionClient | PrismaClient,
  tenantId: string,
): Promise<void> {
  const existing = await tx.subscription.findUnique({ where: { tenantId } });
  if (existing) return;
  const trial = await tx.subscriptionPlan.findFirst({ where: { code: 'TRIAL' } });
  if (!trial) return;
  const end = new Date(Date.now() + trial.trialDays * DAY);
  await tx.subscription.create({
    data: {
      tenantId,
      planId: trial.id,
      status: SubscriptionStatus.TRIALING,
      currentPeriodEnd: end,
      trialEndsAt: end,
    },
  });
}

export async function getUsage(tenantId: string): Promise<Record<LimitResource, number>> {
  const [users, branches, patients, sales] = await Promise.all([
    prisma.user.count({ where: { tenantId } }),
    prisma.branch.count({ where: { tenantId } }),
    prisma.patient.count({ where: { tenantId } }),
    prisma.sale.count({ where: { tenantId, type: 'SALE' } }),
  ]);
  return { users, branches, patients, sales };
}

export async function getSubscription(tenantId: string) {
  const subscription = await prisma.subscription.findUnique({
    where: { tenantId },
    include: { plan: true },
  });
  if (!subscription) return null;
  const usage = await getUsage(tenantId);
  return {
    id: subscription.id,
    status: subscription.status,
    autoRenew: subscription.autoRenew,
    currentPeriodStart: subscription.currentPeriodStart,
    currentPeriodEnd: subscription.currentPeriodEnd,
    trialEndsAt: subscription.trialEndsAt,
    plan: {
      id: subscription.plan.id,
      code: subscription.plan.code,
      name: subscription.plan.name,
      priceMonthly: Number(subscription.plan.priceMonthly),
      maxUsers: subscription.plan.maxUsers,
      maxBranches: subscription.plan.maxBranches,
      maxPatients: subscription.plan.maxPatients,
      maxSales: subscription.plan.maxSales,
    },
    usage,
  };
}

/** Statut léger pour l'enforcement (requireAuth). */
export async function getSubscriptionStatus(
  tenantId: string,
): Promise<{ status: SubscriptionStatus; planCode: string } | null> {
  const sub = await prisma.subscription.findUnique({
    where: { tenantId },
    select: { status: true, plan: { select: { code: true } } },
  });
  return sub ? { status: sub.status as SubscriptionStatus, planCode: sub.plan.code } : null;
}

/** Vérifie qu'une création ne dépasse pas la limite de l'offre courante. */
export async function assertWithinLimit(tenantId: string, resource: LimitResource): Promise<void> {
  const sub = await prisma.subscription.findUnique({
    where: { tenantId },
    include: { plan: true },
  });
  if (!sub) return;
  const limit = {
    users: sub.plan.maxUsers,
    branches: sub.plan.maxBranches,
    patients: sub.plan.maxPatients,
    sales: sub.plan.maxSales,
  }[resource];
  if (limit == null) return; // illimité
  const usage = await getUsage(tenantId);
  if (usage[resource] >= limit) {
    const labels: Record<LimitResource, string> = {
      users: 'utilisateurs',
      branches: 'magasins',
      patients: 'patients',
      sales: 'ventes',
    };
    throw badRequest(
      `Limite de l'offre ${sub.plan.name} atteinte (${limit} ${labels[resource]}). Passez à une offre supérieure.`,
    );
  }
}

/* --------------------- Facturation & paiement --------------------- */

async function nextInvoiceNumber(tenantId: string): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.subscriptionInvoice.count({
    where: { tenantId, number: { startsWith: `ABN-${year}-` } },
  });
  return `ABN-${year}-${String(count + 1).padStart(5, '0')}`;
}

/** Crée une facture pour une offre et lance le paiement plateforme. */
export async function subscribe(
  tenantId: string,
  planId: string,
  method: PaymentMethod,
  customerPhone: string | undefined,
) {
  const sub = await prisma.subscription.findUnique({ where: { tenantId } });
  if (!sub) throw notFound('Abonnement introuvable');
  const plan = await prisma.subscriptionPlan.findFirst({ where: { id: planId, isActive: true } });
  if (!plan) throw badRequest('Offre invalide');

  const now = new Date();
  const invoice = await prisma.subscriptionInvoice.create({
    data: {
      tenantId,
      subscriptionId: sub.id,
      planId: plan.id,
      number: await nextInvoiceNumber(tenantId),
      amount: plan.priceMonthly,
      currency: plan.currency,
      status: SubInvoiceStatus.PENDING,
      periodStart: now,
      periodEnd: addOneMonth(now),
      dueDate: now,
    },
  });

  return initiateInvoicePayment(tenantId, invoice.id, method, customerPhone);
}

export async function payInvoice(
  tenantId: string,
  invoiceId: string,
  method: PaymentMethod,
  customerPhone: string | undefined,
) {
  return initiateInvoicePayment(tenantId, invoiceId, method, customerPhone);
}

async function initiateInvoicePayment(
  tenantId: string,
  invoiceId: string,
  method: PaymentMethod,
  customerPhone: string | undefined,
) {
  const invoice = await prisma.subscriptionInvoice.findFirst({
    where: { id: invoiceId, tenantId },
  });
  if (!invoice) throw notFound('Facture introuvable');
  if (invoice.status === SubInvoiceStatus.PAID) throw conflict('Facture déjà payée');

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  // Contact de facturation : email du compte le plus ancien (propriétaire).
  const owner = await prisma.user.findFirst({
    where: { tenantId },
    orderBy: { createdAt: 'asc' },
    select: { email: true },
  });

  const payment = await prisma.subscriptionPayment.create({
    data: {
      tenantId,
      invoiceId: invoice.id,
      method,
      amount: invoice.amount,
      currency: invoice.currency,
      status: PaymentStatus.PENDING,
    },
  });

  const provider = resolvePlatformProvider();
  const result = await provider.initiatePayment({
    paymentId: payment.id,
    amount: Number(invoice.amount),
    currency: invoice.currency,
    method,
    customerName: tenant?.name ?? 'Abonné OculoSaaS',
    customerPhone,
    customerEmail: owner?.email ?? undefined,
    saleNumber: invoice.number,
  });

  await prisma.subscriptionPayment.update({
    where: { id: payment.id },
    data: { provider: provider.name, providerRef: result.providerRef, status: result.status },
  });

  const isMobile = MOBILE_MONEY_METHODS.includes(method);
  if (result.status === PaymentStatus.SUCCESS && !isMobile) {
    await settleSubscriptionPayment(payment.id, PaymentStatus.SUCCESS, result.raw);
  }

  return {
    invoiceId: invoice.id,
    paymentId: payment.id,
    status: result.status,
    providerRef: result.providerRef,
    instruction: result.instruction,
    redirectUrl: result.redirectUrl,
    simulation: isPlatformSimulation(),
  };
}

/**
 * Règle un paiement d'abonnement (idempotent). En cas de succès : facture
 * payée, abonnement activé/prolongé d'un mois sur l'offre facturée.
 */
export async function settleSubscriptionPayment(
  paymentId: string,
  status: PaymentStatus,
  raw: unknown,
) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.subscriptionPayment.findUnique({
      where: { id: paymentId },
      include: { invoice: true },
    });
    if (!payment) return null;
    const alreadyPaid = payment.invoice.status === SubInvoiceStatus.PAID;

    await tx.subscriptionPayment.update({
      where: { id: paymentId },
      data: { status, rawPayload: (raw ?? undefined) as object | undefined },
    });

    if (status === PaymentStatus.SUCCESS && !alreadyPaid) {
      const now = new Date();
      await tx.subscriptionInvoice.update({
        where: { id: payment.invoiceId },
        data: { status: SubInvoiceStatus.PAID, paidAt: now },
      });
      const sub = await tx.subscription.findFirst({
        where: { id: payment.invoice.subscriptionId },
      });
      if (sub) {
        const base = sub.currentPeriodEnd > now ? sub.currentPeriodEnd : now;
        await tx.subscription.update({
          where: { id: sub.id },
          data: {
            planId: payment.invoice.planId,
            status: SubscriptionStatus.ACTIVE,
            currentPeriodStart: now,
            currentPeriodEnd: addOneMonth(base),
            trialEndsAt: null,
            cancelledAt: null,
            autoRenew: true,
          },
        });
      }
    } else if (status === PaymentStatus.FAILED) {
      await tx.subscriptionInvoice.update({
        where: { id: payment.invoiceId },
        data: { status: SubInvoiceStatus.FAILED },
      });
    }
    return { invoiceId: payment.invoiceId, status };
  });
}

export async function listInvoices(tenantId: string) {
  return prisma.subscriptionInvoice.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

export async function findPaymentByProviderRef(providerRef: string) {
  return prisma.subscriptionPayment.findFirst({ where: { providerRef } });
}

export async function getPaymentStatus(tenantId: string, paymentId: string) {
  const p = await prisma.subscriptionPayment.findFirst({ where: { id: paymentId, tenantId } });
  if (!p) throw notFound('Paiement introuvable');
  return { status: p.status, amount: Number(p.amount), invoiceId: p.invoiceId };
}

/* ------------------------ Console plateforme ----------------------- */

export async function listAllSubscriptions() {
  const subs = await prisma.subscription.findMany({
    include: { plan: true, tenant: { select: { id: true, name: true, slug: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return subs.map((s) => ({
    tenantId: s.tenantId,
    tenantName: s.tenant.name,
    tenantSlug: s.tenant.slug,
    status: s.status,
    planName: s.plan.name,
    planCode: s.plan.code,
    currentPeriodEnd: s.currentPeriodEnd,
    autoRenew: s.autoRenew,
  }));
}

export async function setSubscriptionStatus(tenantId: string, status: SubscriptionStatus) {
  const sub = await prisma.subscription.findUnique({ where: { tenantId } });
  if (!sub) throw notFound('Abonnement introuvable');
  await prisma.subscription.update({
    where: { tenantId },
    data: { status, cancelledAt: status === SubscriptionStatus.CANCELLED ? new Date() : null },
  });
  return getSubscription(tenantId);
}

/**
 * Cycle de facturation : suspend les abonnements échus impayés et marque
 * PAST_DUE ceux dont la période vient d'expirer. Déclenché manuellement
 * (endpoint opérateur) ou par un planificateur.
 */
export async function runBillingCycle() {
  const now = new Date();
  // Période expirée → PAST_DUE (sauf déjà suspendu/annulé)
  const pastDue = await prisma.subscription.updateMany({
    where: {
      currentPeriodEnd: { lt: now },
      status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING] },
    },
    data: { status: SubscriptionStatus.PAST_DUE },
  });
  // PAST_DUE depuis plus de 3 jours → SUSPENDED
  const suspended = await prisma.subscription.updateMany({
    where: {
      status: SubscriptionStatus.PAST_DUE,
      currentPeriodEnd: { lt: new Date(now.getTime() - 3 * DAY) },
    },
    data: { status: SubscriptionStatus.SUSPENDED },
  });
  return { markedPastDue: pastDue.count, suspended: suspended.count };
}
