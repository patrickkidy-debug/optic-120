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
import { Banknote, TrendingUp, ShoppingBag, AlertTriangle, Receipt, Building2, Trophy, Wallet, Users, Package, ArrowUp, ArrowDown, UserPlus, ShoppingCart, type LucideIcon } from 'lucide-react';
import clsx from 'clsx';
import { useAuthStore, usePermission } from '../store/auth';
import { useUIStore } from '../store/ui';
import { getDashboard, getAdminDashboard } from '../features/optique/api';
import { StatCard, PageLoader, EmptyState, Badge } from '../components/ui';
import { ForecastPanel } from '../components/ForecastPanel';
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

/** Variation en % entre une valeur courante et précédente (null si non pertinent). */
function pctDelta(current: number, prev: number): number | null {
  if (prev <= 0) return current > 0 ? 100 : null;
  return Math.round(((current - prev) / prev) * 100);
}

function DeltaChip({ pct, label }: { pct: number | null; label?: string }) {
  if (pct === null) return null;
  const up = pct >= 0;
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold',
        up ? 'bg-[color:var(--success)]/15 text-success' : 'bg-[color:var(--danger)]/15 text-danger',
      )}
    >
      {up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {Math.abs(pct)}%{label ? <span className="ml-1 font-normal text-content-faint">{label}</span> : null}
    </span>
  );
}

