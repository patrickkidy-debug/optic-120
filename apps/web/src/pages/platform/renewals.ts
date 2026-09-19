import { fillWaTemplate } from '@oculo/shared-types';
import type { RenewalRow } from '../../features/billing/api';
import { formatCurrency } from '../../lib/format';

/**
 * Logique pure des relances : délais, variables du message, états. Séparée du
 * composant pour rester lisible et vérifiable sans navigateur.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

/**
 * Délai lisible, dans les deux sens. L'essai gratuit dure deux heures par
 * défaut : arrondir au jour afficherait « dans 0 jour » pour un essai qui
 * expire dans 90 minutes. On descend donc à l'heure, puis à la minute.
 */
export function describeDelay(msLeft: number): string {
  const abs = Math.abs(msLeft);
  const unit =
    abs >= DAY
      ? plural(Math.round(abs / DAY), 'jour', 'jours')
      : abs >= HOUR
        ? plural(Math.round(abs / HOUR), 'heure', 'heures')
        : plural(Math.max(1, Math.round(abs / MINUTE)), 'minute', 'minutes');
  return msLeft >= 0 ? `dans ${unit}` : `dépassée depuis ${unit}`;
}

export type Urgency = 'expired' | 'critical' | 'soon' | 'later';

/** Urgence de relance — pilote la couleur, jamais le contenu. */
export function urgencyOf(msLeft: number): Urgency {
  if (msLeft < 0) return 'expired';
  if (msLeft <= 2 * DAY) return 'critical';
  if (msLeft <= 7 * DAY) return 'soon';
  return 'later';
}

export const URGENCY_TONE: Record<Urgency, 'danger' | 'warning' | 'info' | 'neutral'> = {
  expired: 'danger',
  critical: 'danger',
  soon: 'warning',
  later: 'neutral',
};

export const STATUS_LABEL: Record<string, string> = {
  TRIALING: 'Essai',
  ACTIVE: 'Actif',
  PAST_DUE: 'En retard',
  SUSPENDED: 'Suspendu',
};

/** Relancé aujourd'hui (même jour civil) : sert à éviter les doublons. */
export function remindedToday(lastReminderAt: string | null, now = new Date()): boolean {
  if (!lastReminderAt) return false;
  const d = new Date(lastReminderAt);
  return (
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
  );
}

/** « il y a 2 jours », « aujourd'hui à 14:05 ». */
export function describeLastReminder(lastReminderAt: string | null, now = new Date()): string {
  if (!lastReminderAt) return 'Jamais relancé';
  const d = new Date(lastReminderAt);
  if (remindedToday(lastReminderAt, now)) {
    return `Aujourd'hui à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  }
  const days = Math.max(1, Math.round((now.getTime() - d.getTime()) / DAY));
  return `Il y a ${plural(days, 'jour', 'jours')}`;
}

/** Minuscules, sans accents : « Lumière » doit se trouver en tapant « lumiere ». */
function normalize(v: string): string {
  return v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Recherche sur le nom de l'établissement, son numéro WhatsApp et l'offre.
 * Pour le numéro, seuls les chiffres comptent : « 07 00 00 » doit trouver
 * « +2250700000000 », quel que soit le format saisi à l'inscription.
 */
export function matchesRenewal(row: RenewalRow, query: string): boolean {
  const q = query.trim();
  if (!q) return true;
  const text = normalize(q);
  if (normalize(row.tenantName).includes(text) || normalize(row.planName).includes(text)) return true;
  const digits = q.replace(/\D/g, '');
  return digits.length > 0 && (row.whatsapp ?? '').replace(/\D/g, '').includes(digits);
}

/** Variables du message pour un établissement donné. */
export function renewalVars(row: RenewalRow, activationUrl: string): Record<string, string> {
  return {
    etablissement: row.tenantName,
    offre: row.planName,
    echeance: new Date(row.currentPeriodEnd).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
    delai: describeDelay(row.msLeft),
    montant: formatCurrency(row.planPrice, row.currency),
    lien: activationUrl,
  };
}

export function renderRenewalMessage(template: string, row: RenewalRow, activationUrl: string): string {
  return fillWaTemplate(template, renewalVars(row, activationUrl));
}
