import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { SUB_INVOICE_STATUS_META, type SubInvoiceStatus } from '@oculo/shared-types';
import { Badge } from '../../../components/ui';
import type { Invoice } from '../../../features/billing/invoicing';

/** Nuances des cartes d'indicateur, alignées sur celles de la console. */
export const KPI_TONES = {
  primary: 'bg-primary/10 text-primary',
  accent: 'bg-accent/10 text-accent',
  success: 'bg-[color:var(--success)]/10 text-success',
  warning: 'bg-[color:var(--warning)]/10 text-warning',
  danger: 'bg-[color:var(--danger)]/10 text-danger',
} as const;

export function BillingKpi({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone: keyof typeof KPI_TONES;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-content-muted">{label}</p>
          <p className="mt-1 font-display text-xl font-bold text-content">{value}</p>
        </div>
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${KPI_TONES[tone]}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      {sub && <div className="mt-2 text-xs text-content-faint">{sub}</div>}
    </div>
  );
}

/**
 * Badge de statut. Le retard prime sur « En attente » : c'est lui qui appelle
 * une action, et le masquer derrière un statut neutre coûte de l'argent.
 */
export function InvoiceStatusBadge({ invoice }: { invoice: Invoice }) {
  if (invoice.kind === 'CREDIT_NOTE') return <Badge tone="info">Avoir</Badge>;
  if (invoice.overdue) return <Badge tone="danger">En retard</Badge>;
  const meta = SUB_INVOICE_STATUS_META[invoice.status as SubInvoiceStatus];
  return <Badge tone={meta?.tone ?? 'neutral'}>{meta?.label ?? invoice.status}</Badge>;
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-surface-3 ${className}`} />;
}

/** Date au format court, sans lever sur une valeur absente. */
export function shortDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? '—'
    : new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
}

export function longDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? '—'
    : new Intl.DateTimeFormat('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(d);
}

/** Bornes ISO (AAAA-MM-JJ) d'une période exprimée en nombre de jours. */
export function boundsForDays(days: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - (days - 1) * 86_400_000);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

/** Lien wa.me prérempli. Renvoie null si le numéro ne contient aucun chiffre. */
export function waLinkWithText(phone: string | null | undefined, text: string): string | null {
  const digits = (phone ?? '').replace(/[^0-9]/g, '');
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
