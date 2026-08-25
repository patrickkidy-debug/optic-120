import {
  PaymentStatus,
  SubscriptionStatus,
  SubInvoiceStatus,
  MOBILE_MONEY_METHODS,
  PaymentMethod,
  BillingCycle,
  BILLING_CYCLE_MONTHS,
  BILLING_CYCLE_DISCOUNT,
  type BillingCycle as BillingCycleType,
} from '@oculo/shared-types';
import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { retryOnDuplicateNumber } from '../../lib/prisma-retry.js';
import { badRequest, notFound, conflict } from '../../lib/http-error.js';
import { resolvePlatformProvider, isPlatformSimulation } from './platform-provider.js';
import { sendConversionEvent } from '../../lib/meta-capi.js';
import { appOrigin } from '../../config/env.js';

const DAY = 24 * 60 * 60 * 1000;

/** Contexte Meta Conversions API capturé côté route (ip/UA/cookies du Pixel). */
export interface CapiContext {
  ipAddress?: string | null;
  userAgent?: string | null;
  fbp?: string | null;
  fbc?: string | null;
}

function addMonths(from: Date, months: number): Date {
  const d = new Date(from);
  d.setMonth(d.getMonth() + months);
  return d;
}

/**
 * Montant total dû pour un cycle de facturation, à partir du prix mensuel
 * RÉEL de l'offre (colonne DB `SubscriptionPlan.priceMonthly`, source de
 * vérité pour la facturation — pas la table `PLAN_PRICES` de shared-types,
 * qui ne sert qu'à l'affichage indicatif avant qu'un tenant existe).
 */
