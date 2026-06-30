import { SubscriptionStatus, SubInvoiceStatus } from '@oculo/shared-types';
import { prisma } from '../../lib/prisma.js';
import { notFound, conflict, badRequest } from '../../lib/http-error.js';
import { invalidateOperatorCache, isEnvOperator, getOperatorEmails } from '../../lib/operators.js';

/* --------------------- Équipe (opérateurs de la console) --------------------- */

export async function listOperators() {
  const rows = await prisma.platformOperator.findMany({ orderBy: { createdAt: 'asc' } });
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    name: r.name,
    createdAt: r.createdAt,
  }));
}

export async function addOperator(email: string, name: string | undefined, addedById: string) {
  const normalized = email.trim().toLowerCase();
  if (isEnvOperator(normalized)) {
    throw conflict('Cet email a déjà accès (configuré via les variables serveur)');
  }
  const existing = await prisma.platformOperator.findUnique({ where: { email: normalized } });
  if (existing) throw conflict('Cet email est déjà opérateur');
  const row = await prisma.platformOperator.create({
    data: { email: normalized, name: name?.trim() || null, addedById },
  });
  invalidateOperatorCache();
  return row;
}

export async function removeOperator(id: string) {
  const row = await prisma.platformOperator.findUnique({ where: { id } });
  if (!row) throw notFound('Opérateur introuvable');
  if (getOperatorEmails().size <= 1) {
    throw badRequest('Impossible de retirer le dernier accès à la console fondateur');
  }
  await prisma.platformOperator.delete({ where: { id } });
  invalidateOperatorCache();
}

/* --------------------------------- Finances --------------------------------- */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Indicateurs financiers consolidés (revenu total, MRR, ARPU, churn 30j). */
export async function getFinanceSummary() {
  const [allTimePaid, subs, cancelled30d] = await Promise.all([
    prisma.subscriptionInvoice.aggregate({
      where: { status: SubInvoiceStatus.PAID },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.subscription.findMany({ include: { plan: { select: { priceMonthly: true } } } }),
    prisma.subscription.count({
      where: {
        status: SubscriptionStatus.CANCELLED,
        cancelledAt: { gte: new Date(Date.now() - 30 * DAY_MS) },
      },
    }),
  ]);

  const active = subs.filter((s) => s.status === SubscriptionStatus.ACTIVE);
  const mrr = active.reduce((acc, s) => acc + Number(s.plan.priceMonthly), 0);
  const arpu = active.length > 0 ? mrr / active.length : 0;
  const churnRate30d = subs.length > 0 ? (cancelled30d / subs.length) * 100 : 0;

  return {
    totalRevenue: Number(allTimePaid._sum.amount ?? 0),
    paidInvoicesCount: allTimePaid._count,
    mrr,
    arpu: Math.round(arpu),
    activeCount: active.length,
    churnRate30d: Math.round(churnRate30d * 10) / 10,
  };
}

/** Série du revenu encaissé (factures payées) jour par jour, sur `days` derniers jours. */
export async function getRevenueSeries(days = 30) {
  const since = new Date(Date.now() - (days - 1) * DAY_MS);
  since.setHours(0, 0, 0, 0);

  const invoices = await prisma.subscriptionInvoice.findMany({
    where: { status: SubInvoiceStatus.PAID, paidAt: { gte: since } },
    select: { amount: true, paidAt: true },
  });

  const byDay = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const d = new Date(since.getTime() + i * DAY_MS);
    byDay.set(d.toISOString().slice(0, 10), 0);
  }
  for (const inv of invoices) {
    if (!inv.paidAt) continue;
    const key = inv.paidAt.toISOString().slice(0, 10);
    if (byDay.has(key)) byDay.set(key, (byDay.get(key) ?? 0) + Number(inv.amount));
  }
  return [...byDay.entries()].map(([date, revenue]) => ({ date, revenue }));
}

/** Factures de toute la plateforme (cross-tenant), filtrables par statut. */
export async function listAllInvoices(status?: string, limit = 100) {
  const invoices = await prisma.subscriptionInvoice.findMany({
    where: status ? { status: status as SubInvoiceStatus } : undefined,
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { tenant: { select: { name: true, slug: true } } },
  });
  const planIds = [...new Set(invoices.map((i) => i.planId))];
  const plans = await prisma.subscriptionPlan.findMany({
    where: { id: { in: planIds } },
    select: { id: true, name: true },
  });
  const planNames = new Map(plans.map((p) => [p.id, p.name]));

  return invoices.map((i) => ({
    id: i.id,
    number: i.number,
    tenantName: i.tenant.name,
    tenantSlug: i.tenant.slug,
    planName: planNames.get(i.planId) ?? '—',
    amount: Number(i.amount),
    currency: i.currency,
    status: i.status,
    periodStart: i.periodStart,
    periodEnd: i.periodEnd,
    paidAt: i.paidAt,
    createdAt: i.createdAt,
  }));
}

/* ----------------------- Utilisateurs (cross-tenant) ----------------------- */

/** Active/désactive un compte depuis la console fondateur (toutes les sessions sont révoquées à la désactivation). */
export async function setUserActiveCrossTenant(userId: string, isActive: boolean): Promise<{ tenantId: string }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw notFound('Utilisateur introuvable');
  await prisma.user.update({ where: { id: userId }, data: { isActive } });
  if (!isActive) {
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  return { tenantId: user.tenantId };
}

/** Révoque toutes les sessions actives d'un utilisateur (déconnexion forcée immédiate). */
export async function forceLogoutUser(userId: string): Promise<{ tenantId: string }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw notFound('Utilisateur introuvable');
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return { tenantId: user.tenantId };
}
