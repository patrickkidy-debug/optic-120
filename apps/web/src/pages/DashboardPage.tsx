import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Filler,
} from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';
import { Banknote, TrendingUp, ShoppingBag, AlertTriangle, Receipt } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { useUIStore } from '../store/ui';
import { getDashboard } from '../features/optique/api';
import { StatCard, PageLoader, EmptyState, Badge } from '../components/ui';
import { formatCurrency, formatDateTime } from '../lib/format';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Tooltip, Filler);

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Espèces',
  WAVE: 'Wave',
  ORANGE_MONEY: 'Orange Money',
  MTN_MOMO: 'MTN MoMo',
  MOOV_MONEY: 'Moov',
  FREE_MONEY: 'Free',
  CARD: 'Carte',
};
const METHOD_COLORS = ['#3b82f6', '#22d3ee', '#f97316', '#20c997', '#a855f7', '#f59e0b', '#ef4444'];

function statusTone(status: string) {
  if (status === 'PAID') return 'success' as const;
  if (status === 'PARTIALLY_PAID' || status === 'CONFIRMED') return 'warning' as const;
  if (status === 'CANCELLED') return 'danger' as const;
  return 'neutral' as const;
}

export function DashboardPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const branchId = useUIStore((s) => s.activeBranchId);

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', branchId],
    queryFn: () => getDashboard(branchId ?? undefined),
  });

  if (isLoading || !data) return <PageLoader />;

  const lineData = {
    labels: data.revenueByDay.map((d) => d.date.slice(5)),
    datasets: [
      {
        data: data.revenueByDay.map((d) => d.revenue),
        borderColor: '#3b82f6',
        backgroundColor: (ctx: { chart: ChartJS }) => {
          const { ctx: c, chartArea } = ctx.chart;
          if (!chartArea) return 'rgba(59,130,246,0.15)';
          const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          g.addColorStop(0, 'rgba(59,130,246,0.35)');
          g.addColorStop(1, 'rgba(59,130,246,0)');
          return g;
        },
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointBackgroundColor: '#22d3ee',
      },
    ],
  };

  const hasPayments = data.paymentBreakdown.length > 0;
  const doughnutData = {
    labels: data.paymentBreakdown.map((p) => METHOD_LABELS[p.method] ?? p.method),
    datasets: [
      {
        data: data.paymentBreakdown.map((p) => p.total),
        backgroundColor: METHOD_COLORS,
        borderWidth: 0,
      },
    ],
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-content">
          {t('dashboard.welcome')}, {user?.firstName} 👋
        </h1>
        <p className="mt-1 text-sm text-content-muted">{t('dashboard.title')}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Banknote} label={t('dashboard.todayRevenue')} value={formatCurrency(data.todayRevenue)} tone="primary" />
        <StatCard icon={TrendingUp} label={t('dashboard.monthRevenue')} value={formatCurrency(data.monthRevenue)} tone="success" />
        <StatCard icon={ShoppingBag} label={t('dashboard.sales')} value={data.todaySalesCount} tone="accent" />
        <StatCard
          icon={AlertTriangle}
          label={t('dashboard.lowStock')}
          value={data.lowStockCount}
          tone={data.lowStockCount > 0 ? 'danger' : 'primary'}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <h3 className="mb-4 font-display font-bold text-content">{t('dashboard.revenue7d')}</h3>
          <div className="h-64">
            <Line
              data={lineData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                  x: { grid: { display: false }, ticks: { color: '#94a3b8' } },
                  y: { grid: { color: 'rgba(148,163,184,0.1)' }, ticks: { color: '#94a3b8' } },
                },
              }}
            />
          </div>
        </div>

        <div className="card p-5">
          <h3 className="mb-4 font-display font-bold text-content">{t('dashboard.paymentMethods')}</h3>
          {hasPayments ? (
            <div className="h-64">
              <Doughnut
                data={doughnutData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  cutout: '65%',
                  plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', boxWidth: 12 } } },
                }}
              />
            </div>
          ) : (
            <div className="grid h-64 place-items-center text-sm text-content-muted">
              {t('dashboard.noSales')}
            </div>
          )}
        </div>
      </div>

      <div className="card mt-6 overflow-hidden">
        <div className="border-b px-5 py-4">
          <h3 className="font-display font-bold text-content">{t('dashboard.recentSales')}</h3>
        </div>
        {data.recentSales.length === 0 ? (
          <div className="p-6">
            <EmptyState icon={Receipt} title={t('dashboard.noSales')} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-content-faint">
                  <th className="table-cell font-semibold">{t('sales.number')}</th>
                  <th className="table-cell font-semibold">{t('sales.customer')}</th>
                  <th className="table-cell font-semibold">{t('common.status')}</th>
                  <th className="table-cell text-right font-semibold">{t('common.total')}</th>
                  <th className="table-cell text-right font-semibold">{t('sales.date')}</th>
                </tr>
              </thead>
              <tbody>
                {data.recentSales.map((s) => (
                  <tr key={s.id} className="border-b last:border-0 hover:bg-surface-2/50">
                    <td className="table-cell font-medium text-content">{s.number}</td>
                    <td className="table-cell text-content-muted">{s.customer ?? '—'}</td>
                    <td className="table-cell">
                      <Badge tone={statusTone(s.status)}>{s.status}</Badge>
                    </td>
                    <td className="table-cell text-right font-semibold text-content">
                      {formatCurrency(s.total)}
                    </td>
                    <td className="table-cell text-right text-content-muted">
                      {formatDateTime(s.createdAt)}
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