function cycleAmount(monthlyPrice: number | Prisma.Decimal, cycle: BillingCycleType): number {
  const monthly = Number(monthlyPrice);
  const months = BILLING_CYCLE_MONTHS[cycle];
  const total = monthly * months;
  return Math.round(total * (1 - BILLING_CYCLE_DISCOUNT[cycle]));
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

const PLATFORM_SETTINGS_ID = 'default';
const DEFAULT_TRIAL_MINUTES = 120; // 2 heures

/** Durée actuelle de l'essai gratuit offert à l'inscription, réglable depuis la console fondateur. */
export async function getTrialDurationMinutes(): Promise<number> {
  const row = await prisma.platformSettings.findUnique({ where: { id: PLATFORM_SETTINGS_ID } });
  return row?.trialDurationMinutes ?? DEFAULT_TRIAL_MINUTES;
}

/** Modifie la durée de l'essai gratuit (minutes). Ne s'applique qu'aux inscriptions suivantes. */
export async function setTrialDurationMinutes(minutes: number): Promise<number> {
  const clamped = Math.max(0, Math.min(minutes, 60 * 24 * 90)); // plafond de sécurité : 90 jours
  const row = await prisma.platformSettings.upsert({
    where: { id: PLATFORM_SETTINGS_ID },
    update: { trialDurationMinutes: clamped },
    create: { id: PLATFORM_SETTINGS_ID, trialDurationMinutes: clamped },
  });
  return row.trialDurationMinutes;
}

/**
 * Crée l'abonnement à l'inscription : essai gratuit (accès complet à l'offre
 * Standard) pendant la durée réglée en console fondateur, puis blocage
 * jusqu'au paiement de l'abonnement.
 */
export async function ensurePendingSubscription(
  tx: Prisma.TransactionClient | PrismaClient,
  tenantId: string,
  planCode?: string,
): Promise<void> {
  const existing = await tx.subscription.findUnique({ where: { tenantId } });
  if (existing) return;
  const plan =
    (await tx.subscriptionPlan.findFirst({ where: { code: 'STANDARD', isActive: true } })) ??
    (await tx.subscriptionPlan.findFirst({ where: { code: planCode ?? 'STARTER' } })) ??
    (await tx.subscriptionPlan.findFirst({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }));
  if (!plan) return;
  const trialMinutes = await getTrialDurationMinutes();
  const trialEnd = new Date(Date.now() + trialMinutes * 60_000);
  await tx.subscription.create({
    data: {
      tenantId,
      planId: plan.id,
      status: SubscriptionStatus.TRIALING,
      currentPeriodStart: new Date(),
      currentPeriodEnd: trialEnd,
      trialEndsAt: trialEnd,
    },
  });
}

/**
 * Reconduit (ou prolonge) l'essai gratuit d'un tenant précis, à la demande du
 * fondateur — indépendamment du réglage global (qui ne fixe que la durée à
 * l'inscription). Repart de l'échéance actuelle si elle n'est pas encore
 * passée (n'écourte jamais un essai en cours), sinon de maintenant. Le
 * statut repasse à TRIALING (gratuit) : distinct d'une activation payante,
 * pour ne pas fausser le MRR / les statistiques de revenu.
 */
export async function extendTrial(tenantId: string, additionalMinutes: number): Promise<{ tenantId: string; trialEndsAt: Date }> {
  const sub = await prisma.subscription.findUnique({ where: { tenantId } });
  if (!sub) throw notFound('Abonnement introuvable');
  const base = sub.currentPeriodEnd.getTime() > Date.now() ? sub.currentPeriodEnd : new Date();
  const trialEnd = new Date(base.getTime() + additionalMinutes * 60_000);
  await prisma.subscription.update({
    where: { tenantId },
    data: { status: SubscriptionStatus.TRIALING, currentPeriodEnd: trialEnd, trialEndsAt: trialEnd },
  });
  return { tenantId, trialEndsAt: trialEnd };
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
): Promise<{ status: SubscriptionStatus; planCode: string; currentPeriodEnd: Date; trialEndsAt: Date | null } | null> {
  const sub = await prisma.subscription.findUnique({
    where: { tenantId },
    select: { status: true, currentPeriodEnd: true, trialEndsAt: true, plan: { select: { code: true } } },
  });
  return sub
    ? {
        status: sub.status as SubscriptionStatus,
        planCode: sub.plan.code,
        currentPeriodEnd: sub.currentPeriodEnd,
        trialEndsAt: sub.trialEndsAt,
      }
    : null;
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
  capiContext?: CapiContext,
  cycle: BillingCycleType = BillingCycle.MONTHLY,
) {
  const sub = await prisma.subscription.findUnique({ where: { tenantId } });
  if (!sub) throw notFound('Abonnement introuvable');
  const plan = await prisma.subscriptionPlan.findFirst({ where: { id: planId, isActive: true } });
  if (!plan) throw badRequest('Offre invalide');

  const now = new Date();
  const months = BILLING_CYCLE_MONTHS[cycle];
  const invoice = await retryOnDuplicateNumber(async () =>
    prisma.subscriptionInvoice.create({
      data: {
        tenantId,
        subscriptionId: sub.id,
        planId: plan.id,
        number: await nextInvoiceNumber(tenantId),
        amount: cycleAmount(plan.priceMonthly, cycle),
        currency: plan.currency,
        status: SubInvoiceStatus.PENDING,
        periodStart: now,
        periodEnd: addMonths(now, months),
        periodMonths: months,
        dueDate: now,
      },
    }),
  );

  return initiateInvoicePayment(tenantId, invoice.id, method, customerPhone, capiContext);
}

export async function payInvoice(
  tenantId: string,
  invoiceId: string,
  method: PaymentMethod,
  customerPhone: string | undefined,
  capiContext?: CapiContext,
) {
  return initiateInvoicePayment(tenantId, invoiceId, method, customerPhone, capiContext);
}

/**
 * Souscription par paiement Mobile Money MANUEL : crée une facture + un paiement
 * en attente (sans passerelle). Le client paie sur le numéro de l'éditeur, puis
 * l'opérateur confirme depuis la console → l'abonnement s'active.
 */
export type ManualPaymentChannel = 'MOBILE_MONEY' | 'BANK_TRANSFER';

export async function subscribeManual(
  tenantId: string,
  planId: string,
  cycle: BillingCycleType = BillingCycle.MONTHLY,
  channel: ManualPaymentChannel = 'MOBILE_MONEY',
) {
  const sub = await prisma.subscription.findUnique({ where: { tenantId } });
  if (!sub) throw notFound('Abonnement introuvable');
  const plan = await prisma.subscriptionPlan.findFirst({ where: { id: planId, isActive: true } });
  if (!plan) throw badRequest('Offre invalide');

  const now = new Date();
  const months = BILLING_CYCLE_MONTHS[cycle];
  const invoice = await retryOnDuplicateNumber(async () =>
    prisma.subscriptionInvoice.create({
      data: {
        tenantId,
        subscriptionId: sub.id,
        planId: plan.id,
        number: await nextInvoiceNumber(tenantId),
        amount: cycleAmount(plan.priceMonthly, cycle),
        currency: plan.currency,
        status: SubInvoiceStatus.PENDING,
        periodStart: now,
        periodEnd: addMonths(now, months),
        periodMonths: months,
        dueDate: now,
      },
    }),
  );
  const payment = await prisma.subscriptionPayment.create({
    data: {
      tenantId,
      invoiceId: invoice.id,
      method: PaymentMethod.CASH,
      amount: invoice.amount,
      currency: invoice.currency,
      status: PaymentStatus.PENDING,
      provider: 'manual',
      providerRef: `MAN-${invoice.number}`,
      channel,
    },
  });
  return {
    paymentId: payment.id,
    invoiceId: invoice.id,
    number: invoice.number,
    amount: Number(invoice.amount),
    currency: invoice.currency,
    planName: plan.name,
  };
}

/** Paiements manuels en attente de confirmation (console fondateur). */
export async function listPendingManualPayments() {
  const rows = await prisma.subscriptionPayment.findMany({
    where: { status: PaymentStatus.PENDING, provider: 'manual' },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { invoice: true },
  });
  const tenants = await prisma.tenant.findMany({
    where: { id: { in: rows.map((r) => r.tenantId) } },
    select: { id: true, name: true },
  });
  const names = new Map(tenants.map((t) => [t.id, t.name]));
  return rows.map((r) => ({
    id: r.id,
    tenantName: names.get(r.tenantId) ?? r.tenantId,
    amount: Number(r.amount),
    currency: r.currency,
    invoiceNumber: r.invoice.number,
    channel: r.channel,
    createdAt: r.createdAt,
  }));
}

/** Confirme un paiement manuel reçu → active/prolonge l'abonnement. */
export async function confirmManualPayment(paymentId: string) {
  const payment = await prisma.subscriptionPayment.findUnique({ where: { id: paymentId } });
  if (!payment) throw notFound('Paiement introuvable');
  return settleSubscriptionPayment(paymentId, PaymentStatus.SUCCESS, { manual: true });
}

async function initiateInvoicePayment(
  tenantId: string,
  invoiceId: string,
  method: PaymentMethod,
  customerPhone: string | undefined,
  capiContext?: CapiContext,
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
  const plan = await prisma.subscriptionPlan.findUnique({
    where: { id: invoice.planId },
    select: { name: true },
  });

  const payment = await prisma.subscriptionPayment.create({
    data: {
      tenantId,
      invoiceId: invoice.id,
      method,
      amount: invoice.amount,
      currency: invoice.currency,
      status: PaymentStatus.PENDING,
      capiContext: capiContext ? (capiContext as object) : undefined,
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

  void sendConversionEvent({
    eventName: 'InitiateCheckout',
    eventId: `checkout_${payment.id}`,
    eventSourceUrl: `${appOrigin}/parametres/abonnement`,
    user: {
      email: owner?.email,
      externalId: tenantId,
      ipAddress: capiContext?.ipAddress,
      userAgent: capiContext?.userAgent,
      fbp: capiContext?.fbp,
      fbc: capiContext?.fbc,
    },
    customData: { value: Number(invoice.amount), currency: invoice.currency, content_name: plan?.name },
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
  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.subscriptionPayment.findUnique({
      where: { id: paymentId },
      include: { invoice: true },
    });
    if (!payment) return null;
    const alreadyPaid = payment.invoice.status === SubInvoiceStatus.PAID;
    const justPaid = status === PaymentStatus.SUCCESS && !alreadyPaid;

    await tx.subscriptionPayment.update({
      where: { id: paymentId },
      data: { status, rawPayload: (raw ?? undefined) as object | undefined },
    });

    if (justPaid) {
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
            currentPeriodEnd: addMonths(base, payment.invoice.periodMonths),
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
    return { invoiceId: payment.invoiceId, status, payment, justPaid };
  });

  // Évènement Purchase (Meta CAPI) : déclenché une seule fois (idempotent via
  // `justPaid`), quel que soit le chemin de confirmation (webhook, simulation,
  // confirmation manuelle) — réutilise le contexte capturé à l'initiation.
  if (result?.justPaid) {
    const { payment } = result;
    const [owner, plan] = await Promise.all([
      prisma.user.findFirst({
        where: { tenantId: payment.tenantId },
        orderBy: { createdAt: 'asc' },
        select: { email: true },
      }),
      prisma.subscriptionPlan.findUnique({
        where: { id: payment.invoice.planId },
        select: { name: true },
      }),
    ]);
    const ctx = (payment.capiContext ?? {}) as CapiContext;
    void sendConversionEvent({
      eventName: 'Purchase',
      eventId: `purchase_${payment.id}`,
      eventSourceUrl: `${appOrigin}/parametres/abonnement`,
      user: {
        email: owner?.email,
        externalId: payment.tenantId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        fbp: ctx.fbp,
        fbc: ctx.fbc,
      },
      customData: { value: Number(payment.amount), currency: payment.currency, content_name: plan?.name },
    });
  }

  return result ? { invoiceId: result.invoiceId, status: result.status } : null;
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

const DAY_MS = 24 * 60 * 60 * 1000;

/** Indicateurs clés de la plateforme (console fondateur). */
export async function getPlatformStats() {
  const since = new Date(Date.now() - 30 * DAY_MS);
  // Les établissements démo (visite guidée, non convertis) sont exclus des
  // statistiques business : ils ne sont ni des clients ni du MRR réel.
  const notDemo = { isDemo: false } as const;
  const [tenantsTotal, usersTotal, usersActive, newTenants30d, newUsers30d, subs] =
    await Promise.all([
      prisma.tenant.count({ where: notDemo }),
      prisma.user.count({ where: { tenant: notDemo } }),
      prisma.user.count({ where: { isActive: true, tenant: notDemo } }),
      prisma.tenant.count({ where: { createdAt: { gte: since }, ...notDemo } }),
      prisma.user.count({ where: { createdAt: { gte: since }, tenant: notDemo } }),
      prisma.subscription.findMany({
        where: { tenant: notDemo },
        include: { plan: { select: { priceMonthly: true } } },
      }),
    ]);

  const countBy = (st: SubscriptionStatus) => subs.filter((s) => s.status === st).length;
  // MRR = somme des prix mensuels des abonnements actifs (revenu récurrent).
  const mrr = subs
    .filter((s) => s.status === SubscriptionStatus.ACTIVE)
    .reduce((acc, s) => acc + Number(s.plan.priceMonthly), 0);

  return {
    tenantsTotal,
    usersTotal,
    usersActive,
    newTenants30d,
    newUsers30d,
    subsActive: countBy(SubscriptionStatus.ACTIVE),
    subsTrialing: countBy(SubscriptionStatus.TRIALING),
    subsPastDue: countBy(SubscriptionStatus.PAST_DUE),
    subsSuspended: countBy(SubscriptionStatus.SUSPENDED),
    mrr,
  };
}

/** Liste des utilisateurs de toute la plateforme (cross-tenant, pour suivi). */
export async function listAllUsers(limit = 200) {
  const users = await prisma.user.findMany({
    where: { tenant: { isDemo: false } },
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: {
      tenant: {
        select: {
          name: true,
          slug: true,
          // Abonnement de l'établissement : permet de distinguer, côté console,
          // les comptes réellement payants des essais et des impayés. Le code
          // (en plus du nom) sert à présélectionner l'offre lors d'une
          // activation manuelle depuis l'onglet Utilisateurs.
          subscription: {
            select: { status: true, currentPeriodEnd: true, plan: { select: { name: true, code: true } } },
          },
        },
      },
      role: { select: { name: true } },
    },
  });
  const now = Date.now();
  return users.map((u) => {
    const sub = u.tenant.subscription;
    // « Payé » = abonnement actif ET période encore valide (un essai ou une
    // période échue ne compte pas, même si le statut stocké dit ACTIVE).
    const isPaid =
      !!sub &&
      sub.status === SubscriptionStatus.ACTIVE &&
      sub.currentPeriodEnd.getTime() > now;
    return {
      id: u.id,
      // Établissement du compte : permet d'agir sur son abonnement (essai,
      // activation, suspension) directement depuis cette liste.
      tenantId: u.tenantId,
      name: `${u.firstName} ${u.lastName}`,
      email: u.email,
      phone: u.phone,
      tenantName: u.tenant.name,
      tenantSlug: u.tenant.slug,
      roleLabel: u.role.name,
      isActive: u.isActive,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
      subscriptionStatus: sub?.status ?? null,
      subscriptionEndsAt: sub?.currentPeriodEnd ?? null,
      planName: sub?.plan.name ?? null,
      planCode: sub?.plan.code ?? null,
      isPaid,
    };
  });
}

export async function listAllSubscriptions() {
  const subs = await prisma.subscription.findMany({
    where: { tenant: { isDemo: false } },
    include: {
      plan: true,
      tenant: { select: { id: true, name: true, slug: true, whatsappPhone: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return subs.map((s) => ({
    tenantId: s.tenantId,
    tenantName: s.tenant.name,
    tenantSlug: s.tenant.slug,
    whatsapp: s.tenant.whatsappPhone,
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
  // Réactiver un abonnement dont la période est expirée doit RÉELLEMENT rendre
  // l'accès : sinon status=ACTIVE mais currentPeriodEnd < now → toujours bloqué.
  const now = new Date();
  const reactivatingExpired =
    status === SubscriptionStatus.ACTIVE && sub.currentPeriodEnd.getTime() < now.getTime();
  await prisma.subscription.update({
    where: { tenantId },
    data: {
      status,
      cancelledAt: status === SubscriptionStatus.CANCELLED ? now : null,
      ...(reactivatingExpired
        ? { currentPeriodStart: now, currentPeriodEnd: addMonths(now, 1), trialEndsAt: null }
        : {}),
    },
  });
  return getSubscription(tenantId);
}

/**
 * Active/prolonge MANUELLEMENT un abonnement depuis la console fondateur, sans
 * passerelle de paiement (le client a réglé en direct : espèces, Mobile Money
 * sur le compte de l'éditeur…). Permet d'intégrer ses premiers clients sans
 * attendre la configuration Moneroo. Enregistre une facture payée pour la
 * traçabilité comptable (tableau de bord finances).
 */
export async function activateSubscriptionManually(
  tenantId: string,
  months = 1,
  planCode?: string,
) {
  const sub = await prisma.subscription.findUnique({ where: { tenantId }, include: { plan: true } });
  if (!sub) throw notFound('Abonnement introuvable');
  const m = Math.min(Math.max(Math.round(months) || 1, 1), 36);

  let planId = sub.planId;
  let plan = sub.plan;
  if (planCode && planCode !== sub.plan.code) {
    const p = await prisma.subscriptionPlan.findFirst({ where: { code: planCode, isActive: true } });
    if (!p) throw badRequest('Offre invalide');
    planId = p.id;
    plan = p;
  }

  const now = new Date();
  // Prolonge si encore actif, sinon repart de maintenant.
  const base = sub.currentPeriodEnd > now ? sub.currentPeriodEnd : now;
  const end = new Date(base);
  end.setMonth(end.getMonth() + m);
  const amount = Number(plan.priceMonthly) * m;

  await prisma.$transaction(async (tx) => {
    const invoice = await tx.subscriptionInvoice.create({
      data: {
        tenantId,
        subscriptionId: sub.id,
        planId,
        number: await nextInvoiceNumber(tenantId),
        amount,
        currency: plan.currency,
        status: SubInvoiceStatus.PAID,
        periodStart: now,
        periodEnd: end,
        dueDate: now,
        paidAt: now,
      },
    });
    await tx.subscriptionPayment.create({
      data: {
        tenantId,
        invoiceId: invoice.id,
        method: PaymentMethod.CASH,
        amount,
        currency: plan.currency,
        status: PaymentStatus.SUCCESS,
        provider: 'manual',
        providerRef: `GRANT-${invoice.number}`,
      },
    });
    await tx.subscription.update({
      where: { tenantId },
      data: {
        planId,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: now,
        currentPeriodEnd: end,
        trialEndsAt: null,
        cancelledAt: null,
      },
    });
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
