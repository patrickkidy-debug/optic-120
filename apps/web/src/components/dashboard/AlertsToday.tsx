import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, PackageCheck, Wrench, BellRing, ShieldCheck, type LucideIcon } from 'lucide-react';
import { listLensOrders, listRenewals, listRepairs } from '../../features/optique/api';
import { getInsuranceSummary } from '../../features/management/api';
import { formatCurrency } from '../../lib/format';

type Tone = 'warning' | 'danger' | 'accent' | 'primary';
const TONE_CLASSES: Record<Tone, string> = {
  warning: 'bg-[color:var(--warning)]/15 text-warning',
  danger: 'bg-[color:var(--danger)]/15 text-danger',
  accent: 'bg-accent/10 text-accent',
  primary: 'bg-primary/10 text-primary',
};

/**
 * Alertes du jour : composées côté client à partir de données déjà en cache
 * (commandes labo, réparations, renouvellements, stock, assurances) —
 * aucun appel réseau supplémentaire hors ceux déjà faits par les autres
 * widgets du tableau de bord.
 */
export function AlertsToday({
  lowStockCount,
  canOrders,
  canCustomers,
  canInsurance,
}: {
  lowStockCount: number;
  canOrders: boolean;
  canCustomers: boolean;
  canInsurance: boolean;
}) {
  const { data: orders } = useQuery({ queryKey: ['lens-orders'], queryFn: () => listLensOrders(), enabled: canOrders });
  const { data: repairs } = useQuery({ queryKey: ['repairs'], queryFn: () => listRepairs(), enabled: canOrders });
  const { data: renewals } = useQuery({ queryKey: ['renewals'], queryFn: listRenewals, enabled: canCustomers });
  const { data: insurance } = useQuery({
    queryKey: ['insurance-summary'],
    queryFn: getInsuranceSummary,
    enabled: canInsurance,
  });

  const receivedCount = (orders ?? []).filter((o) => o.status === 'RECEIVED').length;
  const readyRepairs = (repairs ?? []).filter((r) => r.status === 'READY').length;
  const renewalsCount = (renewals ?? []).length;

  const rows: { icon: LucideIcon; label: string; tone: Tone }[] = [];
  if (receivedCount > 0) {
    rows.push({ icon: PackageCheck, label: `${receivedCount} commande(s) de verres reçue(s) à monter`, tone: 'accent' });
  }
  if (readyRepairs > 0) {
    rows.push({ icon: Wrench, label: `${readyRepairs} réparation(s) prête(s) à remettre`, tone: 'accent' });
  }
  if (lowStockCount > 0) {
    rows.push({ icon: AlertTriangle, label: `${lowStockCount} produit(s) en stock faible`, tone: 'warning' });
  }
  if (renewalsCount > 0) {
    rows.push({ icon: BellRing, label: `${renewalsCount} client(s) à recontacter`, tone: 'primary' });
  }
  if (insurance && insurance.pending > 0) {
    rows.push({ icon: ShieldCheck, label: `Assurance en attente : ${formatCurrency(insurance.pending)}`, tone: 'primary' });
  }

  if (rows.length === 0) return null;

  return (
    <div className="card p-5">
      <h3 className="mb-4 font-display font-bold text-content">À traiter aujourd'hui</h3>
      <div className="space-y-2">
        {rows.map((r, i) => {
          const Icon = r.icon;
          return (
            <div key={i} className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2.5">
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${TONE_CLASSES[r.tone]}`}>
                <Icon className="h-4 w-4" />
              </span>
              <p className="text-sm text-content">{r.label}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
