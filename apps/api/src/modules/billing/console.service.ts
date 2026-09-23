import { PaymentStatus, SubInvoiceStatus, SubscriptionStatus } from '@oculo/shared-types';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

/**
 * Agrégats de la console fondateur.
 *
 * Une seule définition de chaque chiffre, calculée ICI et côté serveur, pour
 * trois raisons :
 *
 *  1. Les compteurs doivent être cohérents entre eux. « 197 établissements » et
 *     « 12 abonnements actifs » ne racontent la même histoire que s'ils sont
 *     comptés sur le même périmètre, au même instant.
 *  2. Un utilisateur n'est PAS un établissement, et un établissement n'est PAS
 *     un client payant. Les trois sont comptés séparément et jamais additionnés.
 *  3. Rien n'est inventé pour remplir une carte. Un indicateur qu'on ne sait pas
 *     calculer honnêtement n'est pas affiché.
 *
 * Les établissements de démonstration (visite guidée) sont exclus partout :
 * ce ne sont ni des clients ni du revenu.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const notDemo = { isDemo: false } as const;

function num(v: Prisma.Decimal | number | null | undefined): number {
  return v == null ? 0 : Number(v);
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function parseBound(value: string | undefined, fallback: Date): Date {
  if (!value) return fallback;
  const d = new Date(value.length === 10 ? `${value}T00:00:00.000Z` : value);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

export interface OverviewParams {
  from?: string;
  to?: string;
}

function bounds(params: OverviewParams): { from: Date; to: Date; days: number } {
  const to = params.to
    ? new Date(parseBound(params.to, new Date()).getTime() + DAY_MS - 1)
    : new Date();
  const from = parseBound(params.from, new Date(to.getTime() - 29 * DAY_MS));
  const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / DAY_MS));
  return { from, to, days };
}

/* --------------------------- État réel d'un abonnement --------------------------- */

export type RealSubState = 'paying' | 'trialing' | 'expired' | 'suspended' | 'cancelled';

/**
 * Le statut stocké ne suffit pas : un abonnement reste `ACTIVE` en base alors
 * que sa période est déjà terminée, et le garde d'abonnement refuse pourtant
 * déjà l'accès. Afficher « Actif » dans ce cas ferait croire à un client payant
 * qui ne peut plus se connecter.
 */
export function realSubState(status: string, currentPeriodEnd: Date, now = Date.now()): RealSubState {
  if (status === SubscriptionStatus.SUSPENDED) return 'suspended';
  if (status === SubscriptionStatus.CANCELLED) return 'cancelled';
  const expired = currentPeriodEnd.getTime() < now;
  if (status === SubscriptionStatus.TRIALING) return expired ? 'expired' : 'trialing';
  if (expired) return 'expired';
  return status === SubscriptionStatus.ACTIVE ? 'paying' : 'expired';
}

/* ------------------------------ Vue d'ensemble ------------------------------ */

