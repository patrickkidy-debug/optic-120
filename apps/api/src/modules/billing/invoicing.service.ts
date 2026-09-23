import {
  PaymentMethod,
  PaymentStatus,
  SubInvoiceStatus,
  SubscriptionStatus,
  DEFAULT_INVOICE_TEMPLATES,
  PAYMENT_METHOD_LABELS,
  SUB_INVOICE_STATUS_META,
  fillWaTemplate,
  invoiceTotals,
  type BillingSettingsInput,
  type InvoiceFilter,
  type InvoiceMessageKind,
  type ManualInvoiceInput,
  type RecordPaymentInput,
  type RefundInput,
} from '@oculo/shared-types';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { badRequest, notFound } from '../../lib/http-error.js';
import { recordAudit } from '../../lib/audit.js';
import { logger } from '../../lib/logger.js';
import {
  CREDIT_NOTE_PREFIX,
  INVOICE_PREFIX,
  nextPlatformNumber,
} from '../../lib/platform-number.js';

/**
 * Facturation de l'éditeur : émission, encaissement, remboursement, avoir,
 * journal et indicateurs. Une seule définition de chaque montant, réutilisée par
 * le tableau de bord, la liste et la facture imprimée.
 *
 *   total      = subtotal - discount + tax   (colonne `amount`)
 *   amountPaid = somme des règlements réussis
 *   balance    = total - amountPaid           (TOUJOURS dérivé, jamais stocké)
 *
 * Deux règles tenues partout :
 *
 *  1. Une facture émise n'est JAMAIS supprimée. Annulation, remboursement et
 *     avoir laissent la pièce et son journal en place (§15). Le seul état
 *     effaçable est une facture jamais émise, ce qui n'existe pas ici.
 *  2. Le chiffre d'affaires vient des PAIEMENTS, pas des factures. Une facture
 *     émise n'est pas de l'argent reçu ; c'est la confusion qui rend faux la
 *     moitié des tableaux de bord de facturation.
 */

export interface Actor {
  id: string | null;
  name: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function dec(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value.toFixed(2));
}

function num(value: Prisma.Decimal | number | null | undefined): number {
  return value == null ? 0 : Number(value);
}

function addMonths(from: Date, months: number): Date {
  const d = new Date(from);
  d.setMonth(d.getMonth() + months);
  return d;
}

