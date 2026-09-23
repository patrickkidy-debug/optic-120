import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import '../../../lib/chart-setup';
import { Line } from 'react-chartjs-2';
import type { Chart as ChartJS } from 'chart.js';
import {
  AlertTriangle,
  BadgeCheck,
  Clock,
  CreditCard,
  FileText,
  Plus,
  RefreshCcw,
  Repeat,
  Send,
  Wallet,
} from 'lucide-react';
import {
  BILLING_PERIODS,
  BILLING_PERIOD_DAYS,
  BILLING_PERIOD_LABELS,
  type BillingPeriod,
} from '@oculo/shared-types';
import { getBillingOverview } from '../../../features/billing/invoicing';
import { formatCurrency } from '../../../lib/format';
import { Button } from '../../../components/ui';
import { BillingKpi, Skeleton, boundsForDays } from './shared';

/**
 * Tableau de bord de la facturation.
 *
 * Les montants sont affichés séparément, parce que les confondre est la façon
 * la plus courante de se croire plus riche qu'on ne l'est :
 *   - encaissé brut : l'argent reçu sur la période ;
 *   - net : encaissé moins les remboursements réellement sortis de caisse ;
 *   - en attente : facturé mais pas encore reçu — ce n'est PAS du revenu ;
 *   - avoirs : des documents émis, comptés à part, jamais retranchés du net
 *     (les retrancher en plus des remboursements compterait deux fois le même
 *     retour).
 */
