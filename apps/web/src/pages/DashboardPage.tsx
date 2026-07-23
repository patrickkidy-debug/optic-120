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
import {
  Banknote,
  TrendingUp,
  ShoppingBag,
  AlertTriangle,
  Receipt,
  Building2,
  Trophy,
  Wallet,
  Users,
  Package,
  ArrowUp,
  ArrowDown,
  UserPlus,
  ShoppingCart,
  Sparkles,
  Coffee,
  Sun,
  Moon,
  Sunrise,
  Flame,
  ShieldCheck,
  HandCoins,
  type LucideIcon,
} from 'lucide-react';
import clsx from 'clsx';
import { useAuthStore, usePermission } from '../store/auth';
import { useUIStore } from '../store/ui';
import { getDashboard, getAdminDashboard } from '../features/optique/api';
import { StatCard, EmptyState, Badge } from '../components/ui';
import { ForecastPanel } from '../components/ForecastPanel';
import { formatCurrency, formatDate, formatDateTime } from '../lib/format';
import { getInsurerUpcoming } from '../features/management/api';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Tooltip, Filler);

interface Motivation {
  text: string;
  icon: LucideIcon;
  color: string;
}

function getMotivationMessage(salesCount: number, revenue: number): Motivation {
  const hour = new Date().getHours();
  let timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night' = 'morning';

  if (hour >= 5 && hour < 12) {
    timeOfDay = 'morning';
  } else if (hour >= 12 && hour < 18) {
    timeOfDay = 'afternoon';
  } else if (hour >= 18 && hour < 22) {
    timeOfDay = 'evening';
  } else {
    timeOfDay = 'night';
  }

  let progress: 'empty' | 'normal' | 'great' = 'empty';
  if (salesCount === 0) {
    progress = 'empty';
  } else if (salesCount <= 3) {
    progress = 'normal';
  } else {
    progress = 'great';
  }

  const dayOfMonth = new Date().getDate();

  const messages: Record<
    typeof timeOfDay,
    Record<typeof progress, Motivation[]>
  > = {
    morning: {
      empty: [
        { text: "Une nouvelle journée commence ! Préparez le terrain pour le succès avec votre plus beau sourire. ☀️", icon: Sunrise, color: "text-amber-500" },
        { text: "Chaque matin est une page blanche. Remplissons-la de belles réussites aujourd'hui ! 🚀", icon: Sparkles, color: "text-violet-500" },
        { text: "Le café est chaud, l'énergie est là. Excellente journée de ventes à vous ! ☕", icon: Coffee, color: "text-amber-700" }
      ],
      normal: [
        { text: `Déjà de belles réalisations ce matin ! On continue sur ce rythme dynamique ! 🚀`, icon: Sparkles, color: "text-violet-500" },
        { text: `La journée démarre bien avec déjà ${salesCount} vente(s) ! Continuez sur cette belle lancée ! ✨`, icon: Sunrise, color: "text-amber-500" }
      ],
      great: [
        { text: `Quel départ foudroyant ! Déjà ${salesCount} ventes ce matin, vous êtes inarrêtables ! 🔥`, icon: Flame, color: "text-rose-500" },
        { text: `Une matinée exceptionnelle avec ${salesCount} ventes ! L'équipe est en feu ! 🏆`, icon: Trophy, color: "text-yellow-500" }
      ]
    },
    afternoon: {
      empty: [
        { text: "Gardez le sourire ! Le prochain client sera peut-être la plus belle surprise de la journée. 🎯", icon: Sparkles, color: "text-violet-500" },
        { text: "La patience et la persévérance ouvrent toutes les portes. Restez concentrés, l'opportunité arrive ! 💪", icon: Sun, color: "text-amber-500" },
        { text: "Une après-midi dynamique s'annonce. Votre énergie fait toute la différence ! 🌟", icon: Sparkles, color: "text-teal-500" }
      ],
      normal: [
        { text: `Le compteur tourne ! Félicitations pour ces ${salesCount} ventes, la journée continue ! 🌟`, icon: Sparkles, color: "text-teal-500" },
        { text: `Bon travail ! ${salesCount} ventes enregistrées aujourd'hui. On garde le cap ! 👍`, icon: Sun, color: "text-amber-500" }
      ],
      great: [
        { text: `Quelle performance incroyable ! ${salesCount} ventes réalisées pour un chiffre d'affaires de ${formatCurrency(revenue)}. Bravo ! 🏆`, icon: Trophy, color: "text-yellow-500" },
        { text: `Rien ne vous arrête aujourd'hui ! ${salesCount} ventes à votre actif. Continuez à briller ! 🔥`, icon: Flame, color: "text-rose-500" }
      ]
    },
    evening: {
      empty: [
        { text: "La journée se termine doucement. Prenez le temps de soigner vos derniers contacts, chaque détail compte. ✨", icon: Moon, color: "text-indigo-400" },
        { text: "Même les journées calmes préparent les grands succès de demain. Bravo pour votre présence et votre constance ! 🧘", icon: Sparkles, color: "text-indigo-400" }
      ],
      normal: [
        { text: `Une belle journée productive s'achève avec ${salesCount} ventes. Bravo pour vos efforts ! 👏`, icon: Moon, color: "text-indigo-400" },
        { text: `Bravo pour cette journée de travail ! ${salesCount} ventes bien méritées au compteur. 🌟`, icon: Sparkles, color: "text-indigo-400" }
      ],
      great: [
        { text: `Quelle magnifique moisson ! ${salesCount} ventes aujourd'hui, c'est une véritable réussite collective. Félicitations ! 🎉`, icon: Trophy, color: "text-yellow-500" },
        { text: `Une journée mémorable se termine en beauté avec ${salesCount} ventes et un CA de ${formatCurrency(revenue)} ! Chapeau bas ! 👑`, icon: Flame, color: "text-rose-500" }
      ]
    },
    night: {
      empty: [
        { text: "Le calme de la nuit est propice au repos. Rechargez vos batteries pour briller à nouveau demain ! 🔋", icon: Moon, color: "text-indigo-400" },
        { text: "Une journée s'éteint, une autre se prépare. Reposez-vous bien ! 🌙", icon: Moon, color: "text-indigo-400" }
      ],
      normal: [
        { text: `Les ventes tardives témoignent de votre dévouement. Chapeau bas pour l'effort fourni ! 🎖️`, icon: Moon, color: "text-indigo-400" },
        { text: `Journée terminée avec ${salesCount} ventes. C'est l'heure de se reposer l'esprit tranquille. 🛌`, icon: Moon, color: "text-indigo-400" }
      ],
      great: [
        { text: `Exceptionnel jusqu'au bout ! Une journée mémorable avec ${salesCount} ventes. Repos bien mérité pour des champions ! 👑`, icon: Trophy, color: "text-yellow-500" },
        { text: `Victoire ! Une journée grandiose de ${salesCount} ventes. Dormez sur vos deux oreilles, vous avez assuré ! 🏆`, icon: Flame, color: "text-rose-500" }
      ]
    }
  };

  const list = messages[timeOfDay][progress];
  const index = dayOfMonth % list.length;
  return list[index];
}

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