function parseDate(value: string | null | undefined, fallback: Date): Date {
  if (!value) return fallback;
  const d = new Date(value.length === 10 ? `${value}T00:00:00.000Z` : value);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

function frDate(d: Date | null | undefined): string {
  if (!d) return '—';
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
}

function money(amount: number, currency: string): string {
  return `${new Intl.NumberFormat('fr-FR').format(Math.round(amount))} ${currency === 'XOF' ? 'FCFA' : currency}`;
}

/* ------------------------------ Statut dérivé ------------------------------ */

/**
 * Statut de règlement, calculé — jamais deviné. Un centime restant dû n'est pas
 * « payée » : c'est exactement le cas qui fait perdre de l'argent.
 */
export function settlementStatus(total: number, paid: number): SubInvoiceStatus {
  if (paid <= 0) return SubInvoiceStatus.PENDING;
  if (paid >= total) return SubInvoiceStatus.PAID;
  return SubInvoiceStatus.PARTIALLY_PAID;
}

/**
 * Début du jour courant, en UTC — la même référence que celle utilisée pour
 * stocker les échéances saisies (« AAAA-MM-JJ » devient minuit UTC).
 */
export function startOfTodayUtc(now: Date = new Date()): number {
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

/**
 * Une facture est « en retard » si elle reste due et que son échéance est
 * STRICTEMENT antérieure à aujourd'hui.
 *
 * Comparer l'échéance à l'instant présent déclarerait en retard, dès la
 * première minute, une facture due le jour même : le client a la journée pour
 * payer, et une relance « en retard » envoyée le matin de l'échéance est une
 * erreur visible par le client.
 */
export function isOverdue(row: { status: string; dueDate: Date; amount: unknown; amountPaid: unknown }): boolean {
  const stillDue =
    row.status === SubInvoiceStatus.PENDING || row.status === SubInvoiceStatus.PARTIALLY_PAID;
  return (
    stillDue &&
    row.dueDate.getTime() < startOfTodayUtc() &&
    num(row.amount as never) > num(row.amountPaid as never)
  );
}

/* -------------------------------- Journal -------------------------------- */

export async function logInvoiceEvent(
  invoiceId: string,
  type: string,
  message: string,
  actor?: Actor,
  extra?: { reference?: string | null; metadata?: Record<string, unknown> },
): Promise<void> {
  await prisma.invoiceEvent.create({
    data: {
      invoiceId,
      type,
      message,
      actorId: actor?.id ?? null,
      actorName: actor?.name ?? null,
      reference: extra?.reference ?? null,
      metadata: extra?.metadata ? (extra.metadata as object) : undefined,
    },
  });
}

/* ------------------------------ Paramètres ------------------------------ */

/**
 * Coordonnées de l'éditeur imprimées sur les factures. La ligne est créée vide
 * à la première lecture : AUCUNE adresse, aucun numéro fiscal n'est inventé —
 * un champ vide n'est simplement pas imprimé.
 */
export async function getBillingSettings() {
  const existing = await prisma.platformBillingSettings.findUnique({ where: { id: 'default' } });
  if (existing) return existing;
  return prisma.platformBillingSettings.create({ data: { id: 'default' } });
}

export async function updateBillingSettings(input: BillingSettingsInput, actor: Actor) {
  const data: Prisma.PlatformBillingSettingsUpdateInput = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    // Une chaîne vide efface le champ : le fondateur doit pouvoir retirer une
    // mention légale, pas seulement la remplacer.
    (data as Record<string, unknown>)[key] = value === '' ? null : value;
  }
  await getBillingSettings();
  const saved = await prisma.platformBillingSettings.update({ where: { id: 'default' }, data });
  // Pas d'AuditLog ici : sa colonne tenantId porte une cle etrangere vers un
  // etablissement, et ce reglage n'appartient a aucun. Ecrire une valeur
  // factice ferait echouer l'insertion en silence (recordAudit avale ses
  // erreurs) : on aurait un audit qui n'existe pas en croyant l'avoir.
  logger.info(
    { fields: Object.keys(data), actorId: actor.id, actorName: actor.name },
    'Parametres de facturation mis a jour',
  );
  return saved;
}

/* ------------------------------ Lecture ------------------------------ */

const invoiceInclude = {
  tenant: { select: { id: true, name: true, slug: true, whatsappPhone: true, contactPhone: true, contactEmail: true } },
  items: { orderBy: { sortOrder: 'asc' } },
  payments: { orderBy: { createdAt: 'desc' } },
  refunds: { orderBy: { refundedAt: 'desc' } },
} satisfies Prisma.SubscriptionInvoiceInclude;

type InvoiceRow = Prisma.SubscriptionInvoiceGetPayload<{ include: typeof invoiceInclude }>;

function shapeInvoice(row: InvoiceRow, planName: string) {
  const total = num(row.amount);
  const paid = num(row.amountPaid);
  return {
    id: row.id,
    number: row.number,
    kind: row.kind,
    creditedInvoiceId: row.creditedInvoiceId,
    tenantId: row.tenantId,
    tenantName: row.tenant.name,
    tenantSlug: row.tenant.slug,
    planName,
    source: row.source,
    status: row.status,
    overdue: isOverdue(row),
    subtotal: num(row.subtotal),
    discount: num(row.discount),
    tax: num(row.tax),
    total,
    amountPaid: paid,
    amountRefunded: num(row.amountRefunded),
    balance: Math.max(0, total - paid),
    currency: row.currency,
    issueDate: row.createdAt,
    dueDate: row.dueDate,
    paidAt: row.paidAt,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    periodMonths: row.periodMonths,
    cancelledAt: row.cancelledAt,
    cancelReason: row.cancelReason,
    notes: row.notes,
    billing: {
      name: row.billingName ?? row.tenant.name,
      contact: row.billingContact,
      whatsapp: row.billingWhatsapp ?? row.tenant.whatsappPhone ?? row.tenant.contactPhone,
      email: row.billingEmail ?? row.tenant.contactEmail,
      address: row.billingAddress,
      city: row.billingCity,
      country: row.billingCountry,
    },
    items: row.items.map((it) => ({
      id: it.id,
      description: it.description,
      periodLabel: it.periodLabel,
      quantity: num(it.quantity),
      unitPrice: num(it.unitPrice),
      total: num(it.total),
    })),
    payments: row.payments.map((p) => ({
      id: p.id,
      amount: num(p.amount),
      currency: p.currency,
      method: p.method,
      methodLabel: PAYMENT_METHOD_LABELS[p.method as PaymentMethod] ?? p.method,
      status: p.status,
      reference: p.providerRef,
      provider: p.provider,
      paidAt: p.paidAt ?? (p.status === PaymentStatus.SUCCESS ? p.createdAt : null),
      createdAt: p.createdAt,
      notes: p.notes,
    })),
    refunds: row.refunds.map((r) => ({
      id: r.id,
      amount: num(r.amount),
      currency: r.currency,
      reason: r.reason,
      method: r.method,
      reference: r.reference,
      refundedAt: r.refundedAt,
    })),
  };
}

export type ShapedInvoice = ReturnType<typeof shapeInvoice>;

async function planNames(planIds: string[]): Promise<Map<string, string>> {
  if (planIds.length === 0) return new Map();
  const plans = await prisma.subscriptionPlan.findMany({
    where: { id: { in: [...new Set(planIds)] } },
    select: { id: true, name: true },
  });
  return new Map(plans.map((p) => [p.id, p.name]));
}

export interface ListInvoiceParams {
  filter?: InvoiceFilter;
  search?: string;
  from?: string;
  to?: string;
  tenantId?: string;
  page?: number;
  pageSize?: number;
}

export async function listInvoices(params: ListInvoiceParams) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(200, Math.max(10, params.pageSize ?? 50));

  const where: Prisma.SubscriptionInvoiceWhereInput = {};
  if (params.tenantId) where.tenantId = params.tenantId;

  if (params.from || params.to) {
    where.createdAt = {
      ...(params.from ? { gte: parseDate(params.from, new Date(0)) } : {}),
      ...(params.to ? { lte: new Date(parseDate(params.to, new Date()).getTime() + DAY_MS - 1) } : {}),
    };
  }

  const filter = params.filter ?? 'all';
  if (filter === 'overdue') {
    // Déduit, pas stocké : voir INVOICE_FILTERS côté types partagés.
    where.status = { in: [SubInvoiceStatus.PENDING, SubInvoiceStatus.PARTIALLY_PAID] };
    where.dueDate = { lt: new Date(startOfTodayUtc()) };
  } else if (filter === 'CANCELLED') {
    where.status = { in: [SubInvoiceStatus.CANCELLED, SubInvoiceStatus.VOID] };
  } else if (filter === 'REFUNDED') {
    where.status = { in: [SubInvoiceStatus.REFUNDED, SubInvoiceStatus.PARTIALLY_REFUNDED] };
  } else if (filter !== 'all') {
    where.status = filter as SubInvoiceStatus;
  }

  const search = params.search?.trim();
  if (search) {
    const like = { contains: search, mode: 'insensitive' as const };
    where.OR = [
      { number: like },
      { billingName: like },
      { billingContact: like },
      { billingWhatsapp: like },
      { billingEmail: like },
      { tenant: { name: like } },
      { payments: { some: { providerRef: like } } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.subscriptionInvoice.findMany({
      where,
      include: invoiceInclude,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.subscriptionInvoice.count({ where }),
  ]);

  const names = await planNames(rows.map((r) => r.planId));
  return {
    invoices: rows.map((r) => shapeInvoice(r, names.get(r.planId) ?? '—')),
    total,
    page,
    pageSize,
  };
}

export async function getInvoice(id: string) {
  const row = await prisma.subscriptionInvoice.findUnique({ where: { id }, include: invoiceInclude });
  if (!row) throw notFound('Facture introuvable');
  const [names, events] = await Promise.all([
    planNames([row.planId]),
    prisma.invoiceEvent.findMany({ where: { invoiceId: id }, orderBy: { createdAt: 'asc' } }),
  ]);
  return {
    ...shapeInvoice(row, names.get(row.planId) ?? '—'),
    events: events.map((e) => ({
      id: e.id,
      type: e.type,
      message: e.message,
      actorName: e.actorName,
      reference: e.reference,
      createdAt: e.createdAt,
    })),
  };
}

/* --------------------------- Création manuelle (§6) --------------------------- */

export async function createManualInvoice(input: ManualInvoiceInput, actor: Actor) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: input.tenantId },
    select: {
      id: true,
      name: true,
      whatsappPhone: true,
      contactPhone: true,
      contactEmail: true,
      location: true,
      countryCode: true,
      subscription: { select: { id: true, planId: true } },
    },
  });
  if (!tenant) throw notFound('Établissement introuvable');
  if (!tenant.subscription) throw badRequest("Cet établissement n'a pas d'abonnement rattaché");

  const totals = invoiceTotals(input);
  const now = new Date();
  const issueDate = parseDate(input.issueDate, now);
  const dueDate = parseDate(input.dueDate, issueDate);
  const periodStart = parseDate(input.periodStart, issueDate);
  const periodEnd = parseDate(
    input.periodEnd,
    input.periodMonths > 0 ? addMonths(periodStart, input.periodMonths) : periodStart,
  );

  if (dueDate.getTime() < issueDate.getTime()) {
    throw badRequest("L'échéance ne peut pas précéder la date d'émission");
  }
  if (input.payment && input.payment.amount > totals.total) {
    throw badRequest('Le règlement dépasse le montant de la facture');
  }

  // Le numéro est pris HORS transaction : voir platform-number.ts.
  const number = await nextPlatformNumber(INVOICE_PREFIX);

  const invoice = await prisma.$transaction(async (tx) => {
    const created = await tx.subscriptionInvoice.create({
      data: {
        tenantId: tenant.id,
        subscriptionId: tenant.subscription!.id,
        planId: input.planId ?? tenant.subscription!.planId,
        number,
        amount: dec(totals.total),
        subtotal: dec(totals.subtotal),
        discount: dec(totals.discount),
        tax: dec(totals.tax),
        currency: input.currency,
        status: SubInvoiceStatus.PENDING,
        periodStart,
        periodEnd,
        periodMonths: input.periodMonths,
        dueDate,
        createdAt: issueDate,
        source: 'MANUAL',
        issuedById: actor.id,
        notes: input.notes ?? null,
        billingName: input.billingName ?? tenant.name,
        billingContact: input.billingContact ?? null,
        billingWhatsapp: input.billingWhatsapp ?? tenant.whatsappPhone ?? tenant.contactPhone,
        billingEmail: input.billingEmail ?? tenant.contactEmail,
        billingAddress: input.billingAddress ?? tenant.location,
        billingCity: input.billingCity ?? null,
        billingCountry: input.billingCountry ?? tenant.countryCode,
        items: {
          create: input.items.map((it, i) => ({
            description: it.description,
            periodLabel: it.periodLabel ?? null,
            quantity: dec(it.quantity),
            unitPrice: dec(it.unitPrice),
            total: dec(it.quantity * it.unitPrice),
            sortOrder: i,
          })),
        },
      },
    });
    return created;
  });

  await logInvoiceEvent(invoice.id, 'CREATED', `Facture créée manuellement (${money(totals.total, input.currency)})`, actor);
  await recordAudit({
    tenantId: tenant.id,
    userId: null,
    action: 'platform.invoice.create',
    entity: 'SubscriptionInvoice',
    entityId: invoice.id,
    metadata: { number, total: totals.total, actorId: actor.id, actorName: actor.name },
  });

  // Le règlement éventuel passe par le même chemin que tous les autres, pour
  // que le statut, le journal et la prolongation d'abonnement soient calculés
  // au même endroit (§21).
  if (input.payment) {
    await recordInvoicePayment(invoice.id, input.payment, actor);
  }

  return getInvoice(invoice.id);
}