export function BillingOverviewTab({
  onCreateInvoice,
  onSendInvoice,
}: {
  onCreateInvoice: () => void;
  onSendInvoice: () => void;
}) {
  const [period, setPeriod] = useState<BillingPeriod>('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const bounds = useMemo(() => {
    if (period === 'custom') {
      return customFrom && customTo ? { from: customFrom, to: customTo } : boundsForDays(30);
    }
    return boundsForDays(BILLING_PERIOD_DAYS[period]);
  }, [period, customFrom, customTo]);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['platform-billing-overview', bounds.from, bounds.to],
    queryFn: () => getBillingOverview(bounds),
  });

  if (isError) {
    return (
      <div className="card p-8 text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-danger" />
        <p className="mt-3 font-semibold text-content">Impossible de charger les indicateurs</p>
        <p className="mt-1 text-sm text-content-muted">
          Les chiffres ne sont pas affichés plutôt que d’être affichés faux.
        </p>
        <Button variant="outline" className="mt-4" onClick={() => refetch()}>
          <RefreshCcw className="h-4 w-4" /> Réessayer
        </Button>
      </div>
    );
  }

  const chart = {
    labels: (data?.series ?? []).map((p) => p.date.slice(5)),
    datasets: [
      {
        data: (data?.series ?? []).map((p) => p.amount),
        borderColor: '#0d9488',
        backgroundColor: (ctx: { chart: ChartJS }) => {
          const { ctx: c, chartArea } = ctx.chart;
          if (!chartArea) return 'rgba(13,148,136,0.15)';
          const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          g.addColorStop(0, 'rgba(13,148,136,0.30)');
          g.addColorStop(1, 'rgba(13,148,136,0)');
          return g;
        },
        fill: true,
        tension: 0.4,
        borderWidth: 2.5,
        pointRadius: (data?.series ?? []).length > 45 ? 0 : 2,
        pointHoverRadius: 5,
      },
    ],
  };

  return (
    <div>
      {/* Actions rapides (§28) : les deux gestes du quotidien, toujours visibles. */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Button onClick={onCreateInvoice}>
            <Plus className="h-4 w-4" /> Créer une facture
          </Button>
          <Button variant="outline" onClick={onSendInvoice}>
            <Send className="h-4 w-4" /> Envoyer une facture
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-1">
          {BILLING_PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              aria-pressed={period === p}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                period === p
                  ? 'bg-primary text-white'
                  : 'bg-surface-2 text-content-muted hover:bg-surface-3 hover:text-content'
              }`}
            >
              {BILLING_PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {period === 'custom' && (
        <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl bg-surface-2 p-3">
          <label className="block">
            <span className="label">Du</span>
            <input
              type="date"
              className="input"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="label">Au</span>
            <input
              type="date"
              className="input"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
            />
          </label>
          {(!customFrom || !customTo) && (
            <p className="pb-2 text-xs text-content-faint">
              Choisissez les deux bornes — en attendant, les 30 derniers jours sont affichés.
            </p>
          )}
        </div>
      )}

      {isLoading || !data ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : (
        <>
          <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 ${isFetching ? 'opacity-70' : ''}`}>
            <BillingKpi
              icon={Wallet}
              tone="success"
              label="Chiffre d'affaires encaissé"
              value={formatCurrency(data.revenue.net)}
              sub={
                data.revenue.refunded > 0
                  ? `${formatCurrency(data.revenue.gross)} encaissés, moins ${formatCurrency(data.revenue.refunded)} remboursés`
                  : `${data.revenue.paymentsCount} paiement${data.revenue.paymentsCount > 1 ? 's' : ''} sur la période`
              }
            />
            <BillingKpi
              icon={Repeat}
              tone="primary"
              label="Revenus récurrents (MRR)"
              value={formatCurrency(data.mrr)}
              sub={`${data.activeSubscriptions} abonnement${data.activeSubscriptions > 1 ? 's' : ''} actif${data.activeSubscriptions > 1 ? 's' : ''} · ARPU ${formatCurrency(data.arpu)}`}
            />
            <BillingKpi
              icon={Clock}
              tone="warning"
              label="Paiements en attente"
              value={formatCurrency(data.outstanding)}
              sub={`${data.invoices.pending} facture${data.invoices.pending > 1 ? 's' : ''} non réglée${data.invoices.pending > 1 ? 's' : ''}, dont ${data.invoices.overdue} en retard`}
            />
            <BillingKpi
              icon={AlertTriangle}
              tone={data.failed.count > 0 ? 'danger' : 'primary'}
              label="Paiements échoués"
              value={data.failed.count}
              sub={`${formatCurrency(data.failed.amount)} non encaissés`}
            />
            <BillingKpi
              icon={RefreshCcw}
              tone="accent"
              label="Remboursements"
              value={formatCurrency(data.refunds.amount)}
              sub={`${data.refunds.count} remboursement${data.refunds.count > 1 ? 's' : ''} · ${data.creditNotes.count} avoir${data.creditNotes.count > 1 ? 's' : ''}`}
            />
            <BillingKpi
              icon={BadgeCheck}
              tone="success"
              label="Factures payées"
              value={data.invoices.paid}
              sub={`sur ${data.invoices.total} émise${data.invoices.total > 1 ? 's' : ''}`}
            />
            <BillingKpi
              icon={FileText}
              tone="primary"
              label="Factures annulées"
              value={data.invoices.cancelled}
              sub={`${data.invoices.refunded} remboursée${data.invoices.refunded > 1 ? 's' : ''}`}
            />
            <BillingKpi
              icon={CreditCard}
              tone="accent"
              label="Moyen de paiement dominant"
              value={data.byMethod[0]?.label ?? '—'}
              sub={data.byMethod[0] ? formatCurrency(data.byMethod[0].amount) : 'Aucun paiement sur la période'}
            />
          </div>

          <section className="card mt-5 p-4" aria-label="Revenus OculoSaaS">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <div>
                <h3 className="font-display text-base font-bold text-content">Revenus OculoSaaS</h3>
                <p className="text-xs text-content-faint">
                  Encaissements réels, jour par jour. Les jours sans paiement valent zéro et ne sont
                  pas sautés — une courbe qui saute les jours vides donne une pente fausse.
                </p>
              </div>
            </div>
            {data.series.every((p) => p.amount === 0) ? (
              <p className="py-14 text-center text-sm text-content-muted">
                Aucun encaissement sur cette période.
              </p>
            ) : (
              <div className="h-[260px]">
                <Line
                  data={chart}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    plugins: {
                      legend: { display: false },
                      tooltip: {
                        callbacks: { label: (c) => formatCurrency(Number(c.parsed.y)) },
                      },
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                        ticks: { callback: (v) => formatCurrency(Number(v)), maxTicksLimit: 5 },
                        grid: { color: 'rgba(148,163,184,0.18)' },
                      },
                      x: { grid: { display: false }, ticks: { maxTicksLimit: 12, autoSkip: true } },
                    },
                  }}
                />
              </div>
            )}
          </section>

          {data.byMethod.length > 0 && (
            <section className="card mt-4 p-4" aria-label="Répartition par moyen de paiement">
              <h3 className="mb-3 font-display text-base font-bold text-content">
                Répartition par moyen de paiement
              </h3>
              <ul className="space-y-2">
                {data.byMethod.map((m) => {
                  const share = data.revenue.gross > 0 ? (m.amount / data.revenue.gross) * 100 : 0;
                  return (
                    <li key={m.method}>
                      <div className="mb-1 flex items-baseline justify-between text-sm">
                        <span className="text-content">{m.label}</span>
                        <span className="font-semibold text-content">{formatCurrency(m.amount)}</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-3">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${Math.min(100, share)}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
