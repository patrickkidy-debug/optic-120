import type { ReactNode } from 'react';
import { CheckCircle2, CircleDashed, Clock3 } from 'lucide-react';
import type { SalesReportParams } from '../../../features/optique/api';

/**
 * Vocabulaire du module, aligné mot pour mot sur sales-report.service.ts.
 * « Chiffre d'affaires » et « Encaissements » ne sont pas synonymes : l'ancienne
 * page affichait le montant encaissé sous le libellé « chiffre d'affaires
 * encaissé », ce qui rendait impossible de voir ce qui restait dû.
 */

export type StatusKey = 'PAID' | 'PARTIALLY_PAID' | 'CONFIRMED';

export const STATUS_META: Record<
  StatusKey,
  { label: string; tone: 'success' | 'warning' | 'danger'; icon: typeof CheckCircle2; color: string }
> = {
  PAID: { label: 'Payée', tone: 'success', icon: CheckCircle2, color: '#0d9488' },
  PARTIALLY_PAID: { label: 'Partielle', tone: 'warning', icon: Clock3, color: '#f59e0b' },
  CONFIRMED: { label: 'Impayée', tone: 'danger', icon: CircleDashed, color: '#dc2626' },
};

export const STATUS_ORDER: StatusKey[] = ['PAID', 'PARTIALLY_PAID', 'CONFIRMED'];

export function statusLabel(status: string): string {
  return STATUS_META[status as StatusKey]?.label ?? status;
}

export const METHOD_LABEL: Record<string, string> = {
  INSURANCE: 'Assurance',
  CASH: 'Espèces',
  CARD: 'Carte',
  CHEQUE: 'Chèque',
  WAVE: 'Wave',
  ORANGE_MONEY: 'Orange Money',
  MTN_MOMO: 'MTN MoMo',
  MOOV_MONEY: 'Moov Money',
  FREE_MONEY: 'Free Money',
  MPESA: 'M-Pesa',
  EMOLA: 'e-Mola',
  MKESH: 'mKesh',
  MULTICAIXA: 'Multicaixa',
};

export function methodLabel(method: string): string {
  return METHOD_LABEL[method] ?? method;
}

/* ------------------------------- Période ------------------------------- */

export type RangeKey =
  | 'today'
  | 'yesterday'
  | 'last7'
  | 'last30'
  | 'thisMonth'
  | 'lastMonth'
  | 'thisYear'
  | 'custom';

export const RANGE_LABEL: Record<RangeKey, string> = {
  today: "Aujourd'hui",
  yesterday: 'Hier',
  last7: '7 derniers jours',
  last30: '30 derniers jours',
  thisMonth: 'Ce mois',
  lastMonth: 'Mois précédent',
  thisYear: 'Cette année',
  custom: 'Personnalisé',
};

export const iso = (d: Date): string => d.toISOString().slice(0, 10);

/**
 * Bornes d'un raccourci de période, en dates civiles (YYYY-MM-DD).
 * Le serveur les interprète en UTC : on reste donc sur des dates nues, sans
 * heure, pour qu'aucun décalage de fuseau ne déplace une journée.
 */
export function rangeBounds(key: RangeKey, today = new Date()): { from: string; to: string } {
  const d = (offsetDays: number): Date => {
    const x = new Date(today);
    x.setDate(x.getDate() + offsetDays);
    return x;
  };
  const monthStart = (offsetMonths: number): Date =>
    new Date(today.getFullYear(), today.getMonth() + offsetMonths, 1);

  switch (key) {
    case 'today':
      return { from: iso(today), to: iso(today) };
    case 'yesterday':
      return { from: iso(d(-1)), to: iso(d(-1)) };
    case 'last7':
      return { from: iso(d(-6)), to: iso(today) };
    case 'last30':
      return { from: iso(d(-29)), to: iso(today) };
    case 'thisMonth':
      return { from: iso(monthStart(0)), to: iso(today) };
    case 'lastMonth':
      return { from: iso(monthStart(-1)), to: iso(new Date(today.getFullYear(), today.getMonth(), 0)) };
    case 'thisYear':
      return { from: iso(new Date(today.getFullYear(), 0, 1)), to: iso(today) };
    default:
      return { from: iso(d(-29)), to: iso(today) };
  }
}

const LONG_DATE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

/** « Du 18 août 2026 au 17 septembre 2026 », ou « Le 17 septembre 2026 ». */
export function describePeriod(from: string, to: string): string {
  const f = new Date(`${from}T12:00:00`);
  const t = new Date(`${to}T12:00:00`);
  if (from === to) return `Le ${LONG_DATE.format(f)}`;
  return `Du ${LONG_DATE.format(f)} au ${LONG_DATE.format(t)}`;
}

/** Libellé d'un point de la série, selon la granularité choisie par le serveur. */
export function bucketLabel(bucket: string, granularity: 'day' | 'week' | 'month'): string {
  if (granularity === 'month') {
    const [y, m] = bucket.split('-');
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('fr-FR', {
      month: 'short',
      year: '2-digit',
    });
  }
  const d = new Date(`${bucket}T12:00:00`);
  const label = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  return granularity === 'week' ? `sem. ${label}` : label;
}

/* ------------------------------ Variations ------------------------------ */

export interface Delta {
  /** null quand la période précédente est à zéro : aucune variation calculable. */
  percent: number | null;
  direction: 'up' | 'down' | 'flat';
}

/**
 * Variation en pourcentage. Partir de zéro n'est pas « +100 % » : c'est une
 * variation non définie, affichée comme telle plutôt qu'inventée.
 */
export function computeDelta(current: number, previous: number): Delta {
  if (previous === 0) return { percent: null, direction: current > 0 ? 'up' : 'flat' };
  const percent = ((current - previous) / Math.abs(previous)) * 100;
  return {
    percent,
    direction: Math.abs(percent) < 0.05 ? 'flat' : percent > 0 ? 'up' : 'down',
  };
}

export function formatDelta(delta: Delta): string {
  if (delta.percent === null) return '—';
  const sign = delta.percent > 0 ? '+' : '';
  return `${sign}${delta.percent.toFixed(1).replace('.', ',')} %`;
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1).replace('.', ',')} %`;
}

/* --------------------------- Filtres du module --------------------------- */

export interface ReportFilters {
  range: RangeKey;
  from: string;
  to: string;
  status: StatusKey[];
  cashierId: string;
  method: string;
  search: string;
}

export function defaultFilters(): ReportFilters {
  const { from, to } = rangeBounds('last30');
  return { range: 'last30', from, to, status: [], cashierId: '', method: '', search: '' };
}

export function hasActiveFilters(f: ReportFilters): boolean {
  const d = defaultFilters();
  return (
    f.range !== d.range ||
    f.status.length > 0 ||
    f.cashierId !== '' ||
    f.method !== '' ||
    f.search.trim() !== ''
  );
}

/** Traduit les filtres de l'écran en paramètres d'API. */
export function toParams(f: ReportFilters, branchId?: string | null): SalesReportParams {
  return {
    from: f.from,
    to: f.to,
    branchId: branchId ?? undefined,
    status: f.status.length > 0 ? f.status.join(',') : undefined,
    cashierId: f.cashierId || undefined,
    method: f.method || undefined,
    search: f.search.trim() || undefined,
  };
}

/* ------------------------------ Squelettes ------------------------------ */

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-surface-3 ${className}`} aria-hidden="true" />;
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h3 className="font-display text-base font-bold text-content">{title}</h3>
      {action}
    </div>
  );
}