/** Ossature affichée pendant le chargement du tableau de bord (perçu instantané). */
function DashboardSkeleton({ welcome, title }: { welcome: string; title: string }) {
  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-content">{welcome} 👋</h1>
          <p className="mt-1 text-sm text-content-muted">{title}</p>
        </div>
        <div className="flex w-full max-w-lg items-center gap-3 rounded-2xl border border-surface-3 bg-surface-2/50 p-3.5 animate-pulse">
          <div className="h-9 w-9 shrink-0 rounded-xl bg-surface-3" />
          <div className="w-full space-y-2">
            <div className="h-2 w-24 rounded bg-surface-3" />
            <div className="h-3.5 w-4/5 rounded bg-surface-3" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card animate-pulse p-5">
            <div className="h-3 w-24 rounded bg-surface-3" />
            <div className="mt-3 h-7 w-32 rounded bg-surface-3" />
          </div>
        ))}
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card h-64 animate-pulse lg:col-span-2" />
        <div className="card h-64 animate-pulse" />
      </div>
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

  // Paiements trimestriels à venir des assurances (visible avec insurance.view).
  const canSeeInsurers = usePermission('insurance.view');
  const { data: insurerUpcoming } = useQuery({
    queryKey: ['insurer-upcoming'],
    queryFn: getInsurerUpcoming,
    enabled: canSeeInsurers,
  });

  // On affiche tout de suite l'ossature de la page (titre + cartes en attente)
  // plutôt qu'un spinner plein écran : l'accès paraît instantané, les chiffres
  // se remplissent dès que getDashboard répond.
  if (isLoading || !data) return <DashboardSkeleton welcome={`${t('dashboard.welcome')}, ${user?.firstName ?? ''}`} title={t('dashboard.title')} />;

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

  const motivation = getMotivationMessage(data.todaySalesCount ?? 0, data.todayRevenue ?? 0);
  const MotivationIcon = motivation.icon;

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-content">
            {t('dashboard.welcome')}, {user?.firstName} 👋
          </h1>
          <p className="mt-1 text-sm text-content-muted">{t('dashboard.title')}</p>
        </div>
        <div className="flex max-w-lg items-center gap-3 rounded-2xl border border-primary/10 bg-gradient-to-r from-primary/5 via-accent/5 to-transparent p-3.5 shadow-sm transition-all duration-300 hover:shadow-md animate-in fade-in slide-in-from-top-2 duration-500">
          <span className={clsx("grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-2 shadow-sm", motivation.color)}>
            <MotivationIcon className="h-5 w-5 animate-pulse" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-primary/80">Inspiration du moment</p>
            <p className="mt-0.5 text-xs md:text-sm font-medium text-content italic leading-relaxed">
              "{motivation.text}"
            </p>
          </div>
        </div>
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

      {/* Répartition du CA : encaissé auprès des clients vs pris en charge par les assurances. */}
      <div className="mt-6 card p-5">
        <h3 className="mb-4 font-display font-bold text-content">
          Chiffre d'affaires — encaissé vs assurances
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MiniStat
            icon={HandCoins}
            label="Encaissé clients (jour)"
            value={formatCurrency(data.todayCollected ?? 0)}
            tone="success"
          />
          <MiniStat
            icon={ShieldCheck}
            label="Part assurances (jour)"
            value={formatCurrency(data.todayInsurance ?? 0)}
            tone="accent"
          />
          <MiniStat
            icon={HandCoins}
            label="Encaissé clients (mois)"
            value={formatCurrency(data.monthCollected ?? 0)}
            tone="success"
          />
          <MiniStat
            icon={ShieldCheck}
            label="Part assurances (mois)"
            value={formatCurrency(data.monthInsurance ?? 0)}
            tone="accent"
          />
        </div>
      </div>

      {/* Paiements trimestriels à venir des assurances. */}
      {canSeeInsurers && insurerUpcoming && insurerUpcoming.items.length > 0 && (
        <div className="mt-6 card p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display font-bold text-content">
              Paiements assurances à venir
            </h3>
            <Badge tone="info">
              Échéance : {formatDate(insurerUpcoming.dueDate)}
            </Badge>
          </div>
          <div className="space-y-2">
            {insurerUpcoming.items.map((i) => (
              <div
                key={i.insurerId}
                className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2"
              >
                <div className="flex items-center gap-2.5">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary-soft text-primary">
                    <ShieldCheck className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-content">{i.name}</p>
                    <p className="text-xs text-content-faint">{i.salesCount} vente(s) ce trimestre</p>
                  </div>
                </div>
                <span className="font-display font-bold text-content">{formatCurrency(i.amount)}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-between border-t pt-3 text-sm">
            <span className="text-content-muted">Total attendu ce trimestre</span>
            <span className="font-display font-bold text-content">{formatCurrency(insurerUpcoming.total)}</span>
          </div>
        </div>
      )}

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