/* --------------------------- Encaissement (§21-22) --------------------------- */

/**
 * Enregistre un règlement, total ou partiel. Le solde restant n'est pas stocké :
 * il se relit de `amount - amountPaid`, donc il ne peut pas se désynchroniser.
 *
 * Quand la facture est intégralement réglée et qu'elle couvre des mois
 * d'abonnement, l'abonnement est prolongé dans la MÊME transaction : on ne veut
 * pas d'une facture payée sans accès ouvert, ni l'inverse.
 */
export async function recordInvoicePayment(
  invoiceId: string,
  input: RecordPaymentInput,
  actor: Actor,
) {
  const result = await prisma.$transaction(async (tx) => {
    const invoice = await tx.subscriptionInvoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw notFound('Facture introuvable');
    if (invoice.status === SubInvoiceStatus.CANCELLED || invoice.status === SubInvoiceStatus.VOID) {
      throw badRequest('Facture annulée : impossible d’enregistrer un règlement');
    }
    if (invoice.kind === 'CREDIT_NOTE') {
      throw badRequest('Un avoir ne s’encaisse pas');
    }

    const total = num(invoice.amount);
    const alreadyPaid = num(invoice.amountPaid);
    const balance = total - alreadyPaid;
    if (balance <= 0) throw badRequest('Cette facture est déjà intégralement réglée');
    if (input.amount > balance + 0.5) {
      throw badRequest(
        `Le règlement (${money(input.amount, invoice.currency)}) dépasse le solde restant (${money(balance, invoice.currency)})`,
      );
    }

    const paidAt = parseDate(input.paidAt, new Date());
    const payment = await tx.subscriptionPayment.create({
      data: {
        tenantId: invoice.tenantId,
        invoiceId: invoice.id,
        method: input.method,
        amount: dec(input.amount),
        currency: invoice.currency,
        status: PaymentStatus.SUCCESS,
        provider: 'manual',
        providerRef: input.reference?.trim() || `MAN-${invoice.number}-${Date.now()}`,
        channel: input.method === PaymentMethod.BANK_TRANSFER ? 'BANK_TRANSFER' : 'MOBILE_MONEY',
        paidAt,
        notes: input.notes ?? null,
        recordedById: actor.id,
      },
    });

    const newPaid = alreadyPaid + input.amount;
    const status = settlementStatus(total, newPaid);
    const fullyPaid = status === SubInvoiceStatus.PAID;

    await tx.subscriptionInvoice.update({
      where: { id: invoice.id },
      data: {
        amountPaid: dec(newPaid),
        status,
        paidAt: fullyPaid ? (invoice.paidAt ?? paidAt) : null,
      },
    });

    let subscriptionExtended = false;
    if (fullyPaid && invoice.periodMonths > 0) {
      const sub = await tx.subscription.findUnique({ where: { id: invoice.subscriptionId } });
      if (sub) {
        const base = sub.currentPeriodEnd > paidAt ? sub.currentPeriodEnd : paidAt;
        await tx.subscription.update({
          where: { id: sub.id },
          data: {
            planId: invoice.planId,
            status: SubscriptionStatus.ACTIVE,
            currentPeriodStart: paidAt,
            currentPeriodEnd: addMonths(base, invoice.periodMonths),
            trialEndsAt: null,
            cancelledAt: null,
            autoRenew: true,
          },
        });
        subscriptionExtended = true;
      }
    }

    return { invoice, payment, newPaid, total, status, fullyPaid, subscriptionExtended, paidAt };
  });

  await logInvoiceEvent(
    invoiceId,
    'PAYMENT_RECORDED',
    `Paiement de ${money(input.amount, result.invoice.currency)} enregistré (${PAYMENT_METHOD_LABELS[input.method] ?? input.method})`,
    actor,
    { reference: result.payment.providerRef, metadata: { amount: input.amount, method: input.method } },
  );
  if (result.fullyPaid) {
    await logInvoiceEvent(
      invoiceId,
      'PAID',
      result.subscriptionExtended
        ? `Facture soldée — abonnement prolongé de ${result.invoice.periodMonths} mois`
        : 'Facture soldée',
      actor,
    );
  }
  await recordAudit({
    tenantId: result.invoice.tenantId,
    userId: null,
    action: 'platform.invoice.payment',
    entity: 'SubscriptionInvoice',
    entityId: invoiceId,
    metadata: {
      number: result.invoice.number,
      amount: input.amount,
      method: input.method,
      paidTotal: result.newPaid,
      status: result.status,
      actorId: actor.id,
      actorName: actor.name,
    },
  });

  return getInvoice(invoiceId);
}

