import { useQuery } from '@tanstack/react-query';
import { Line } from 'react-chartjs-2';
import type { ChartOptions } from 'chart.js';
import { Sparkles, TrendingUp, TrendingDown, CalendarDays, PackageX, LineChart } from 'lucide-react';
import { getForecast } from '../features/optique/api';
import { useUIStore } from '../store/ui';
import { formatCurrency } from '../lib/format';

const CHART_OPTIONS: ChartOptions<'line'> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false }, tooltip: { intersect: false, mode: 'index' } },
  scales: {
    x: { grid: { display: false }, ticks: { color: '#94a3b8', maxTicksLimit: 8 } },
    y: { grid: { color: 'rgba(148,163,184,0.1)' }, ticks: { color: '#94a3b8' } },
  },
};

export function ForecastPanel() {
  const branchId = useUIStore((s) => s.activeBranchId);
  const { data, isLoading } = useQuery({
    queryKey: ['forecast', branchId],
    queryFn: () => getForecast(branchId ?? undefined),
    staleTime: 5 * 60_000,
  });

  const up = (data?.trendPct ?? 0) >= 0;

  const labels = data ? [...data.history.map((d) => d.date.slice(5)), ...data.forecast.map((d) => d.date.slice(5))] : [];
  const lastHist = data && data.history.length ? data.history[data.history.length - 1].revenue : 0;
  const chartData = {
    labels,
    datasets: data
      ? [
          {
            label: 'Réalisé',
            data: [...data.history.map((d) => d.revenue), ...data.forecast.map(() => null)],
            borderColor: '#8b5cf6',
            backgroundColor: 'rgba(139,92,246,0.12)',
            fill: true,
            tension: 0.35,
            pointRadius: 0,
          },
          {
            label: 'Prévision',
            data: [
              ...data.history.map((_, i) => (i === data.history.length - 1 ? lastHist : null)),
              ...data.forecast.map((d) => d.revenue),
            ],
            borderColor: '#22d3ee',
            borderDash: [6, 4],
            backgroundColor: 'rgba(34,211,238,0.08)',
            fill: true,
            tension: 0.35,
            pointRadius: 0,
          },
        ]
      : [],
  };

  return (
    <div className="mt-6 card overflow-hidden p-0">
      <div className="flex items-center gap-2.5 border-b border-line bg-primary-soft/40 px-5 py-3.5">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-white">
          <Sparkles className="h-4 w-4" />
        </span>
        <div>
          <h3 className="font-display font-bold text-content">IA prédictive — Prévisions économiques</h3>
          <p className="text-xs text-content-muted">Basée sur l'historique de vos ventes (tendance + saisonnalité)</p>
        </div>
      </div>

      <div className="p-5">
        {isLoading ? (
          <div className="grid h-40 place-items-center text-sm text-content-muted">
            Analyse en cours…
          </div>
        ) : !data || !data.hasEnoughData ? (
          <div className="flex items-start gap-3 rounded-xl border border-line bg-surface-2/40 p-4">
            <LineChart className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="font-semibold text-content">Prévisions bientôt disponibles</p>
              <p className="text-sm text-content-muted">
                Enregistrez quelques jours de ventes : l'IA apprendra vos habitudes pour prévoir
                votre chiffre d'affaires et anticiper les ruptures de stock.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            {/* Chiffres clés */}
            <div className="space-y-3">
              <div className="rounded-2xl border border-primary/20 bg-primary-soft/40 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-content-muted">
                  CA projeté ce mois
                </div>
                <div className="mt-1 font-display text-2xl font-extrabold text-gradient">
                  {formatCurrency(data.projectedMonthRevenue)}
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-xs">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold ${
                      up ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'
                    }`}
                  >
                    {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {up ? '+' : ''}
                    {data.trendPct}%
                  </span>
                  <span className="text-content-muted">vs 14 jours précédents</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-line bg-surface-2/40 p-3">
                  <div className="flex items-center gap-1.5 text-[11px] text-content-muted">
                    <TrendingUp className="h-3.5 w-3.5" /> Prévision 7 jours
                  </div>
                  <div className="mt-1 text-lg font-bold text-content">{formatCurrency(data.next7Total)}</div>
                </div>
                <div className="rounded-xl border border-line bg-surface-2/40 p-3">
                  <div className="flex items-center gap-1.5 text-[11px] text-content-muted">
                    <CalendarDays className="h-3.5 w-3.5" /> Meilleur jour
                  </div>
                  <div className="mt-1 text-lg font-bold text-content">{data.bestWeekday?.label ?? '—'}</div>
                </div>
              </div>

              <div className="rounded-xl border border-line bg-surface-2/40 p-3 text-xs text-content-muted">
                Mois précédent : <b className="text-content">{formatCurrency(data.lastMonthRevenue)}</b>
              </div>
            </div>

            {/* Graphique prévisionnel */}
            <div className="lg:col-span-2">
              <div className="mb-2 flex items-center gap-4 text-xs text-content-muted">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-primary" /> Réalisé (30 j)
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-4 rounded-full border-2 border-dashed border-cyan" /> Prévision (14 j)
                </span>
              </div>
              <div className="h-56">
                <Line data={chartData} options={CHART_OPTIONS} />
              </div>

              {data.stockRisks.length > 0 && (
                <div className="mt-3 rounded-xl border border-[color:var(--danger)]/25 bg-[color:var(--danger)]/5 p-3">
                  <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-danger">
                    <PackageX className="h-4 w-4" /> Ruptures de stock à venir
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {data.stockRisks.map((r) => (
                      <span
                        key={r.product}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-surface px-2.5 py-1 text-xs text-content"
                      >
                        {r.product}
                        <b className={r.daysLeft <= 7 ? 'text-danger' : 'text-accent'}>
                          ~{r.daysLeft} j
                        </b>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
