import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, Play, Pause, RefreshCw, Server } from 'lucide-react';
import {
  listAllSubscriptions,
  platformSuspend,
  platformReactivate,
  runBilling,
} from '../../features/billing/api';
import { apiErrorMessage } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { PageHeader, Button, Badge, PageLoader, EmptyState } from '../../components/ui';

const STATUS: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' | 'info' }> = {
  TRIALING: { label: 'Essai', tone: 'info' },
  ACTIVE: { label: 'Actif', tone: 'success' },
  PAST_DUE: { label: 'En retard', tone: 'warning' },
  SUSPENDED: { label: 'Suspendu', tone: 'danger' },
  CANCELLED: { label: 'Annulé', tone: 'danger' },
};

export function PlatformPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['platform-subs'], queryFn: listAllSubscriptions });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['platform-subs'] });
  const suspendMut = useMutation({ mutationFn: platformSuspend, onSuccess: invalidate, onError: (e) => alert(apiErrorMessage(e)) });
  const reactivateMut = useMutation({ mutationFn: platformReactivate, onSuccess: invalidate, onError: (e) => alert(apiErrorMessage(e)) });
  const billingMut = useMutation({
    mutationFn: runBilling,
    onSuccess: (r) => {
      invalidate();
      alert(`Cycle exécuté : ${r.markedPastDue} en retard, ${r.suspended} suspendu(s).`);
    },
    onError: (e) => alert(apiErrorMessage(e)),
  });

  return (
    <div>
      <PageHeader
        title="Console plateforme"
        subtitle="Administration des abonnements de tous les établissements"
        actions={
          <Button variant="outline" onClick={() => billingMut.mutate()} loading={billingMut.isPending}>
            <RefreshCw className="h-4 w-4" /> Lancer le cycle de facturation
          </Button>
        }
      />

      {isLoading ? (
        <PageLoader />
      ) : !data || data.length === 0 ? (
        <EmptyState icon={Server} title="Aucun abonnement" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-content-faint">
                <th className="table-cell font-semibold">Établissement</th>
                <th className="table-cell font-semibold">Offre</th>
                <th className="table-cell font-semibold">Statut</th>
                <th className="table-cell font-semibold">Échéance</th>
                <th className="table-cell text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map((s) => (
                <tr key={s.tenantId} className="border-b last:border-0 hover:bg-surface-2/50">
                  <td className="table-cell">
                    <div className="flex items-center gap-3">
                      <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary-soft text-primary">
                        <Building2 className="h-4 w-4" />
                      </span>
                      <div>
                        <div className="font-medium text-content">{s.tenantName}</div>
                        <div className="text-xs text-content-faint">{s.tenantSlug}</div>
                      </div>
                    </div>
                  </td>
                  <td className="table-cell text-content-muted">{s.planName}</td>
                  <td className="table-cell"><Badge tone={STATUS[s.status]?.tone ?? 'neutral'}>{STATUS[s.status]?.label ?? s.status}</Badge></td>
                  <td className="table-cell text-content-muted">{formatDate(s.currentPeriodEnd)}</td>
                  <td className="table-cell text-right">
                    {s.status === 'SUSPENDED' ? (
                      <button onClick={() => reactivateMut.mutate(s.tenantId)} className="btn-outline h-8 rounded-lg px-2.5 text-xs text-success">
                        <Play className="h-3.5 w-3.5" /> Réactiver
                      </button>
                    ) : (
                      <button onClick={() => { if (confirm(`Suspendre ${s.tenantName} ?`)) suspendMut.mutate(s.tenantId); }} className="btn-ghost h-8 rounded-lg px-2.5 text-xs text-danger">
                        <Pause className="h-3.5 w-3.5" /> Suspendre
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