/** Mini graphe en ligne (tendance), tracé en SVG, dégradé de marque. */
function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const max = Math.max(1, ...data);
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * 100},${30 - (v / max) * 26 - 2}`)
    .join(' ');
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="h-8 w-full">
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#7c3aed" />
          <stop offset="1" stopColor="#ec4899" />
        </linearGradient>
      </defs>
      <polyline
        points={pts}
        fill="none"
        stroke="url(#sparkGrad)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const KPI_TONES: Record<string, string> = {
  primary: 'from-primary/20 to-primary/5 text-primary',
  success: 'from-[color:var(--success)]/20 to-[color:var(--success)]/[0.04] text-success',
  accent: 'from-accent/20 to-accent/5 text-accent',
  danger: 'from-[color:var(--danger)]/20 to-[color:var(--danger)]/[0.04] text-danger',
};

function KpiCard({
  icon: Icon,
  label,
  value,
  tone = 'primary',
  delta,
  deltaLabel,
  spark,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone?: keyof typeof KPI_TONES;
  delta?: number | null;
  deltaLabel?: string;
  spark?: number[];
}) {
  return (
    <div className="card group relative overflow-hidden p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card-lg">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm text-content-muted">{label}</p>
          <p className="mt-1 font-display text-2xl font-bold text-content">{value}</p>
          {delta !== undefined && (
            <div className="mt-2">
              <DeltaChip pct={delta ?? null} label={deltaLabel} />
            </div>
          )}
        </div>
        <span
          className={clsx(
            'grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br',
            KPI_TONES[tone],
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
      </div>
      {spark && <div className="-mb-1 mt-3 opacity-80">{<Sparkline data={spark} />}</div>}
    </div>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
  tone = 'primary',
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone?: keyof typeof KPI_TONES;
}) {
  return (
    <div className="card flex items-center gap-3 p-4">
      <span
        className={clsx(
          'grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br',
          KPI_TONES[tone],
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs text-content-muted">{label}</p>
        <p className="font-display text-lg font-bold text-content">{value}</p>
      </div>
    </div>
  );
}

function TopProductsCard({
  products,
}: {
  products: { name: string; revenue: number; quantity: number }[];
}) {
  const { t } = useTranslation();
  const max = Math.max(1, ...products.map((p) => p.revenue));
  return (
    <div className="card p-5 lg:col-span-2">
      <div className="mb-4 flex items-center gap-2">
        <Package className="h-4 w-4 text-primary" />
        <h3 className="font-display font-bold text-content">{t('dashboard.topProducts')}</h3>
      </div>
      {products.length === 0 ? (
        <div className="grid h-40 place-items-center text-sm text-content-muted">
          {t('dashboard.noSalesRecorded')}
        </div>
      ) : (
        <div className="space-y-3">
          {products.map((p, i) => (
            <div key={`${p.name}-${i}`}>
              <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                <span className="truncate text-content">
                  {i + 1}. {p.name}
                </span>
                <span className="shrink-0 font-semibold text-content">
                  {formatCurrency(p.revenue)}
                  <span className="ml-2 text-xs font-normal text-content-faint">
                    {p.quantity} vendu{p.quantity > 1 ? 's' : ''}
                  </span>
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-3">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
                  style={{ width: `${(p.revenue / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function DashboardPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const branchId = useUIStore((s) => s.activeBranchId);

  const isAdmin = usePermission('finance.expenses.view');

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', branchId],
    queryFn: () => getDashboard(branchId ?? undefined),
  });

  const { data: admin } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: getAdminDashboard,
    enabled: isAdmin,
  });

  if (isLoading || !data) return <PageLoader />;

  const lineData = {
    labels: data.revenueByDay.map((d) => d.date.slice(5)),
    datasets: [
      {
        data: data.revenueByDay.map((d) => d.revenue),
        borderColor: (ctx: { chart: ChartJS }) => {
          const { ctx: c, chartArea } = ctx.chart;
          if (!chartArea) return '#7c3aed';
          const g = c.createLinearGradient(chartArea.left, 0, chartArea.right, 0);
          g.addColorStop(0, '#7c3aed');
          g.addColorStop(1, '#0d9488');
          return g;
        },
        backgroundColor: (ctx: { chart: ChartJS }) => {
          const { ctx: c, chartArea } = ctx.chart;
          if (!chartArea) return 'rgba(124,58,237,0.12)';
          const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          g.addColorStop(0, 'rgba(124,58,237,0.28)');
          g.addColorStop(0.6, 'rgba(124,58,237,0.05)');
          g.addColorStop(1, 'rgba(124,58,237,0)');
          return g;
        },
        fill: true,
        tension: 0.45,
        cubicInterpolationMode: 'monotone' as const,
        borderWidth: 2.5,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: '#7c3aed',
        pointHoverBorderColor: '#fff',
        pointHoverBorderWidth: 2,
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

      {/* KPI principaux */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={Banknote} label={t('dashboard.todayRevenueFull')} value={formatCurrency(data.todayRevenue)} tone="primary" />
        <KpiCard
          icon={TrendingUp}
          label={t('dashboard.monthRevenueFull')}
          value={formatCurrency(data.monthRevenue)}
          tone="success"
          delta={pctDelta(data.weekRevenue ?? 0, data.prevWeekRevenue ?? 0)}
          deltaLabel={t('dashboard.vsPrev7d')}
          spark={(data.revenueByDay ?? []).map((d) => d.revenue)}
        />
        <KpiCard icon={ShoppingBag} label={t('dashboard.todaySales')} value={String(data.todaySalesCount)} tone="accent" />
        <KpiCard icon={ShoppingCart} label={t('dashboard.avgBasket')} value={formatCurrency(data.avgBasket ?? 0)} tone="primary" />
      </div>

      <ForecastPanel />

      {/* Analyses : top produits + indicateurs clés */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <TopProductsCard products={data.topProducts ?? []} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-1">
          <MiniStat icon={UserPlus} label={t('dashboard.newCustomers')} value={String(data.newCustomersMonth ?? 0)} tone="accent" />
          <MiniStat icon={Users} label={t('dashboard.totalCustomers')} value={String(data.customersCount)} tone="primary" />
          <MiniStat
            icon={AlertTriangle}
            label={t('dashboard.lowStockLabel')}
            value={String(data.lowStockCount)}
            tone={data.lowStockCount > 0 ? 'danger' : 'success'}
          />
        </div>
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
                    callbacks: { label: (c) => formatCurrency(Number(c.parsed.y)) },
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
                        new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(v)),
                    },
                  },
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

      {/* ---- Vue administrateur (enrichie) ---- */}
      {isAdmin && admin && (
        <div className="mt-8">
          <div className="mb-4 flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary-soft text-primary">
              <Building2 className="h-4 w-4" />
            </span>
            <h2 className="font-display text-lg font-bold text-content">{t('dashboard.adminView')}</h2>
            <span className="text-xs text-content-faint">— mois en cours</span>
          </div>

          {/* Finance du mois */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard icon={Banknote} label={t('dashboard.revenueMonth')} value={formatCurrency(admin.finance.monthRevenue)} tone="success" />
            <StatCard icon={Wallet} label={t('dashboard.expensesMonth')} value={formatCurrency(admin.finance.monthExpenses)} tone="danger" />
            <StatCard
              icon={TrendingUp}
              label={t('dashboard.netMonth')}
              value={formatCurrency(admin.finance.net)}
              tone={admin.finance.net >= 0 ? 'primary' : 'danger'}
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Par magasin */}
            <div className="card p-5">
              <h3 className="mb-4 flex items-center gap-2 font-display font-bold text-content">
                <Building2 className="h-4 w-4 text-primary" /> Par magasin
              </h3>
              {admin.branchBreakdown.length === 0 ? (
                <p className="text-sm text-content-muted">{t('dashboard.noDataMonth')}</p>
              ) : (
                <div className="space-y-3">
                  {admin.branchBreakdown.map((b) => {
                    const max = Math.max(1, ...admin.branchBreakdown.map((x) => x.revenue));
                    return (
                      <div key={b.name}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className="text-content">{b.name}</span>
                          <span className="font-semibold text-content">
                            {formatCurrency(b.revenue)}
                            <span className="ml-2 text-xs font-normal text-content-faint">{b.salesCount} ventes</span>
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-surface-3">
                          <div className="h-full rounded-full bg-brand" style={{ width: `${Math.round((b.revenue / max) * 100)}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Top vendeurs */}
            <div className="card p-5">
              <h3 className="mb-4 flex items-center gap-2 font-display font-bold text-content">
                <Trophy className="h-4 w-4 text-accent" /> Meilleurs vendeurs
              </h3>
              {admin.topSellers.length === 0 ? (
                <p className="text-sm text-content-muted">{t('dashboard.noSalesMonth')}</p>
              ) : (
                <div className="space-y-2">
                  {admin.topSellers.map((s, i) => (
                    <div key={s.name + i} className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2">
                      <span className="flex items-center gap-3 text-sm">
                        <span className="grid h-6 w-6 place-items-center rounded-full bg-primary-soft text-xs font-bold text-primary">{i + 1}</span>
                        <span className="text-content">{s.name}</span>
                      </span>
                      <span className="text-sm font-semibold text-content">
                        {formatCurrency(s.revenue)}
                        <span className="ml-2 text-xs font-normal text-content-faint">{s.salesCount}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Équipe */}
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <StatCard icon={Users} label={t('dashboard.activeUsers')} value={`${admin.team.usersActive} / ${admin.team.usersTotal}`} tone="primary" />
          </div>
        </div>
      )}
    </div>
  );
}
