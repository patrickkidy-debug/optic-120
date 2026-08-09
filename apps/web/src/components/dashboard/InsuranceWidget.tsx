import { useQuery } from '@tanstack/react-query';
import { HandCoins, ShieldCheck, Clock, AlertTriangle } from 'lucide-react';
import { getInsuranceSummary } from '../../features/management/api';
import { MiniMetric } from './MiniMetric';

/** Résumé des remboursements assurance : à recouvrer / payé / en attente / en retard. */
export function InsuranceWidget({ enabled }: { enabled: boolean }) {
  const { data, isLoading } = useQuery({ queryKey: ['insurance-summary'], queryFn: getInsuranceSummary, enabled });

  if (!enabled || isLoading || !data) return null;
  if (data.paid === 0 && data.pending === 0 && data.late === 0) return null;

  return (
    <div className="card p-5">
      <h3 className="mb-4 font-display font-bold text-content">Assurances</h3>
      <div className="grid grid-cols-2 gap-3">
        <MiniMetric icon={HandCoins} label="À recouvrer" value={data.toCollect} tone="primary" currency />
        <MiniMetric icon={ShieldCheck} label="Payé" value={data.paid} tone="success" currency />
        <MiniMetric icon={Clock} label="En attente" value={data.pending} tone="accent" currency />
        <MiniMetric
          icon={AlertTriangle}
          label="En retard"
          value={data.late}
          tone={data.late > 0 ? 'danger' : 'success'}
          currency
        />
      </div>
    </div>
  );
}
