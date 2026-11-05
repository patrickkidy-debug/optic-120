import type { ReactNode } from 'react';
import clsx from 'clsx';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { RX_STATUS_LABELS, type RxStatus } from '@oculo/shared-types';
import { rx } from '../../features/oculorx/api';
import { formatCurrency } from '../../lib/format';
import { usePermission } from '../../store/auth';

/** Montant en FCFA, police à chasse fixe, aligné à droite par l'appelant. */
export function Money({ value, className, signed }: { value: number | null | undefined; className?: string; signed?: boolean }) {
  if (value == null) return <span className={clsx('font-mono tabular-nums text-content-faint', className)}>—</span>;
  const s = formatCurrency(Math.abs(value));
  return (
    <span className={clsx('whitespace-nowrap font-mono tabular-nums', value < 0 && 'text-danger', className)}>
      {value < 0 ? `− ${s}` : signed && value > 0 ? `+ ${s}` : s}
    </span>
  );
}

const STATUS_TONE: Record<RxStatus, string> = {
  SENT: 'bg-primary-soft text-primary',
  IN_PRODUCTION: 'bg-[color:var(--warning)]/15 text-warning',
  SHIPPED: 'bg-accent-soft text-accent',
  DELIVERED: 'bg-[color:var(--success)]/15 text-success',
  CANCELLED: 'bg-surface-3 text-content-faint',
  RETURNED: 'bg-[color:var(--danger)]/15 text-danger',
};

export function StatusBadge({ status }: { status: RxStatus }) {
  return <span className={clsx('badge whitespace-nowrap', STATUS_TONE[status])}>{RX_STATUS_LABELS[status] ?? status}</span>;
}

/** Évolution par rapport au mois précédent. */
export function Delta({ cur, prev }: { cur: number; prev: number }) {
  if (!prev) return <span className="text-xs text-content-faint">— vs mois précédent</span>;
  const pct = Math.round(((cur - prev) / Math.abs(prev)) * 100);
  const up = pct >= 0;
  return (
    <span className={clsx('inline-flex items-center gap-0.5 text-xs font-semibold', up ? 'text-success' : 'text-danger')}>
      {up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
      {up ? '+' : ''}
      {pct} % <span className="font-normal text-content-faint">vs mois précédent</span>
    </span>
  );
}

export function Panel({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={clsx('card p-4', className)}>
      {(title || actions) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-sm font-bold uppercase tracking-wide text-content-muted">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const s = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date(Date.UTC(y, m - 1, 15)));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function currentMonth(offset = 0): string {
  const d = new Date();
  const x = new Date(d.getFullYear(), d.getMonth() + offset, 1);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`;
}

/** Réglages + droit de voir les marges (le serveur fait foi). */
export function useRx() {
  const { data } = useQuery({ queryKey: ['rx', 'settings'], queryFn: rx.settings, staleTime: 60_000 });
  const manage = usePermission('oculorx.manage');
  const order = usePermission('oculorx.order');
  return { settings: data?.settings, margins: data?.canSeeMargins ?? false, manage, order };
}

export const th = 'px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-content-faint';
export const td = 'px-3 py-2';
