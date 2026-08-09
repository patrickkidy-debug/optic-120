import { useQuery } from '@tanstack/react-query';
import { ShoppingBag, Wallet, Glasses, Stethoscope, PackagePlus, type LucideIcon } from 'lucide-react';
import { getDashboardActivity, type ActivityItem } from '../../features/optique/api';
import { formatCurrency } from '../../lib/format';

const TYPE_ICON: Record<ActivityItem['type'], LucideIcon> = {
  sale: ShoppingBag,
  payment: Wallet,
  lens_order: Glasses,
  consultation: Stethoscope,
  stock_in: PackagePlus,
};
const TYPE_TONE: Record<ActivityItem['type'], string> = {
  sale: 'bg-primary/10 text-primary',
  payment: 'bg-[color:var(--success)]/15 text-success',
  lens_order: 'bg-accent/10 text-accent',
  consultation: 'bg-[color:var(--warning)]/15 text-warning',
  stock_in: 'bg-surface-3 text-content-muted',
};

function timeLabel(at: string): string {
  return new Date(at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

/** Fil d'activité du jour : ventes, paiements, commandes labo, consultations, réceptions stock. */
export function ActivityFeed({ branchId }: { branchId?: string | null }) {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-activity', branchId],
    queryFn: () => getDashboardActivity(branchId ?? undefined),
  });
  const items = data ?? [];

  return (
    <div className="card p-5">
      <h3 className="mb-4 font-display font-bold text-content">Activité du jour</h3>
      {isLoading ? (
        <p className="text-sm text-content-muted">Chargement…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-content-muted">Aucune activité aujourd'hui.</p>
      ) : (
        <div className="max-h-80 space-y-3 overflow-y-auto">
          {items.map((it) => {
            const Icon = TYPE_ICON[it.type];
            return (
              <div key={it.id} className="flex items-start gap-3">
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${TYPE_TONE[it.type]}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-content">{it.label}</p>
                    <span className="shrink-0 text-xs text-content-faint">{timeLabel(it.at)}</span>
                  </div>
                  <p className="truncate text-xs text-content-muted">
                    {it.detail ?? ''}
                    {it.amount !== null ? `${it.detail ? ' · ' : ''}${formatCurrency(it.amount)}` : ''}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
