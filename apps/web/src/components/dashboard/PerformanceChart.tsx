import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Line } from 'react-chartjs-2';
import type { Chart as ChartJS } from 'chart.js';
import { getDashboardSeries, type DashboardRange, type SeriesPoint } from '../../features/optique/api';
import { formatCurrency } from '../../lib/format';

const RANGES: { key: DashboardRange; label: string }[] = [
  { key: '7d', label: '7 jours' },
  { key: '30d', label: '30 jours' },
  { key: '3m', label: '3 mois' },
  { key: '12m', label: '12 mois' },
];
type Metric = 'revenue' | 'sales' | 'collected' | 'margin';
const METRICS: { key: Metric; label: string; color: string }[] = [
  { key: 'revenue', label: 'CA', color: '#7c3aed' },
  { key: 'sales', label: 'Ventes', color: '#0d9488' },
  { key: 'collected', label: 'Encaissé', color: '#2563eb' },
  { key: 'margin', label: 'Marge', color: '#f59e0b' },
];

function formatLabel(date: string, range: DashboardRange): string {
  if (range === '12m') {
    const [y, m] = date.split('-');
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('fr-FR', { month: 'short' });
  }
  return date.slice(5);
}

/**
 * Graphique de performance interactif : 4 plages (7j/30j/3m/12m) x 4
 * métriques (CA/ventes/encaissé/marge). Remplace l'ancien graphique fixe
 * 7 jours en le généralisant — même rendu par défaut (CA, 7j).
 */
export function PerformanceChart({ branchId }: { branchId?: string | null }) {
  const [range, setRange] = useState<DashboardRange>('7d');
  const [metric, setMetric] = useState<Metric>('revenue');
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-series', branchId, range],
    queryFn: () => getDashboardSeries(range, branchId ?? undefined),
  });
  const points: SeriesPoint[] = data ?? [];
  const activeMetric = METRICS.find((m) => m.key === metric)!;

  const chartData = {
    labels: points.map((d) => formatLabel(d.date, range)),
    datasets: [
      {
        data: points.map((d) => d[metric]),
        borderColor: activeMetric.color,
        backgroundColor: (ctx: { chart: ChartJS }) => {
          const { ctx: c, chartArea } = ctx.chart;
          if (!chartArea) return `${activeMetric.color}22`;
          const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          g.addColorStop(0, `${activeMetric.color}44`);
          g.addColorStop(1, `${activeMetric.color}00`);
          return g;
        },
        fill: true,
        tension: 0.45,
        cubicInterpolationMode: 'monotone' as const,
        borderWidth: 2.5,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: activeMetric.color,
        pointHoverBorderColor: '#fff',
        pointHoverBorderWidth: 2,
      },
    ],
  };

  return (
    <div className="card p-5 lg:col-span-2">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display font-bold text-content">Performance</h3>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border p-0.5">
            {METRICS.map((m) => (
              <button
                key={m.key}
                onClick={() => setMetric(m.key)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  metric === m.key ? 'bg-primary text-white' : 'text-content-muted hover:text-content'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="flex rounded-xl border p-0.5">
            {RANGES.map((r) => (
              <button
                key={r.key}
                onClick={() => setRange(r.key)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  range === r.key ? 'bg-primary text-white' : 'text-content-muted hover:text-content'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="h-64">
        {isLoading ? (
          <div className="grid h-full place-items-center text-sm text-content-muted">Chargement…</div>
        ) : (
          <Line
            data={chartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              interaction: { mode: 'index', intersect: false },
              plugins: {
                legend: { display: false },
                tooltip: {
                  backgroundColor: '#0f172a',
                  padding: 10,
                  cornerRadius: 10,
                  displayColors: false,
                  titleColor: '#94a3b8',
                  bodyColor: '#fff',
                  bodyFont: { weight: 'bold' },
                  callbacks: {
                    label: (c) =>
                      metric === 'sales' ? `${c.parsed.y} vente(s)` : formatCurrency(Number(c.parsed.y)),
                  },
                },
              },
              scales: {
                x: {
                  grid: { display: false },
                  border: { display: false },
                  ticks: { color: '#94a3b8', maxTicksLimit: 8, font: { size: 11 } },
                },
                y: {
                  grid: { color: 'rgba(148,163,184,0.12)' },
                  border: { display: false },
                  ticks: {
                    color: '#94a3b8',
                    maxTicksLimit: 5,
                    font: { size: 11 },
                    callback: (v: string | number) =>
                      metric === 'sales'
                        ? String(v)
                        : new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 }).format(
                            Number(v),
                          ),
                  },
                },
              },
            }}
          />
        )}
      </div>
    </div>
  );
}