export async function getFounderOverview(params: OverviewParams = {}) {
  const { from, to, days } = bounds(params);
  const now = new Date();
  const window = { gte: from, lte: to };
  const previousFrom = new Date(from.getTime() - days * DAY_MS);
  const previousWindow = { gte: previousFrom, lt: from };

  const [
    tenantsTotal,
    usersTotal,
    usersActive,
    newTenants,
    newTenantsPrev,
    newUsers,
    newUsersPrev,
    subs,
    payments,
    paymentsPrev,
    failedPayments,
    pendingManual,
    demosPending,
    refunds,
    openInvoices,
  ] = await Promise.all([
    prisma.tenant.count({ where: notDemo }),
    prisma.user.count({ where: { tenant: notDemo } }),
    prisma.user.count({ where: { isActive: true, tenant: notDemo } }),
    prisma.tenant.count({ where: { ...notDemo, createdAt: window } }),
    prisma.tenant.count({ where: { ...notDemo, createdAt: previousWindow } }),
    prisma.user.count({ where: { tenant: notDemo, createdAt: window } }),
    prisma.user.count({ where: { tenant: notDemo, createdAt: previousWindow } }),
    prisma.subscription.findMany({
      where: { tenant: notDemo },
      select: {
        tenantId: true,
        status: true,
        currentPeriodEnd: true,
        plan: { select: { priceMonthly: true } },
      },
    }),
    prisma.subscriptionPayment.findMany({
      where: {
        status: PaymentStatus.SUCCESS,
        OR: [{ paidAt: window }, { paidAt: null, createdAt: window }],
      },
      select: { tenantId: true, amount: true, paidAt: true, createdAt: true },
    }),
    prisma.subscriptionPayment.aggregate({
      where: {
        status: PaymentStatus.SUCCESS,
        OR: [{ paidAt: previousWindow }, { paidAt: null, createdAt: previousWindow }],
      },
      _sum: { amount: true },
    }),
    prisma.subscriptionPayment.count({
      where: { status: PaymentStatus.FAILED, createdAt: window },
    }),
    prisma.subscriptionPayment.count({
      where: { status: PaymentStatus.PENDING, provider: 'manual' },
    }),
    prisma.demoRequest.count({ where: { status: 'PENDING' } }),
    prisma.subscriptionRefund.aggregate({ where: { refundedAt: window }, _sum: { amount: true } }),
    prisma.subscriptionInvoice.findMany({
      where: {
        kind: 'INVOICE',
        status: { in: [SubInvoiceStatus.PENDING, SubInvoiceStatus.PARTIALLY_PAID] },
        tenant: notDemo,
      },
      select: { amount: true, amountPaid: true, dueDate: true },
    }),
  ]);

  /* --- Répartition des abonnements, sur l'état RÉEL --- */
  const states: Record<RealSubState, number> = {
    paying: 0,
    trialing: 0,
    expired: 0,
    suspended: 0,
    cancelled: 0,
  };
  let mrr = 0;
  for (const s of subs) {
    const state = realSubState(s.status, s.currentPeriodEnd, now.getTime());
    states[state] += 1;
    // Le MRR ne compte que les abonnements réellement payants : un essai ou une
    // période échue ne produit aucun revenu récurrent.
    if (state === 'paying') mrr += num(s.plan.priceMonthly);
  }

  /* --- Encaissements --- */
  const collected = payments.reduce((sum, p) => sum + num(p.amount), 0);
  const collectedPrev = num(paymentsPrev._sum.amount);
  const refunded = num(refunds._sum.amount);

  /* --- Encours --- */
  const todayStart = startOfUtcDay(now).getTime();
  let outstanding = 0;
  let overdueInvoices = 0;
  for (const inv of openInvoices) {
    const balance = Math.max(0, num(inv.amount) - num(inv.amountPaid));
    outstanding += balance;
    if (balance > 0 && inv.dueDate.getTime() < todayStart) overdueInvoices += 1;
  }

  /* --- Renouvellements --- */
  // Définition tenue dans toute la console, parce qu'un « taux de
  // renouvellement » sans définition explicite ne veut rien dire :
  //   renouvellement = paiement réussi d'un établissement qui avait DÉJÀ payé
  //                    au moins une fois auparavant ;
  //   expiration     = abonnement dont la période s'est terminée dans la
  //                    fenêtre et qui n'a pas été prolongé depuis.
  // Le taux est la part des échéances de la fenêtre qui se sont soldées par un
  // paiement. Il n'est pas affiché tant qu'aucune échéance n'est tombée : un
  // taux calculé sur zéro cas serait un chiffre inventé.
  const payingTenantIds = [...new Set(payments.map((p) => p.tenantId))];
  const earlierPayers = payingTenantIds.length
    ? await prisma.subscriptionPayment.findMany({
        where: {
          tenantId: { in: payingTenantIds },
          status: PaymentStatus.SUCCESS,
          createdAt: { lt: from },
        },
        select: { tenantId: true },
        distinct: ['tenantId'],
      })
    : [];
  const earlierPayerSet = new Set(earlierPayers.map((p) => p.tenantId));
  const renewedTenants = payingTenantIds.filter((id) => earlierPayerSet.has(id));

  const expiredInWindow = subs.filter(
    (s) =>
      s.currentPeriodEnd.getTime() >= from.getTime() &&
      s.currentPeriodEnd.getTime() <= to.getTime() &&
      s.currentPeriodEnd.getTime() < now.getTime(),
  ).length;

  const renewalBase = renewedTenants.length + expiredInWindow;
  const renewalRate = renewalBase > 0 ? (renewedTenants.length / renewalBase) * 100 : null;

  /* --- À traiter aujourd'hui --- */
  const tomorrowStart = todayStart + DAY_MS;
  const renewalsToday = subs.filter(
    (s) => s.currentPeriodEnd.getTime() >= todayStart && s.currentPeriodEnd.getTime() < tomorrowStart,
  ).length;
  const renewals48h = subs.filter(
    (s) =>
      s.currentPeriodEnd.getTime() >= now.getTime() &&
      s.currentPeriodEnd.getTime() < now.getTime() + 2 * DAY_MS,
  ).length;

  /* --- Séries jour par jour --- */
  const series = await growthSeries(from, to, payments);

  return {
    period: { from, to, days },
    tenants: {
      total: tenantsTotal,
      created: newTenants,
      previous: newTenantsPrev,
    },
    users: {
      total: usersTotal,
      active: usersActive,
      created: newUsers,
      previous: newUsersPrev,
    },
    subscriptions: {
      paying: states.paying,
      trialing: states.trialing,
      expired: states.expired,
      suspended: states.suspended,
      cancelled: states.cancelled,
      total: subs.length,
    },
    revenue: {
      mrr,
      arr: mrr * 12,
      collected,
      collectedPrevious: collectedPrev,
      refunded,
      net: collected - refunded,
      outstanding,
    },
    renewals: {
      rate: renewalRate,
      renewed: renewedTenants.length,
      expired: expiredInWindow,
      today: renewalsToday,
      next48h: renewals48h,
    },
    actionRequired: {
      failedPayments,
      renewalsToday,
      pendingConfirmations: pendingManual,
      demosToProcess: demosPending,
      expiredClients: states.expired,
      overdueInvoices,
    },
    series,
  };
}