/** « Marquer comme payée » = encaisser le solde restant. Rien de plus. */
export async function markInvoicePaid(invoiceId: string, method: PaymentMethod, actor: Actor) {
  const invoice = await prisma.subscriptionInvoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw notFound('Facture introuvable');
  const balance = num(invoice.amount) - num(invoice.amountPaid);
  if (balance <= 0) throw badRequest('Cette facture est déjà intégralement réglée');
  return recordInvoicePayment(invoiceId, { amount: balance, method, reference: null, paidAt: null, notes: null }, actor);
}

/* ---------------------------- Remboursement (§23) ---------------------------- */

/**
 * Le remboursement n'efface RIEN : ni le paiement d'origine, ni le montant
 * encaissé. Il s'ajoute, et le statut reflète la part remboursée. Un comptable
 * doit pouvoir relire les deux mouvements.
 */
export async function refundInvoice(invoiceId: string, input: RefundInput, actor: Actor) {
  const result = await prisma.$transaction(async (tx) => {
    const invoice = await tx.subscriptionInvoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw notFound('Facture introuvable');

    const paid = num(invoice.amountPaid);
    const refunded = num(invoice.amountRefunded);
    if (paid <= 0) throw badRequest('Aucun montant encaissé sur cette facture : rien à rembourser');
    const remaining = paid - refunded;
    if (input.amount > remaining + 0.5) {
      throw badRequest(
        `Le remboursement dépasse le montant encore remboursable (${money(remaining, invoice.currency)})`,
      );
    }

    const newRefunded = refunded + input.amount;
    const refund = await tx.subscriptionRefund.create({
      data: {
        tenantId: invoice.tenantId,
        invoiceId: invoice.id,
        amount: dec(input.amount),
        currency: invoice.currency,
        reason: input.reason,
        method: input.method ?? null,
        reference: input.reference ?? null,
        refundedAt: parseDate(input.refundedAt, new Date()),
        createdById: actor.id,
      },
    });

    await tx.subscriptionInvoice.update({
      where: { id: invoice.id },
      data: {
        amountRefunded: dec(newRefunded),
        status:
          newRefunded >= paid ? SubInvoiceStatus.REFUNDED : SubInvoiceStatus.PARTIALLY_REFUNDED,
      },
    });

    return { invoice, refund, newRefunded, paid };
  });

  await logInvoiceEvent(
    invoiceId,
    'REFUNDED',
    `Remboursement de ${money(input.amount, result.invoice.currency)} — ${input.reason}`,
    actor,
    { reference: input.reference ?? null, metadata: { amount: input.amount } },
  );
  await recordAudit({
    tenantId: result.invoice.tenantId,
    userId: null,
    action: 'platform.invoice.refund',
    entity: 'SubscriptionInvoice',
    entityId: invoiceId,
    metadata: {
      number: result.invoice.number,
      amount: input.amount,
      reason: input.reason,
      totalRefunded: result.newRefunded,
      actorId: actor.id,
      actorName: actor.name,
    },
  });

  return getInvoice(invoiceId);
}

