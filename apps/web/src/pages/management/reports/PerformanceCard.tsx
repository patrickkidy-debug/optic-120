import { useState } from 'react';
import '../../../lib/chart-setup';
import { Line } from 'react-chartjs-2';
import type { Chart as ChartJS, TooltipItem } from 'chart.js';
import type { ReportSeriesPoint } from '../../../features/optique/api';
import { formatCurrency } from '../../../lib/format';
import { Skeleton, bucketLabel } from './shared';
import { tr } from '../../../lib/tr';

type Metric = 'revenue' | 'collected' | 'count';

const METRICS: { key: Metric; label: string; color: string; money: boolean }[] = [
  { key: 'revenue', get label() { return tr('ui.PerformanceCard.chiffreDAffaires'); }, color: '#7c3aed', money: true },
  { key: 'collected', get label() { return tr('ui.PerformanceCard.encaissements'); }, color: '#0d9488', money: true },
  { key: 'count', get label() { return tr('ui.PerformanceCard.nombreDeVentes'); }, color: '#2563eb', money: false },
];

const GRANULARITY_NOTE: Record<'day' | 'week' | 'month', string> = {
  get day() { return tr('ui.PerformanceCard.regroupeParJour'); },
  get week() { return tr('ui.PerformanceCard.regroupeParSemaine'); },
  get month() { return tr('ui.PerformanceCard.regroupeParMois'); },
};

export function PerformanceCardSkeleton() {
  return (
    <section className="card mb-4 p-4">
      <Skeleton className="mb-3 h-5 w-48" />
      <Skeleton className="h-[260px] w-full" />
    </section>
  );
}

/**
 * Évolution sur la période. Le pas (jour / semaine / mois) est choisi par le
 * serveur en fonction de la durée : au-delà d'un mois, un point par jour rend
 * la courbe illisible sans rien apprendre de plus.
 */
export function PerformanceCard({
  series,
  granularity,
}: {
  series: ReportSeriesPoint[];
  granularity: 'day' | 'week' | 'month';
}) {
  const [metric, setMetric] = useState<Metric>('revenue');
  const active = METRICS.find((m) => m.key === metric)!;

  const chartData = {
    labels: series.map((p) => bucketLabel(p.bucket, granularity)),
    datasets: [
      {
        label: active.label,
        data: series.map((p) => p[metric]),
        borderColor: active.color,
        backgroundColor: (ctx: { chart: ChartJS }) => {
          const { ctx: c, chartArea } = ctx.chart;
          if (!chartArea) return `${active.color}22`;
          const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          g.addColorStop(0, `${active.color}33`);
          g.addColorStop(1, `${active.color}00`);
          return g;
        },
        fill: true,
        tension: 0.35,
        borderWidth: 2,
        pointRadius: series.length > 45 ? 0 : 3,
        pointHoverRadius: 5,
      },
    ],
  };

  return (
    <section className="card mb-4 p-4" aria-label={tr('ui.PerformanceCard.evolutionDesPerformances')}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-base font-bold text-content">{tr('ui.PerformanceCard.evolutionDesPerformances')}</h3>
          <p className="text-xs text-content-faint">{GRANULARITY_NOTE[granularity]}</p>
        </div>
        <div className="flex flex-wrap gap-1" role="group" aria-label={tr('ui.PerformanceCard.indicateurAffiche')}>
          {METRICS.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMetric(m.key)}
              aria-pressed={metric === m.key}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                metric === m.key
                  ? 'bg-primary text-white'
                  : 'bg-surface-2 text-content-muted hover:bg-surface-3 hover:text-content'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {series.length === 0 ? (
        <p className="py-16 text-center text-sm text-content-muted">
          {tr('ui.PerformanceCard.aucuneVenteSurCettePeriode')}
        </p>
      ) : (
        <div className="h-[260px]">
          <Line
            data={chartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              interaction: { mode: 'index', intersect: false },
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    // Le survol donne les trois chiffres du point, pas seulement
                    // celui affiché : c'est la lecture utile (« 3 ventes pour
                    // 245 000 dont 200 000 encaissés »).
                    afterBody: (items: TooltipItem<'line'>[]) => {
                      const p = series[items[0]?.dataIndex ?? 0];
                      if (!p) return '';
                      return [
                        tr('ui.PerformanceCard.caRevenue', { revenue: formatCurrency(p.revenue) }),
                        tr('ui.PerformanceCard.encaisseCollected', { collected: formatCurrency(p.collected) }),
                        tr('ui.PerformanceCard.ventesCount', { count: p.count }),
                      ];
                    },
                    label: () => '',
                  },
                },
              },
              scales: {
                y: {
                  beginAtZero: true,
                  ticks: {
                    callback: (v) =>
                      active.money ? formatCurrency(Number(v)) : String(v),
                    maxTicksLimit: 5,
                  },
                  grid: { color: 'rgba(148,163,184,0.18)' },
                },
                x: { grid: { display: false }, ticks: { maxTicksLimit: 12, autoSkip: true } },
              },
            }}
          />
        </div>
      )}
    </section>
  );
}