/** Séries quotidiennes. Les jours sans évènement valent zéro et ne sont pas sautés. */
async function growthSeries(
  from: Date,
  to: Date,
  payments: { amount: Prisma.Decimal; paidAt: Date | null; createdAt: Date }[],
) {
  const [tenants, users] = await Promise.all([
    prisma.tenant.findMany({
      where: { ...notDemo, createdAt: { gte: from, lte: to } },
      select: { createdAt: true },
    }),
    prisma.user.findMany({
      where: { tenant: notDemo, createdAt: { gte: from, lte: to } },
      select: { createdAt: true },
    }),
  ]);

  const buckets = new Map<
    string,
    { date: string; tenants: number; users: number; revenue: number }
  >();
  for (let t = startOfUtcDay(from).getTime(); t <= to.getTime(); t += DAY_MS) {
    const key = new Date(t).toISOString().slice(0, 10);
    buckets.set(key, { date: key, tenants: 0, users: 0, revenue: 0 });
  }
  const add = (d: Date, field: 'tenants' | 'users', amount = 1) => {
    const b = buckets.get(d.toISOString().slice(0, 10));
    if (b) b[field] += amount;
  };

  for (const t of tenants) add(t.createdAt, 'tenants');
  for (const u of users) add(u.createdAt, 'users');
  for (const p of payments) {
    const b = buckets.get((p.paidAt ?? p.createdAt).toISOString().slice(0, 10));
    if (b) b.revenue += num(p.amount);
  }

  return [...buckets.values()];
}

/* ------------------------------ Recherche globale ------------------------------ */

/**
 * Recherche transversale de la console (§27).
 *
 * Les résultats sont groupés par nature et volontairement plafonnés : une
 * recherche qui rend cent lignes ne fait pas gagner de temps. Chaque groupe
 * porte son propre total, pour que « 5 affichés sur 38 » soit dit plutôt que
 * laissé deviner.
 */