/* ------------------------------ Annulation (§15) ------------------------------ */

export async function cancelInvoice(invoiceId: string, reason: string, actor: Actor) {
  const invoice = await prisma.subscriptionInvoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw notFound('Facture introuvable');
  if (invoice.status === SubInvoiceStatus.CANCELLED || invoice.status === SubInvoiceStatus.VOID) {
    throw badRequest('Facture déjà annulée');
  }
  // Annuler une facture encaissée reviendrait à faire disparaître de l'argent
  // reçu du chiffre d'affaires. Le geste comptable correct est le
  // remboursement, puis l'avoir.
  if (num(invoice.amountPaid) > 0) {
    throw badRequest(
      'Cette facture a été encaissée : enregistrez un remboursement puis émettez un avoir, plutôt que de l’annuler',
    );
  }

  await prisma.subscriptionInvoice.update({
    where: { id: invoiceId },
    data: { status: SubInvoiceStatus.CANCELLED, cancelledAt: new Date(), cancelReason: reason },
  });
  await logInvoiceEvent(invoiceId, 'CANCELLED', `Facture annulée — ${reason}`, actor);
  await recordAudit({
    tenantId: invoice.tenantId,
    userId: null,
    action: 'platform.invoice.cancel',
    entity: 'SubscriptionInvoice',
    entityId: invoiceId,
    metadata: { number: invoice.number, reason, actorId: actor.id, actorName: actor.name },
  });
  return getInvoice(invoiceId);
}

/* -------------------------------- Avoir (§13) -------------------------------- */

/**
 * Émet un avoir (série AV-) en contrepartie d'une facture. La facture d'origine
 * n'est pas modifiée : c'est précisément ce que l'avoir sert à éviter.
 */
