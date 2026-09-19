import { DEFAULT_RENEWAL_TEMPLATE, SubscriptionStatus } from '@oculo/shared-types';
import { prisma } from '../../lib/prisma.js';

/**
 * Relances de renouvellement — console fondateur.
 *
 * L'envoi reste manuel, comme partout ailleurs dans OculoSaaS : un lien wa.me
 * ouvre WhatsApp avec le message déjà rédigé et le fondateur appuie sur
 * Envoyer. Aucune API WhatsApp Business, aucun quota, aucun identifiant à
 * gérer. La contrepartie assumée : on sait que le fondateur a OUVERT la
 * conversation, pas que le message a été délivré ou lu — l'écran parle donc de
 * « relance », jamais de « message reçu ».
 */

const SETTINGS_ID = 'default';
export const RENEWAL_REMINDER_ACTION = 'PLATFORM_RENEWAL_REMINDER';

/** Statuts qui peuvent encore être sauvés par une relance. */
const RECOVERABLE: string[] = [
  SubscriptionStatus.TRIALING,
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.PAST_DUE,
  SubscriptionStatus.SUSPENDED,
];

export interface RenewalRow {
  tenantId: string;
  tenantName: string;
  whatsapp: string | null;
  status: string;
  planName: string;
  planPrice: number;
  currency: string;
  currentPeriodEnd: Date;
  /** Négatif quand l'échéance est dépassée. En millisecondes pour garder la précision des essais courts. */
  msLeft: number;
  autoRenew: boolean;
  lastReminderAt: Date | null;
  reminderCount: number;
}

/**
 * Abonnements à relancer : échéance dans les `withinDays` prochains jours, et
 * — si demandé — échue depuis moins de `expiredDays` jours.
 *
 * `currentPeriodEnd` est la seule date qui compte, essai compris : extendTrial
 * et l'inscription alignent `trialEndsAt` dessus. Un essai dure par défaut
 * deux heures, d'où un délai en millisecondes plutôt qu'en jours entiers —
 * un essai qui expire dans 90 minutes doit apparaître, pas être arrondi à zéro.
 */
export async function listRenewals(withinDays: number, expiredDays: number): Promise<RenewalRow[]> {
  const now = Date.now();
  const from = new Date(now - expiredDays * 86_400_000);
  const to = new Date(now + withinDays * 86_400_000);

  const subs = await prisma.subscription.findMany({
    where: {
      status: { in: RECOVERABLE as never },
      currentPeriodEnd: { gte: from, lte: to },
      // Un établissement de démonstration n'a personne à relancer.
      tenant: { isDemo: false },
    },
    include: {
      plan: true,
      tenant: { select: { id: true, name: true, whatsappPhone: true, currency: true } },
    },
    orderBy: { currentPeriodEnd: 'asc' },
  });

  if (subs.length === 0) return [];

  // Historique des relances en UNE requête groupée, pas une par ligne.
  const history = await prisma.auditLog.groupBy({
    by: ['tenantId'],
    where: { action: RENEWAL_REMINDER_ACTION, tenantId: { in: subs.map((s) => s.tenantId) } },
    _max: { createdAt: true },
    _count: { _all: true },
  });
  const byTenant = new Map(history.map((h) => [h.tenantId, h]));

  return subs.map((s) => {
    const h = byTenant.get(s.tenantId);
    return {
      tenantId: s.tenantId,
      tenantName: s.tenant.name,
      whatsapp: s.tenant.whatsappPhone,
      status: s.status,
      planName: s.plan.name,
      planPrice: Number(s.plan.priceMonthly ?? 0),
      currency: s.tenant.currency ?? 'XOF',
      currentPeriodEnd: s.currentPeriodEnd,
      msLeft: s.currentPeriodEnd.getTime() - now,
      autoRenew: s.autoRenew,
      lastReminderAt: h?._max.createdAt ?? null,
      reminderCount: h?._count._all ?? 0,
    };
  });
}

export async function getRenewalTemplate(): Promise<{ template: string; isDefault: boolean }> {
  const row = await prisma.platformSettings.findUnique({
    where: { id: SETTINGS_ID },
    select: { renewalReminderTemplate: true },
  });
  const saved = row?.renewalReminderTemplate?.trim();
  return saved ? { template: saved, isDefault: false } : { template: DEFAULT_RENEWAL_TEMPLATE, isDefault: true };
}

/** `null` rétablit le modèle par défaut. */
export async function setRenewalTemplate(template: string | null): Promise<{ template: string; isDefault: boolean }> {
  await prisma.platformSettings.upsert({
    where: { id: SETTINGS_ID },
    update: { renewalReminderTemplate: template },
    create: { id: SETTINGS_ID, renewalReminderTemplate: template },
  });
  return getRenewalTemplate();
}