export async function searchPlatform(rawQuery: string, perGroup = 5) {
  const q = rawQuery.trim();
  if (q.length < 2) {
    return { query: q, users: [], tenants: [], invoices: [], payments: [], totals: {} };
  }
  const like = { contains: q, mode: 'insensitive' as const };
  const digits = q.replace(/[^0-9]/g, '');

  const [users, usersTotal, tenants, tenantsTotal, invoices, invoicesTotal, payments] =
    await Promise.all([
      prisma.user.findMany({
        where: {
          tenant: notDemo,
          OR: [
            { firstName: like },
            { lastName: like },
            { email: like },
            ...(digits.length >= 4 ? [{ phone: { contains: digits } }] : []),
          ],
        },
        take: perGroup,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          tenantId: true,
          tenant: { select: { name: true } },
        },
      }),
      prisma.user.count({
        where: {
          tenant: notDemo,
          OR: [
            { firstName: like },
            { lastName: like },
            { email: like },
            ...(digits.length >= 4 ? [{ phone: { contains: digits } }] : []),
          ],
        },
      }),
      prisma.tenant.findMany({
        where: {
          ...notDemo,
          OR: [
            { name: like },
            { slug: like },
            { contactEmail: like },
            ...(digits.length >= 4 ? [{ whatsappPhone: { contains: digits } }] : []),
          ],
        },
        take: perGroup,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          slug: true,
          whatsappPhone: true,
          contactEmail: true,
          subscription: {
            select: { status: true, currentPeriodEnd: true, plan: { select: { name: true } } },
          },
        },
      }),
      prisma.tenant.count({
        where: {
          ...notDemo,
          OR: [{ name: like }, { slug: like }, { contactEmail: like }],
        },
      }),
      prisma.subscriptionInvoice.findMany({
        where: {
          OR: [{ number: like }, { billingName: like }, { tenant: { name: like } }],
        },
        take: perGroup,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          number: true,
          amount: true,
          amountPaid: true,
          currency: true,
          status: true,
          createdAt: true,
          tenantId: true,
          tenant: { select: { name: true } },
        },
      }),
      prisma.subscriptionInvoice.count({
        where: { OR: [{ number: like }, { billingName: like }, { tenant: { name: like } }] },
      }),
      prisma.subscriptionPayment.findMany({
        where: { providerRef: like },
        take: perGroup,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          providerRef: true,
          amount: true,
          currency: true,
          status: true,
          method: true,
          createdAt: true,
          invoiceId: true,
          invoice: { select: { number: true, tenantId: true, tenant: { select: { name: true } } } },
        },
      }),
    ]);

  return {
    query: q,
    users: users.map((u) => ({
      id: u.id,
      name: `${u.firstName} ${u.lastName}`,
      email: u.email,
      phone: u.phone,
      tenantId: u.tenantId,
      tenantName: u.tenant.name,
    })),
    tenants: tenants.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      whatsapp: t.whatsappPhone,
      email: t.contactEmail,
      planName: t.subscription?.plan.name ?? null,
      state: t.subscription
        ? realSubState(t.subscription.status, t.subscription.currentPeriodEnd)
        : null,
    })),
    invoices: invoices.map((i) => ({
      id: i.id,
      number: i.number,
      tenantId: i.tenantId,
      tenantName: i.tenant.name,
      total: num(i.amount),
      balance: Math.max(0, num(i.amount) - num(i.amountPaid)),
      currency: i.currency,
      status: i.status,
      createdAt: i.createdAt,
    })),
    payments: payments.map((p) => ({
      id: p.id,
      reference: p.providerRef,
      amount: num(p.amount),
      currency: p.currency,
      status: p.status,
      method: p.method,
      invoiceId: p.invoiceId,
      invoiceNumber: p.invoice.number,
      tenantId: p.invoice.tenantId,
      tenantName: p.invoice.tenant.name,
      createdAt: p.createdAt,
    })),
    totals: {
      users: usersTotal,
      tenants: tenantsTotal,
      invoices: invoicesTotal,
      payments: payments.length,
    },
  };
}

