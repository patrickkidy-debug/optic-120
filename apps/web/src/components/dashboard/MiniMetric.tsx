import type { LucideIcon } from 'lucide-react';
import { formatCurrency } from '../../lib/format';

const TONE_CLASSES: Record<string, string> = {
  primary: 'bg-primary/10 text-primary',
  accent: 'bg-accent/10 text-accent',
  success: 'bg-[color:var(--success)]/15 text-success',
  warning: 'bg-[color:var(--warning)]/15 text-warning',
  danger: 'bg-[color:var(--danger)]/15 text-danger',
};

/** Petite tuile chiffre-clé (icône + valeur + libellé), réutilisée par les widgets du tableau de bord. */
export function MiniMetric({
  icon: Icon,
  label,
  value,
  tone = 'primary',
  currency = false,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  tone?: keyof typeof TONE_CLASSES;
  currency?: boolean;
}) {
  return (
    <div className="rounded-xl bg-surface-2 p-3">
      <span className={`mb-2 inline-grid h-8 w-8 place-items-center rounded-lg ${TONE_CLASSES[tone]}`}>
        <Icon className="h-4 w-4" />
      </span>
      <p className="font-display text-lg font-bold text-content">{currency ? formatCurrency(value) : value}</p>
      <p className="text-xs text-content-muted">{label}</p>
    </div>
  );
}