export async function issueCreditNote(invoiceId: string, actor: Actor, amount?: number) {
  const origin = await prisma.subscriptionInvoice.findUnique({
    where: { id: invoiceId },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!origin) throw notFound('Facture introuvable');
  if (origin.kind === 'CREDIT_NOTE') throw badRequest('Un avoir ne peut pas être avoiré');

  const existing = await prisma.subscriptionInvoice.findFirst({
    where: { creditedInvoiceId: invoiceId, kind: 'CREDIT_NOTE' },
  });
  if (existing) throw badRequest(`Un avoir existe déjà pour cette facture (${existing.number})`);

  const total = amount != null && amount > 0 ? Math.min(amount, num(origin.amount)) : num(origin.amount);
  const number = await nextPlatformNumber(CREDIT_NOTE_PREFIX);
  const now = new Date();

  const credit = await prisma.subscriptionInvoice.create({
    data: {
      tenantId: origin.tenantId,
      subscriptionId: origin.subscriptionId,
      planId: origin.planId,
      number,
      kind: 'CREDIT_NOTE',
      creditedInvoiceId: origin.id,
      amount: dec(total),
      subtotal: dec(total),
      currency: origin.currency,
      // Un avoir n'est pas « en attente de paiement » : il est émis, point.
      status: SubInvoiceStatus.PAID,
      paidAt: now,
      amountPaid: dec(total),
      periodStart: origin.periodStart,
      periodEnd: origin.periodEnd,
      // Aucun mois d'abonnement : un avoir ne prolonge jamais un accès.
      periodMonths: 0,
      dueDate: now,
      source: 'MANUAL',
      issuedById: actor.id,
      notes: `Avoir sur la facture ${origin.number}`,
      billingName: origin.billingName,
      billingContact: origin.billingContact,
      billingWhatsapp: origin.billingWhatsapp,
      billingEmail: origin.billingEmail,
      billingAddress: origin.billingAddress,
      billingCity: origin.billingCity,
      billingCountry: origin.billingCountry,
      items: {
        create: [
          {
            description: `Avoir sur facture ${origin.number}`,
            periodLabel: `${frDate(origin.periodStart)} → ${frDate(origin.periodEnd)}`,
            quantity: dec(1),
            unitPrice: dec(total),
            total: dec(total),
            sortOrder: 0,
          },
        ],
      },
    },
  });

  await logInvoiceEvent(credit.id, 'CREATED', `Avoir émis sur la facture ${origin.number}`, actor);
  await logInvoiceEvent(origin.id, 'CREDIT_NOTE_ISSUED', `Avoir ${number} émis (${money(total, origin.currency)})`, actor, {
    reference: number,
  });
  await recordAudit({
    tenantId: origin.tenantId,
    userId: null,
    action: 'platform.invoice.credit_note',
    entity: 'SubscriptionInvoice',
    entityId: credit.id,
    metadata: { number, origin: origin.number, total, actorId: actor.id, actorName: actor.name },
  });

  return getInvoice(credit.id);
}

/* ------------------------------ Duplication ------------------------------ */

export async function duplicateInvoice(invoiceId: string, actor: Actor) {
  const origin = await prisma.subscriptionInvoice.findUnique({
    where: { id: invoiceId },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!origin) throw notFound('Facture introuvable');

  return createManualInvoice(
    {
      tenantId: origin.tenantId,
      billingName: origin.billingName,
      billingContact: origin.billingContact,
      billingWhatsapp: origin.billingWhatsapp,
      billingEmail: origin.billingEmail,
      billingAddress: origin.billingAddress,
      billingCity: origin.billingCity,
      billingCountry: origin.billingCountry,
      items: origin.items.map((it) => ({
        description: it.description,
        periodLabel: it.periodLabel,
        quantity: num(it.quantity),
        unitPrice: num(it.unitPrice),
      })),
      discount: num(origin.discount),
      tax: num(origin.tax),
      currency: origin.currency,
      planId: origin.planId,
      periodStart: null,
      periodEnd: null,
      periodMonths: origin.periodMonths,
      issueDate: null,
      dueDate: null,
      notes: origin.notes,
      payment: null,
    },
    actor,
  );
}

/* ----------------------------- Message WhatsApp (§16) ----------------------------- */

/**
 * Prépare le message. L'envoi reste manuel via wa.me — même choix que pour les
 * messages de vente : aucune API, aucun quota, et le fondateur relit avant
 * d'envoyer. Le PDF se joint depuis WhatsApp après téléchargement, parce que
 * wa.me ne sait pas transporter de pièce jointe : le message le dit plutôt que
 * de laisser croire à un envoi automatique.
 */
export async function buildInvoiceMessage(invoiceId: string, kind: InvoiceMessageKind = 'invoice') {
  const [invoice, settings] = await Promise.all([getInvoice(invoiceId), getBillingSettings()]);

  const templateByKind: Record<InvoiceMessageKind, string | null> = {
    invoice: settings.invoiceWhatsappTemplate,
    before: settings.reminderBeforeTemplate,
    due: settings.reminderDueTemplate,
    after: settings.reminderAfterTemplate,
  };
  const template = templateByKind[kind]?.trim() || DEFAULT_INVOICE_TEMPLATES[kind];

  const message = fillWaTemplate(template, {
    nom: invoice.billing.contact || invoice.billing.name || invoice.tenantName,
    etablissement: invoice.tenantName,
    facture: invoice.number,
    montant: money(invoice.total, invoice.currency),
    devise: invoice.currency,
    statut: SUB_INVOICE_STATUS_META[invoice.status as SubInvoiceStatus]?.label ?? invoice.status,
    debut: frDate(invoice.periodStart),
    fin: frDate(invoice.periodEnd),
    echeance: frDate(invoice.dueDate),
    solde: money(invoice.balance, invoice.currency),
  });

  return { invoice, message, whatsapp: invoice.billing.whatsapp ?? null };
}

/** Trace l'envoi. Appelé quand le fondateur a effectivement ouvert WhatsApp. */
export async function markInvoiceSent(
  invoiceId: string,
  channel: 'whatsapp' | 'email',
  actor: Actor,
) {
  const invoice = await prisma.subscriptionInvoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw notFound('Facture introuvable');
  await logInvoiceEvent(
    invoiceId,
    channel === 'whatsapp' ? 'WHATSAPP_SENT' : 'EMAIL_SENT',
    channel === 'whatsapp' ? 'Facture envoyée sur WhatsApp' : 'Facture envoyée par e-mail',
    actor,
  );
  return { ok: true };
}

/* ------------------------- Tableau de bord (§4) ------------------------- */

export interface OverviewParams {
  from?: string;
  to?: string;
}

function boundsFor(params: OverviewParams): { from: Date; to: Date } {
  const to = params.to ? new Date(parseDate(params.to, new Date()).getTime() + DAY_MS - 1) : new Date();
  const from = params.from ? parseDate(params.from, new Date(to.getTime() - 29 * DAY_MS)) : new Date(to.getTime() - 29 * DAY_MS);
  return { from, to };
}

/**
 * Indicateurs de la période. Le chiffre d'affaires vient des PAIEMENTS réussis,
 * daté de l'encaissement réel (`paidAt` quand il est connu, sinon la date de
 * création).
 *
 * Seuls les REMBOURSEMENTS sont retranchés, pas les avoirs. Un avoir est le
 * document qui constate l'annulation ; le remboursement est le mouvement
 * d'argent. Les retrancher tous les deux compte deux fois le même retour —
 * c'est ce qui affichait un chiffre d'affaires négatif sur une facture à la
 * fois remboursée et avoirée. Les avoirs restent affichés à part : leur nombre
 * et leur montant renseignent, mais ils ne sortent pas de caisse.
 */
export async function getBillingOverview(params: OverviewParams) {
  const { from, to } = boundsFor(params);
  const paidWindow = { gte: from, lte: to };

  const [payments, refunds, failed, subs, invoiceRows, creditNotes] = await Promise.all([
    prisma.subscriptionPayment.findMany({
      where: {
        status: PaymentStatus.SUCCESS,
        OR: [{ paidAt: paidWindow }, { paidAt: null, createdAt: paidWindow }],
      },
      select: { amount: true, paidAt: true, createdAt: true, method: true },
    }),
    prisma.subscriptionRefund.aggregate({
      where: { refundedAt: paidWindow },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.subscriptionPayment.aggregate({
      where: { status: PaymentStatus.FAILED, createdAt: paidWindow },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.subscription.findMany({
      where: { tenant: { isDemo: false } },
      select: { status: true, plan: { select: { priceMonthly: true } } },
    }),
    prisma.subscriptionInvoice.findMany({
      where: { kind: 'INVOICE' },
      select: { status: true, dueDate: true, amount: true, amountPaid: true },
    }),
    prisma.subscriptionInvoice.aggregate({
      where: { kind: 'CREDIT_NOTE', createdAt: paidWindow },
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  const grossRevenue = payments.reduce((s, p) => s + num(p.amount), 0);
  const refunded = num(refunds._sum.amount);
  const credited = num(creditNotes._sum.amount);

  const active = subs.filter((s) => s.status === SubscriptionStatus.ACTIVE);
  const mrr = active.reduce((s, x) => s + num(x.plan.priceMonthly), 0);

  const counters = {
    total: invoiceRows.length,
    paid: 0,
    pending: 0,
    overdue: 0,
    cancelled: 0,
    refunded: 0,
  };
  let outstanding = 0;
  for (const row of invoiceRows) {
    const balance = Math.max(0, num(row.amount) - num(row.amountPaid));
    switch (row.status) {
      case SubInvoiceStatus.PAID:
        counters.paid += 1;
        break;
      case SubInvoiceStatus.PENDING:
      case SubInvoiceStatus.PARTIALLY_PAID:
        counters.pending += 1;
        outstanding += balance;
        if (row.dueDate.getTime() < startOfTodayUtc() && balance > 0) counters.overdue += 1;
        break;
      case SubInvoiceStatus.CANCELLED:
      case SubInvoiceStatus.VOID:
        counters.cancelled += 1;
        break;
      case SubInvoiceStatus.REFUNDED:
      case SubInvoiceStatus.PARTIALLY_REFUNDED:
        counters.refunded += 1;
        break;
      default:
        break;
    }
  }

  // Série jour par jour, bornes incluses, trous à zéro : une courbe qui saute
  // les jours vides donne une pente fausse.
  const byDay = new Map<string, number>();
  const startDay = new Date(from);
  startDay.setUTCHours(0, 0, 0, 0);
  for (let t = startDay.getTime(); t <= to.getTime(); t += DAY_MS) {
    byDay.set(new Date(t).toISOString().slice(0, 10), 0);
  }
  for (const p of payments) {
    const key = (p.paidAt ?? p.createdAt).toISOString().slice(0, 10);
    if (byDay.has(key)) byDay.set(key, (byDay.get(key) ?? 0) + num(p.amount));
  }

  const byMethod = new Map<string, number>();
  for (const p of payments) byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + num(p.amount));

  return {
    from,
    to,
    revenue: {
      gross: grossRevenue,
      refunded,
      credited,
      // Le net peut etre negatif si l'on rembourse sur la periode un paiement
      // recu avant elle. C'est un fait, pas une anomalie : on l'affiche tel
      // quel plutot que de le rabattre a zero.
      net: grossRevenue - refunded,
      paymentsCount: payments.length,
    },
    mrr,
    arpu: active.length > 0 ? Math.round(mrr / active.length) : 0,
    activeSubscriptions: active.length,
    outstanding,
    failed: { count: failed._count, amount: num(failed._sum.amount) },
    refunds: { count: refunds._count, amount: refunded },
    creditNotes: { count: creditNotes._count, amount: credited },
    invoices: counters,
    series: [...byDay.entries()].map(([date, amount]) => ({ date, amount })),
    byMethod: [...byMethod.entries()]
      .map(([method, amount]) => ({
        method,
        label: PAYMENT_METHOD_LABELS[method as PaymentMethod] ?? method,
        amount,
      }))
      .sort((a, b) => b.amount - a.amount),
  };
}

/* ------------------------ Facturation d'un client (§20) ------------------------ */

export async function getTenantBilling(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
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
      subscription: { include: { plan: true } },
    },
  });
  if (!tenant) throw notFound('Établissement introuvable');

  const { invoices } = await listInvoices({ tenantId, pageSize: 100 });
  const collected = invoices
    .filter((i) => i.kind === 'INVOICE')
    .reduce((s, i) => s + i.amountPaid, 0);
  const outstanding = invoices
    .filter((i) => i.kind === 'INVOICE' && !['CANCELLED', 'VOID'].includes(i.status))
    .reduce((s, i) => s + i.balance, 0);

  const sub = tenant.subscription;
  return {
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      whatsapp: tenant.whatsappPhone ?? tenant.contactPhone,
      email: tenant.contactEmail,
      address: tenant.location,
      country: tenant.countryCode,
      currency: tenant.currency,
    },
    subscription: sub
      ? {
          id: sub.id,
          planId: sub.planId,
          planName: sub.plan.name,
          planCode: sub.plan.code,
          priceMonthly: num(sub.plan.priceMonthly),
          currency: sub.plan.currency,
          status: sub.status,
          currentPeriodStart: sub.currentPeriodStart,
          currentPeriodEnd: sub.currentPeriodEnd,
          autoRenew: sub.autoRenew,
        }
      : null,
    totals: { collected, outstanding, invoiceCount: invoices.length },
    invoices,
  };
}

/* --------------------------- Abonnements (§24) --------------------------- */

export async function listBillingSubscriptions() {
  const subs = await prisma.subscription.findMany({
    include: {
      plan: { select: { name: true, code: true, priceMonthly: true, currency: true } },
      tenant: { select: { id: true, name: true, slug: true, whatsappPhone: true, contactEmail: true, isDemo: true } },
    },
    orderBy: { currentPeriodEnd: 'asc' },
  });

  const lastPayments = await prisma.subscriptionPayment.findMany({
    where: { status: PaymentStatus.SUCCESS },
    orderBy: { createdAt: 'desc' },
    select: { tenantId: true, amount: true, paidAt: true, createdAt: true, method: true },
  });
  const latestByTenant = new Map<string, { amount: number; at: Date; method: string }>();
  for (const p of lastPayments) {
    if (latestByTenant.has(p.tenantId)) continue;
    latestByTenant.set(p.tenantId, {
      amount: num(p.amount),
      at: p.paidAt ?? p.createdAt,
      method: p.method,
    });
  }

  return subs.map((s) => {
    const last = latestByTenant.get(s.tenantId);
    return {
      tenantId: s.tenantId,
      tenantName: s.tenant.name,
      tenantSlug: s.tenant.slug,
      isDemo: s.tenant.isDemo,
      whatsapp: s.tenant.whatsappPhone,
      email: s.tenant.contactEmail,
      planName: s.plan.name,
      planCode: s.plan.code,
      priceMonthly: num(s.plan.priceMonthly),
      currency: s.plan.currency,
      status: s.status,
      currentPeriodStart: s.currentPeriodStart,
      currentPeriodEnd: s.currentPeriodEnd,
      autoRenew: s.autoRenew,
      lastPayment: last ? { amount: last.amount, at: last.at, method: last.method } : null,
      // La prochaine échéance EST la fin de période : pas de date inventée pour
      // un abonnement sans renouvellement automatique.
      nextBillingDate: s.autoRenew ? s.currentPeriodEnd : null,
    };
  });
}

/* ----------------------- Relances dues (§18) ----------------------- */

/**
 * Factures pour lesquelles une relance est pertinente aujourd'hui, selon les
 * réglages. Rien n'est envoyé ici : la liste alimente l'écran, et le fondateur
 * déclenche chaque message. C'est volontaire — un envoi automatique silencieux
 * sur un numéro erroné ne se rattrape pas.
 */
export async function listDueReminders() {
  const settings = await getBillingSettings();
  const now = new Date();
  const soon = new Date(now.getTime() + settings.remindBeforeDays * DAY_MS);

  const rows = await prisma.subscriptionInvoice.findMany({
    where: {
      kind: 'INVOICE',
      status: { in: [SubInvoiceStatus.PENDING, SubInvoiceStatus.PARTIALLY_PAID] },
      dueDate: { lte: soon },
      tenant: { isDemo: false },
    },
    include: invoiceInclude,
    orderBy: { dueDate: 'asc' },
  });

  const names = await planNames(rows.map((r) => r.planId));
  return rows.map((row) => {
    const shaped = shapeInvoice(row, names.get(row.planId) ?? '—');
    const days = Math.round((row.dueDate.getTime() - now.getTime()) / DAY_MS);
    const kind: InvoiceMessageKind = days > 0 ? 'before' : days === 0 ? 'due' : 'after';
    return { ...shaped, daysToDue: days, reminderKind: kind };
  });
}