/* ------------------------- Utilisateurs (pagination serveur) ------------------------- */

export type UserFilter =
  | 'all'
  | 'paying'
  | 'trialing'
  | 'expired'
  | 'suspended'
  | 'inactive'
  | 'active';

export interface ListUsersParams {
  search?: string;
  filter?: UserFilter;
  page?: number;
  pageSize?: number;
}

/**
 * Liste paginée CÔTÉ SERVEUR (§28).
 *
 * L'ancienne version rapatriait 200 comptes d'un coup et filtrait dans le
 * navigateur : au-delà, les comptes n'existaient simplement pas pour la
 * console, et la recherche ne trouvait pas ce qui n'avait pas été chargé.
 *
 * Les filtres par état d'abonnement portent sur l'établissement : ils se
 * traduisent en conditions SQL sur la relation, jamais en tri après coup.
 */
export async function listPlatformUsers(params: ListUsersParams = {}) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, params.pageSize ?? 25));
  const now = new Date();

  const where: Prisma.UserWhereInput = { tenant: notDemo };

  const search = params.search?.trim();
  if (search) {
    const like = { contains: search, mode: 'insensitive' as const };
    const digits = search.replace(/[^0-9]/g, '');
    where.OR = [
      { firstName: like },
      { lastName: like },
      { email: like },
      { tenant: { name: like } },
      ...(digits.length >= 4 ? [{ phone: { contains: digits } }] : []),
    ];
  }

  const filter = params.filter ?? 'all';
  const sub = (cond: Prisma.SubscriptionWhereInput) => ({ tenant: { ...notDemo, subscription: cond } });

  switch (filter) {
    case 'paying':
      Object.assign(where, sub({ status: SubscriptionStatus.ACTIVE, currentPeriodEnd: { gt: now } }));
      break;
    case 'trialing':
      Object.assign(where, sub({ status: SubscriptionStatus.TRIALING, currentPeriodEnd: { gt: now } }));
      break;
    case 'expired':
      Object.assign(
        where,
        sub({
          status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING, SubscriptionStatus.PAST_DUE] },
          currentPeriodEnd: { lte: now },
        }),
      );
      break;
    case 'suspended':
      Object.assign(where, sub({ status: SubscriptionStatus.SUSPENDED }));
      break;
    case 'inactive':
      where.isActive = false;
      break;
    case 'active':
      where.isActive = true;
      break;
    default:
      break;
  }

  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        tenant: {
          select: {
            name: true,
            slug: true,
            subscription: {
              select: {
                status: true,
                currentPeriodEnd: true,
                plan: { select: { name: true, code: true } },
              },
            },
          },
        },
        role: { select: { name: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    users: rows.map((u) => {
      const s = u.tenant.subscription;
      const state = s ? realSubState(s.status, s.currentPeriodEnd, now.getTime()) : null;
      return {
        id: u.id,
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
        subscriptionStatus: s?.status ?? null,
        subscriptionEndsAt: s?.currentPeriodEnd ?? null,
        planName: s?.plan.name ?? null,
        planCode: s?.plan.code ?? null,
        state,
        isPaid: state === 'paying',
      };
    }),
    total,
    page,
    pageSize,
  };
}

/* ------------------------------ Établissements ------------------------------ */

export interface ListTenantsParams {
  search?: string;
  state?: RealSubState | 'all';
  page?: number;
  pageSize?: number;
}

