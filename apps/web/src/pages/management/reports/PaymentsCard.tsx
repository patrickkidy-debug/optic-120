import '../../../lib/chart-setup';
import { Doughnut } from 'react-chartjs-2';
import type { ReportStatusBucket, ReportTotals } from '../../../features/optique/api';
import { formatCurrency } from '../../../lib/format';
import { STATUS_META, STATUS_ORDER, Skeleton, formatPercent } from './shared';
import type { StatusKey } from './shared';

export function PaymentsSkeleton() {
  return (
    <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
      <section className="card p-4">
        <Skeleton className="mb-3 h-5 w-40" />
        <Skeleton className="h-[220px] w-full" />
      </section>
      <section className="card p-4">
        <Skeleton className="mb-3 h-5 w-40" />
        <Skeleton className="h-[220px] w-full" />
      </section>
    </div>
  );
}

/**
 * État des paiements et encaissements.
 *
 * La répartition porte sur TOUS les statuts, même quand un filtre de statut est
 * actif : un camembert qui n'afficherait que la tranche filtrée répondrait
 * « 100 % payées » à une question que personne n'a posée.
 */
export function PaymentsCard({
  breakdown,
  summary,
  onPickStatus,
}: {
  breakdown: ReportStatusBucket[];
  summary: ReportTotals;
  onPickStatus: (status: StatusKey) => void;
}) {
  const ordered = STATUS_ORDER.map(
    (key) =>
      breakdown.find((b) => b.status === key) ?? {
        status: key,
        count: 0,
        total: 0,
        paid: 0,
        balance: 0,
      },
  );
  const totalCount = ordered.reduce((sum, b) => sum + b.count, 0);

  return (
    <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
      <section className="card p-4" aria-label="État des paiements">
        <h3 className="mb-3 font-display text-base font-bold text-content">État des paiements</h3>

        {totalCount === 0 ? (
          <p className="py-12 text-center text-sm text-content-muted">
            Aucune vente sur cette période.
          </p>
        ) : (
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <div className="h-[180px] w-[180px] shrink-0">
              <Doughnut
                data={{
                  labels: ordered.map((b) => STATUS_META[b.status as StatusKey].label),
                  datasets: [
                    {
                      data: ordered.map((b) => b.count),
                      backgroundColor: ordered.map((b) => STATUS_META[b.status as StatusKey].color),
                      borderWidth: 0,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  cutout: '68%',
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      callbacks: {
                        label: (item) => {
                          const b = ordered[item.dataIndex];
                          return `${b.count} vente${b.count > 1 ? 's' : ''} — ${formatCurrency(b.total)}`;
                        },
                      },
                    },
                  },
                }}
              />
            </div>

            <ul className="w-full space-y-1.5">
              {ordered.map((b) => {
                const meta = STATUS_META[b.status as StatusKey];
                const Icon = meta.icon;
                return (
                  <li key={b.status}>
                    <button
                      type="button"
                      onClick={() => onPickStatus(b.status as StatusKey)}
                      className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-surface-2"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <Icon className="h-4 w-4 shrink-0" style={{ color: meta.color }} aria-hidden="true" />
                        <span className="truncate text-content">{meta.label}</span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block font-semibold text-content">
                          {b.count} vente{b.count > 1 ? 's' : ''}
                        </span>
                        <span className="block text-xs text-content-faint">
                          {b.status === 'PAID'
                            ? formatCurrency(b.total)
                            : `${formatCurrency(b.balance)} restant`}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      <section className="card p-4" aria-label="Encaissements">
        <h3 className="mb-1 font-display text-base font-bold text-content">Encaissements</h3>
        <p className="mb-4 text-xs text-content-faint">
          Chiffre d'affaires, encaissé et reste à percevoir sont trois montants distincts.
        </p>

        <dl className="space-y-2.5 text-sm">
          <Row label="Montant total des ventes" value={formatCurrency(summary.revenue)} />
          <Row label="Montant encaissé" value={formatCurrency(summary.collected)} tone="success" />
          <Row label="Montant restant" value={formatCurrency(summary.outstanding)} tone="warning" />
        </dl>

        <div className="mt-4">
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-xs text-content-muted">Taux d'encaissement</span>
            <span className="font-display text-lg font-bold text-content">
              {formatPercent(summary.collectionRate)}
            </span>
          </div>
          <div
            className="h-2.5 w-full overflow-hidden rounded-full bg-surface-3"
            role="progressbar"
            aria-valuenow={Math.round(summary.collectionRate)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Taux d'encaissement"
          >
            <div
              className="h-full rounded-full bg-[color:var(--success)] transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, summary.collectionRate))}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-content-faint">
            100 % correspond au total facturé sur la période.
          </p>
        </div>
      </section>
    </div>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'success' | 'warning';
}) {
  const color =
    tone === 'success' ? 'text-success' : tone === 'warning' ? 'text-warning' : 'text-content';
  return (
    <div className="flex items-center justify-between gap-2 border-b pb-2 last:border-0 last:pb-0">
      <dt className="text-content-muted">{label}</dt>
      <dd className={`font-display font-bold ${color}`}>{value}</dd>
    </div>
  );
}
