import { useQuery } from '@tanstack/react-query';
import { Send, CheckCircle2, Clock, FileText, Wallet, Coins, AlertTriangle } from 'lucide-react';
import { getInsuranceDashboard } from '../../../features/management/api';
import { formatCurrency } from '../../../lib/format';
import { StatCard, PageLoader, ProgressBar } from '../../../components/ui';
import { CLAIM_STATUSES, ClaimStatusBadge } from './shared';

const MONTH_LABELS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

/** Pilotage du module : où en sont les demandes, et ce qui rentre vraiment. */
export function OverviewTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['insurance-dashboard'],
    queryFn: getInsuranceDashboard,
  });

  if (isLoading || !data) return <PageLoader />;
  const t = data.totals;
  const peak = Math.max(1, ...data.months.map((m) => Math.max(m.requested, m.received)));
  const statusTotal = data.byStatus.reduce((s, x) => s + x.count, 0);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Send} label="Demandé" value={formatCurrency(t.requested)} tone="primary" />
        <StatCard icon={CheckCircle2} label="Accepté" value={formatCurrency(t.accepted)} tone="accent" />
        <StatCard icon={Wallet} label="Reçu" value={formatCurrency(t.received)} tone="success" />
        <StatCard
          icon={Coins}
          label="Restant dû"
          value={formatCurrency(t.remaining)}
          hint={`dont ${formatCurrency(t.late)} en retard`}
          tone="danger"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={Clock} label="En attente" value={formatCurrency(t.pending)} tone="accent" />
        <StatCard icon={FileText} label="Facturé" value={formatCurrency(t.invoiced)} tone="primary" />
        <StatCard icon={AlertTriangle} label="En retard" value={formatCurrency(t.late)} tone="danger" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* --------------------------- Évolution --------------------------- */}
        <div className="card p-5">
          <h3 className="font-display font-bold text-content">Évolution sur 12 mois</h3>
          <p className="mt-0.5 text-xs text-content-muted">
            En bleu ce qui a été demandé, en vert ce qui a été encaissé.
          </p>
          <div className="mt-4 flex h-40 items-end gap-1.5">
            {data.months.map((m) => {
              const label = MONTH_LABELS[Number(m.month.slice(5, 7)) - 1];
              return (
                <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex h-32 w-full items-end justify-center gap-0.5">
                    <div
                      className="w-1/2 rounded-t bg-primary/70"
                      style={{ height: `${Math.round((m.requested / peak) * 100)}%` }}
                      title={`Demandé : ${formatCurrency(m.requested)}`}
                    />
                    <div
                      className="w-1/2 rounded-t bg-[color:var(--success)]/70"
                      style={{ height: `${Math.round((m.received / peak) * 100)}%` }}
                      title={`Reçu : ${formatCurrency(m.received)}`}
                    />
                  </div>
                  <span className="text-[10px] text-content-faint">{label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ------------------------ Répartition statuts ------------------------ */}
        <div className="card p-5">
          <h3 className="font-display font-bold text-content">Répartition des statuts</h3>
          {statusTotal === 0 ? (
            <p className="mt-3 text-sm text-content-faint">Aucun dossier sur la période.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {CLAIM_STATUSES.filter((s) => data.byStatus.some((x) => x.status === s.value)).map((s) => {
                const row = data.byStatus.find((x) => x.status === s.value)!;
                return (
                  <div key={s.value}>
                    <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                      <ClaimStatusBadge status={s.value} />
                      <span className="text-content-muted">
                        {row.count} dossier(s) · {formatCurrency(row.amount)}
                      </span>
                    </div>
                    <ProgressBar value={row.count} max={statusTotal} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ----------------------- Assureurs et créances ----------------------- */}
      <div className="card p-5">
        <h3 className="font-display font-bold text-content">Assureurs</h3>
        <p className="mt-0.5 text-xs text-content-muted">
          Ce qui a été demandé à chacun, ce qu'il a versé, ce qu'il doit encore.
        </p>
        {data.byInsurer.length === 0 ? (
          <p className="mt-3 text-sm text-content-faint">Aucun dossier sur la période.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-content-muted">
                  <th className="table-cell font-semibold">Assureur</th>
                  <th className="table-cell text-right font-semibold">Dossiers</th>
                  <th className="table-cell text-right font-semibold">Demandé</th>
                  <th className="table-cell text-right font-semibold">Reçu</th>
                  <th className="table-cell text-right font-semibold">Créance</th>
                </tr>
              </thead>
              <tbody>
                {data.byInsurer.map((i) => (
                  <tr key={i.insurerId} className="border-b last:border-0">
                    <td className="table-cell font-medium text-content">{i.name}</td>
                    <td className="table-cell text-right text-content-muted">{i.claims}</td>
                    <td className="table-cell text-right text-content">{formatCurrency(i.requested)}</td>
                    <td className="table-cell text-right text-success">{formatCurrency(i.received)}</td>
                    <td className="table-cell text-right font-semibold text-warning">
                      {formatCurrency(i.remaining)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