/** Fiche établissement (§15) : les données réelles, sans agrégat inventé. */
export async function listPlatformTenants(params: ListTenantsParams = {}) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, params.pageSize ?? 25));
  const now = Date.now();

  const where: Prisma.TenantWhereInput = { ...notDemo };
  const search = params.search?.trim();
  if (search) {
    const like = { contains: search, mode: 'insensitive' as const };
    const digits = search.replace(/[^0-9]/g, '');
    where.OR = [
      { name: like },
      { slug: like },
      { contactEmail: like },
      ...(digits.length >= 4 ? [{ whatsappPhone: { contains: digits } }] : []),
    ];
  }

  const rows = await prisma.tenant.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      slug: true,
      countryCode: true,
      location: true,
      whatsappPhone: true,
      contactPhone: true,
      contactEmail: true,
      createdAt: true,
      _count: { select: { users: true, branches: true } },
      subscription: {
        select: {
          status: true,
          currentPeriodStart: true,
          currentPeriodEnd: true,
          autoRenew: true,
          plan: { select: { name: true, code: true, priceMonthly: true, currency: true } },
        },
      },
    },
  });

  const shaped = rows.map((t) => {
    const s = t.subscription;
    const state = s ? realSubState(s.status, s.currentPeriodEnd, now) : null;
    return {
      id: t.id,
      name: t.name,
      slug: t.slug,
      country: t.countryCode,
      location: t.location,
      whatsapp: t.whatsappPhone ?? t.contactPhone,
      email: t.contactEmail,
      createdAt: t.createdAt,
      userCount: t._count.users,
      branchCount: t._count.branches,
      planName: s?.plan.name ?? null,
      planCode: s?.plan.code ?? null,
      // Le MRR d'un établissement n'est compté que s'il paie réellement :
      // sinon la somme des lignes dépasserait le MRR de la plateforme.
      mrr: state === 'paying' ? num(s!.plan.priceMonthly) : 0,
      currency: s?.plan.currency ?? 'XOF',
      status: s?.status ?? null,
      state,
      currentPeriodEnd: s?.currentPeriodEnd ?? null,
      autoRenew: s?.autoRenew ?? false,
    };
  });

  // Le filtre d'état se fait après mise en forme parce qu'il dépend d'un calcul
  // (période échue ou non) que SQL ne porte pas seul. La pagination suit, pour
  // que le total annoncé corresponde à ce qui est réellement filtré.
  const filtered =
    !params.state || params.state === 'all' ? shaped : shaped.filter((t) => t.state === params.state);

  return {
    tenants: filtered.slice((page - 1) * pageSize, page * pageSize),
    total: filtered.length,
    page,
    pageSize,
  };
}

/** Détail d'un établissement, pour sa fiche. */
export async function getPlatformTenant(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      name: true,
      slug: true,
      countryCode: true,
      location: true,
      whatsappPhone: true,
      contactPhone: true,
      contactEmail: true,
      currency: true,
      createdAt: true,
      isDemo: true,
      subscription: {
        select: {
          status: true,
          currentPeriodStart: true,
          currentPeriodEnd: true,
          autoRenew: true,
          plan: { select: { id: true, name: true, code: true, priceMonthly: true, currency: true } },
        },
      },
      users: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          role: { select: { name: true } },
        },
      },
      branches: { select: { id: true, name: true } },
    },
  });
  if (!tenant) return null;

  const s = tenant.subscription;
  const state = s ? realSubState(s.status, s.currentPeriodEnd) : null;

  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    country: tenant.countryCode,
    location: tenant.location,
    whatsapp: tenant.whatsappPhone ?? tenant.contactPhone,
    email: tenant.contactEmail,
    currency: tenant.currency,
    createdAt: tenant.createdAt,
    isDemo: tenant.isDemo,
    branches: tenant.branches,
    users: tenant.users.map((u) => ({
      id: u.id,
      name: `${u.firstName} ${u.lastName}`,
      email: u.email,
      phone: u.phone,
      isActive: u.isActive,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
      roleLabel: u.role.name,
    })),
    subscription: s
      ? {
          planId: s.plan.id,
          planName: s.plan.name,
          planCode: s.plan.code,
          priceMonthly: num(s.plan.priceMonthly),
          currency: s.plan.currency,
          status: s.status,
          state,
          currentPeriodStart: s.currentPeriodStart,
          currentPeriodEnd: s.currentPeriodEnd,
          autoRenew: s.autoRenew,
        }
      : null,
    mrr: state === 'paying' ? num(s!.plan.priceMonthly) : 0,
  };
}
