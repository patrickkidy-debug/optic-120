import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import {
  Building2,
  Users,
  Banknote,
  Sparkles,
  Play,
  Pause,
  RefreshCw,
  Layers,
  UserPlus,
  Save,
  LifeBuoy,
  BadgeCheck,
  Wallet,
  Flame,
  TrendingUp,
  TrendingDown,
  Receipt,
  Search,
  ShieldOff,
  ShieldCheck,
  LogOut,
  Trash2,
  Lock,
  KeyRound,
  Copy,
  Check,
  MessageCircle,
  CalendarClock,
  CalendarPlus,
  Download,
  Bell,
  Clock,
  Handshake,
  Percent,
  Ban,
  ListChecks,
  type LucideIcon,
  BellRing,
  Megaphone,
  ReceiptText,
} from 'lucide-react';
import {
  platformSuspend,
  platformReactivate,
  platformActivate,
  extendTrial,
  runBilling,
  getPlatformStats,
  listPlatformUsers,
  getPlatformPlans,
  updatePlatformPlan,
  listOperators,
  addOperator,
  removeOperator,
  getFinanceSummary,
  getRevenueSeries,
  listAllInvoices,
  setUserActive,
  forceLogoutUser,
  platformResetPassword,
  getNotifications,
  markNotificationsRead,
  getTrialSettings,
  setTrialSettings,
  getStoreSetupSummary,
  type PlatformPlan,
  type PlatformUser,
  type PlatformNotification,
  type PlatformStoreSetupTenant,
} from '../../features/billing/api';
import { listSupportTickets, setSupportTicketStatus } from '../../features/support/api';
import {
  listPartnersAdmin,
  setPartnerStatusAdmin,
  setPartnerTierAdmin,
  listCommissionRulesAdmin,
  upsertCommissionRuleAdmin,
  listCommissionsAdmin,
  applyCommissionActionAdmin,
  type AdminPartner,
  type CommissionRule,
  type AdminCommission,
} from '../../features/partners/api';
import {
  listPendingPayments,
  confirmPayment,
  listDemoRequests,
  setDemoRequestStatus,
  getDemoEngagement,
  type DemoRequest,
} from '../../features/billing/api';
import { googleCalendarUrl, downloadIcs } from '../../lib/calendar';
import { apiErrorMessage } from '../../lib/api';
import { formatCurrency, formatDate, formatDateTime } from '../../lib/format';
import { PageHeader, Button, Badge, PageLoader, EmptyState, Field, Modal, ProgressBar } from '../../components/ui';
import { RenewalsTab } from './RenewalsTab';
import { AnnouncementsTab } from './AnnouncementsTab';
import { BillingTab } from './billing/BillingTab';
import { PaymentProviderCard } from './PaymentProviderCard';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);

/** Construit un lien wa.me avec un message pré-rempli pour réserver une démonstration gratuite. */
function waLink(phone: string, name?: string, tenantName?: string): string {
  const digits = phone.replace(/[^\d]/g, '');
  const greeting = name ? `Bonjour ${name}` : 'Bonjour';
  const establishment = tenantName ? ` pour ${tenantName}` : '';
  const text = `${greeting}, merci pour votre inscription${establishment} sur OculoSaaS ! Je suis le fondateur d'OculoSaaS. Je vous contacte pour vous réserver une démonstration gratuite afin de vous aider à bien configurer votre espace. Quand seriez-vous disponible pour un court échange ?`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

const KPI_TONES = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/15 text-success',
  accent: 'bg-accent/10 text-accent',
  info: 'bg-sky-500/10 text-sky-500',
  danger: 'bg-danger/15 text-danger',
} as const;

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone: keyof typeof KPI_TONES;
}) {
  return (
    <div className="card p-5 transition hover:-translate-y-0.5 hover:shadow-card-lg">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-content-muted">{label}</p>
          <p className="mt-1 font-display text-2xl font-bold text-content">{value}</p>
        </div>
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${KPI_TONES[tone]}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      {sub && <div className="mt-2 text-xs">{sub}</div>}
    </div>
  );
}

function Delta({ value }: { value: string }) {
  return (
    <span className="inline-flex items-center gap-1 font-medium text-success">
      <TrendingUp className="h-3.5 w-3.5" /> {value}
    </span>
  );
}

/** Cloche de notifications de la console fondateur (ex. nouvel établissement créé). */
export function NotificationBell() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data } = useQuery({
    queryKey: ['platform-notifications'],
    queryFn: getNotifications,
    // Léger sondage : le fondateur voit une nouvelle inscription sans recharger.
    refetchInterval: 30_000,
  });
  const readMut = useMutation({
    mutationFn: (ids?: string[]) => markNotificationsRead(ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platform-notifications'] }),
  });

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl border bg-surface text-content-muted transition hover:text-content"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1 text-[11px] font-semibold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Notifications" size="md">
        {notifications.length === 0 ? (
          <EmptyState icon={Bell} title="Aucune notification" />
        ) : (
          <div className="space-y-3">
            {unreadCount > 0 && (
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => readMut.mutate(undefined)} loading={readMut.isPending}>
                  Tout marquer comme lu
                </Button>
              </div>
            )}
            <div className="max-h-[60vh] space-y-2 overflow-y-auto">
              {notifications.map((n: PlatformNotification) => (
                <div key={n.id} className={`rounded-xl border p-3 ${n.readAt ? 'bg-surface' : 'bg-primary-soft/40'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-content">{n.title}</p>
                    {!n.readAt && (
                      <button
                        onClick={() => readMut.mutate([n.id])}
                        className="shrink-0 text-xs text-primary hover:underline"
                      >
                        Marquer lu
                      </button>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-content-muted">{n.body}</p>
                  <p className="mt-1 text-xs text-content-faint">{formatDateTime(n.createdAt)}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

/**
 * État RÉEL d'un abonnement : le statut stocké ne suffit pas (un abonnement
 * reste « ACTIVE » en base alors que sa période est déjà terminée). On croise
 * donc le statut et l'échéance pour afficher ce qui est vrai maintenant.
 */
function realState(status: string, periodEnd: string) {
  const days = Math.ceil((new Date(periodEnd).getTime() - Date.now()) / 86_400_000);
  if (status === 'SUSPENDED') return { label: 'Suspendu', tone: 'danger' as const, days, urgent: true };
  if (status === 'CANCELLED') return { label: 'Annulé', tone: 'danger' as const, days, urgent: false };
  if (days < 0)
    return {
      label: `Expiré depuis ${Math.abs(days)} j`,
      tone: 'danger' as const,
      days,
      urgent: true,
    };
  if (days === 0) return { label: "Expire aujourd'hui", tone: 'danger' as const, days, urgent: true };
  if (days <= 7)
    return { label: `Expire dans ${days} j`, tone: 'warning' as const, days, urgent: true };
  if (status === 'TRIALING') return { label: `Essai — ${days} j`, tone: 'info' as const, days, urgent: false };
  return { label: `Actif — ${days} j`, tone: 'success' as const, days, urgent: false };
}

/**
 * Reconduit l'essai gratuit d'un tenant précis, à la demande — n'importe
 * quand, sur n'importe quel établissement. Reste gratuit (statut TRIALING) :
 * distinct de l'activation payante (n'affecte pas le MRR).
 */
const STORE_SETUP_STEP_LABELS: Record<string, string> = {
  store_information: 'Informations boutique',
  team: 'Équipe',
  products: 'Produits',
  inventory: 'Stock',
  cash_and_sales: 'Caisse et ventes',
  lens_pricing: 'Tarifs verres',
  insurance: 'Assurances',
  customers: 'Clients',
  documents: 'Documents',
  final_check: 'Vérification finale',
};

/**
 * Qui a configuré sa boutique (assistant "Configuration boutique"), et où il
 * en est — pour repérer les établissements à relancer/accompagner.
 */
export function StoreSetupTab() {
  const { data, isLoading } = useQuery({ queryKey: ['platform-store-setup'], queryFn: getStoreSetupSummary });
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | 'done' | 'in_progress' | 'not_started'>('all');

  const rows = useMemo(() => {
    const all = data ?? [];
    const q = query.trim().toLowerCase();
    return all
      .filter((t) => {
        if (status === 'done') return !!t.finishedAt;
        if (status === 'not_started') return t.completedCount === 0;
        if (status === 'in_progress') return !t.finishedAt && t.completedCount > 0;
        return true;
      })
      .filter((t) => !q || t.tenantName.toLowerCase().includes(q));
  }, [data, query, status]);

  const counts = useMemo(() => {
    const all = data ?? [];
    return {
      all: all.length,
      done: all.filter((t) => t.finishedAt).length,
      in_progress: all.filter((t) => !t.finishedAt && t.completedCount > 0).length,
      not_started: all.filter((t) => t.completedCount === 0).length,
    };
  }, [data]);

  if (isLoading) return <PageLoader />;
  if (!data || data.length === 0) return <EmptyState icon={ListChecks} title="Aucun établissement" />;

  const FILTERS = [
    { key: 'all' as const, label: 'Tous', count: counts.all },
    { key: 'done' as const, label: 'Configuration terminée', count: counts.done },
    { key: 'in_progress' as const, label: 'En cours', count: counts.in_progress },
    { key: 'not_started' as const, label: 'Pas commencé', count: counts.not_started },
  ];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setStatus(f.key)}
            className={`badge px-3 py-1.5 text-xs ${
              status === f.key ? 'bg-primary text-white' : 'bg-surface-2 text-content-muted'
            }`}
          >
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      <div className="relative mb-3 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-faint" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un établissement…"
          className="input pl-9"
        />
      </div>

      <div className="card max-h-[65vh] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-surface">
            <tr className="border-b text-left text-xs uppercase tracking-wide text-content-faint">
              <th className="table-cell font-semibold">Établissement</th>
              <th className="table-cell font-semibold">Progression</th>
              <th className="table-cell font-semibold">Étape actuelle</th>
              <th className="table-cell font-semibold">Statut</th>
              <th className="table-cell font-semibold">Inscrit le</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="table-cell text-center text-sm text-content-muted">
                  Aucun établissement ne correspond à ce filtre.
                </td>
              </tr>
            )}
            {rows.map((t) => (
              <tr key={t.tenantId} className="border-b last:border-0 hover:bg-surface-2/50">
                <td className="table-cell font-medium text-content">{t.tenantName}</td>
                <td className="table-cell min-w-[180px]">
                  <ProgressBar
                    value={t.completedCount}
                    max={t.totalSteps}
                    sublabel={`${t.completedCount}/${t.totalSteps}`}
                  />
                </td>
                <td className="table-cell text-content-muted">
                  {STORE_SETUP_STEP_LABELS[t.currentStep] ?? t.currentStep}
                </td>
                <td className="table-cell">
                  <Badge tone={t.finishedAt ? 'success' : t.completedCount > 0 ? 'warning' : 'neutral'}>
                    {t.finishedAt ? 'Terminée' : t.completedCount > 0 ? 'En cours' : 'Pas commencé'}
                  </Badge>
                </td>
                <td className="table-cell text-content-muted">{formatDate(t.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Affiche le mot de passe temporaire généré UNE SEULE FOIS (jamais stocké en
 * clair). Débloque un compte (page de connexion) sans dépendre de l'envoi
 * d'email, même si le tenant concerné n'a plus d'administrateur actif.
 */
export function TeamTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['platform-operators'], queryFn: listOperators });
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const invalidate = () => qc.invalidateQueries({ queryKey: ['platform-operators'] });
  const addMut = useMutation({
    mutationFn: () => addOperator(email.trim(), name.trim() || undefined),
    onSuccess: () => {
      setEmail('');
      setName('');
      setError('');
      invalidate();
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });
  const removeMut = useMutation({
    mutationFn: removeOperator,
    onSuccess: invalidate,
    onError: (e) => alert(apiErrorMessage(e)),
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <div className="card p-5 lg:col-span-2">
        <h3 className="mb-1 font-display font-bold text-content">Accès à la console fondateur</h3>
        <p className="mb-4 text-xs text-content-faint">
          Toute personne ajoutée ici peut voir le MRR, tous les clients et gérer la plateforme. N'ajoutez que des personnes de confiance.
        </p>
        <div className="space-y-2">
          {data?.map((o) => (
            <div key={o.id} className="flex items-center justify-between rounded-xl border bg-surface-2 px-4 py-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-content">{o.name || o.email}</span>
                  {o.readOnly && <Badge tone="info">Configuré serveur</Badge>}
                </div>
                <div className="text-xs text-content-faint">{o.email}</div>
              </div>
              {!o.readOnly && (
                <button
                  onClick={() => { if (confirm(`Retirer l'accès de ${o.email} ?`)) removeMut.mutate(o.id); }}
                  className="btn-ghost h-8 rounded-lg px-2.5 text-xs text-danger"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="card p-5">
        <h3 className="mb-3 font-display font-bold text-content">Ajouter un accès</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!email.includes('@')) { setError('Email invalide'); return; }
            addMut.mutate();
          }}
          className="space-y-3"
        >
          <Field label="Email">
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="input" placeholder="associe@oculosaas.com" />
          </Field>
          <Field label="Nom (optionnel)">
            <input value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="Prénom Nom" />
          </Field>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" loading={addMut.isPending} className="w-full">
            <UserPlus className="h-4 w-4" /> Donner l'accès
          </Button>
        </form>
      </div>
    </div>
  );
}

const INVOICE_STATUS: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }> = {
  PAID: { label: 'Payée', tone: 'success' },
  PENDING: { label: 'En attente', tone: 'warning' },
  FAILED: { label: 'Échouée', tone: 'danger' },
};

export function FinanceTab() {
  const [days, setDays] = useState(30);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ['platform-finance-summary'],
    queryFn: getFinanceSummary,
  });
  const { data: series } = useQuery({
    queryKey: ['platform-finance-revenue', days],
    queryFn: () => getRevenueSeries(days),
  });
  const { data: invoices, isLoading: loadingInvoices } = useQuery({
    queryKey: ['platform-finance-invoices', statusFilter],
    queryFn: () => listAllInvoices(statusFilter),
  });

  const lineData = {
    labels: (series ?? []).map((d) => d.date.slice(5)),
    datasets: [
      {
        data: (series ?? []).map((d) => d.revenue),
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

  if (loadingSummary) return <PageLoader />;

  return (
    <div>
      <PaymentProviderCard />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={Wallet} tone="success" label="Revenu total encaissé" value={summary ? formatCurrency(summary.totalRevenue) : '—'} />
        <KpiCard icon={TrendingUp} tone="primary" label="Panier moyen (ARPU)" value={summary ? formatCurrency(summary.arpu) : '—'} />
        <KpiCard icon={Receipt} tone="accent" label="Factures payées" value={summary?.paidInvoicesCount ?? '—'} />
        <KpiCard
          icon={TrendingDown}
          tone={summary && summary.churnRate30d > 5 ? 'danger' : 'primary'}
          label="Churn (30j)"
          value={summary ? `${summary.churnRate30d}%` : '—'}
        />
      </div>

      <div className="mt-5 card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display font-bold text-content">Revenu encaissé</h3>
          <div className="flex gap-1">
            {[30, 90, 180].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  days === d ? 'bg-primary text-white' : 'bg-surface-2 text-content-muted hover:text-content'
                }`}
              >
                {d}j
              </button>
            ))}
          </div>
        </div>
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

      <div className="mt-5 card overflow-hidden">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h3 className="font-display font-bold text-content">Factures (toute la plateforme)</h3>
          <div className="flex gap-1">
            {[
              { v: undefined, label: 'Toutes' },
              { v: 'PAID', label: 'Payées' },
              { v: 'PENDING', label: 'En attente' },
              { v: 'FAILED', label: 'Échouées' },
            ].map((opt) => (
              <button
                key={opt.label}
                onClick={() => setStatusFilter(opt.v)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  statusFilter === opt.v ? 'bg-primary text-white' : 'bg-surface-2 text-content-muted hover:text-content'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        {loadingInvoices ? (
          <PageLoader />
        ) : !invoices || invoices.length === 0 ? (
          <EmptyState icon={Receipt} title="Aucune facture" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-content-faint">
                  <th className="table-cell font-semibold">N°</th>
                  <th className="table-cell font-semibold">Établissement</th>
                  <th className="table-cell font-semibold">Offre</th>
                  <th className="table-cell text-right font-semibold">Montant</th>
                  <th className="table-cell font-semibold">Statut</th>
                  <th className="table-cell font-semibold">Date</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b last:border-0 hover:bg-surface-2/50">
                    <td className="table-cell font-mono text-xs text-content-muted">{inv.number}</td>
                    <td className="table-cell font-medium text-content">{inv.tenantName}</td>
                    <td className="table-cell text-content-muted">{inv.planName}</td>
                    <td className="table-cell text-right font-semibold text-content">{formatCurrency(inv.amount)}</td>
                    <td className="table-cell">
                      <Badge tone={INVOICE_STATUS[inv.status]?.tone ?? 'neutral'}>
                        {INVOICE_STATUS[inv.status]?.label ?? inv.status}
                      </Badge>
                    </td>
                    <td className="table-cell text-content-muted">{formatDate(inv.paidAt ?? inv.createdAt)}</td>
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

export function PaymentsTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['platform-pending'], queryFn: listPendingPayments });
  const mut = useMutation({
    mutationFn: confirmPayment,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform-pending'] });
      qc.invalidateQueries({ queryKey: ['platform-subs'] });
      qc.invalidateQueries({ queryKey: ['platform-stats'] });
    },
    onError: (e) => alert(apiErrorMessage(e)),
  });
  if (isLoading) return <PageLoader />;
  if (!data || data.length === 0) return <EmptyState icon={BadgeCheck} title="Aucun paiement en attente" />;

  return (
    <div className="card overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b text-left text-xs uppercase tracking-wide text-content-faint">
            <th className="table-cell font-semibold">Établissement</th>
            <th className="table-cell font-semibold">Référence</th>
            <th className="table-cell font-semibold">Canal</th>
            <th className="table-cell text-right font-semibold">Montant</th>
            <th className="table-cell font-semibold">Demandé le</th>
            <th className="table-cell text-right font-semibold">Action</th>
          </tr>
        </thead>
        <tbody>
          {data.map((p) => (
            <tr key={p.id} className="border-b last:border-0 hover:bg-surface-2/50">
              <td className="table-cell font-medium text-content">{p.tenantName}</td>
              <td className="table-cell font-mono text-content-muted">{p.invoiceNumber}</td>
              <td className="table-cell">
                <Badge tone={p.channel === 'BANK_TRANSFER' ? 'info' : 'success'}>
                  {p.channel === 'BANK_TRANSFER' ? 'Virement bancaire' : 'Mobile Money'}
                </Badge>
              </td>
              <td className="table-cell text-right font-semibold text-content">{formatCurrency(p.amount)}</td>
              <td className="table-cell text-content-muted">{formatDateTime(p.createdAt)}</td>
              <td className="table-cell text-right">
                <Button
                  className="h-8 px-3 text-xs"
                  loading={mut.isPending}
                  onClick={() => {
                    if (confirm(`Confirmer le paiement de ${p.tenantName} (${formatCurrency(p.amount)}) et activer l'abonnement ?`))
                      mut.mutate(p.id);
                  }}
                >
                  <BadgeCheck className="h-4 w-4" /> Confirmer
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const DEMO_STATUS: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' | 'info' }> = {
  PENDING: { label: 'En attente', tone: 'warning' },
  CONFIRMED: { label: 'Confirmée', tone: 'success' },
  DONE: { label: 'Réalisée', tone: 'neutral' },
  CANCELLED: { label: 'Annulée', tone: 'danger' },
};

/** Événement agenda dérivé d'une réservation de démo. */
function demoEvent(d: DemoRequest) {
  const who = d.tenantName || d.contactName;
  const details = [
    `Contact : ${d.contactName}`,
    d.contactEmail && `Email : ${d.contactEmail}`,
    d.contactPhone && `Tél : ${d.contactPhone}`,
    d.notes && `Note : ${d.notes}`,
  ]
    .filter(Boolean)
    .join('\n');
  return { title: `Démo OculoSaaS — ${who}`, start: new Date(d.preferredAt), details };
}

export function DemosTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['platform-demos'], queryFn: listDemoRequests });
  const mut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => setDemoRequestStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platform-demos'] }),
    onError: (e) => alert(apiErrorMessage(e)),
  });

  if (isLoading) return <PageLoader />;
  if (!data || data.length === 0)
    return <EmptyState icon={CalendarClock} title="Aucune réservation de démo" />;

  return (
    <div className="space-y-3">
      {data.map((d) => {
        const st = DEMO_STATUS[d.status] ?? { label: d.status, tone: 'neutral' as const };
        const ev = demoEvent(d);
        return (
          <div key={d.id} className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="font-display font-bold text-content">{d.tenantName || d.contactName}</h4>
                  <Badge tone={st.tone}>{st.label}</Badge>
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-sm font-medium text-primary">
                  <CalendarClock className="h-4 w-4" /> {formatDateTime(d.preferredAt)}
                </div>
                <div className="mt-1 text-xs text-content-faint">
                  {d.contactName} · {d.contactEmail}
                  {d.contactPhone ? ` · ${d.contactPhone}` : ''} · reçu le {formatDateTime(d.createdAt)}
                </div>
                {d.notes && <p className="mt-2 whitespace-pre-wrap text-sm text-content-muted">{d.notes}</p>}
              </div>

              {/* Ajout à l'agenda */}
              <div className="flex shrink-0 flex-col gap-1.5">
                <a
                  href={googleCalendarUrl(ev)}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-primary h-8 rounded-lg px-3 text-xs"
                >
                  <CalendarPlus className="h-3.5 w-3.5" /> Google Agenda
                </a>
                <button
                  onClick={() => downloadIcs(`demo-${d.tenantName || d.contactName}`, ev)}
                  className="btn-outline h-8 rounded-lg px-3 text-xs"
                >
                  <Download className="h-3.5 w-3.5" /> .ics
                </button>
              </div>
            </div>

            {/* Suivi : statut + contact */}
            <div className="mt-4 flex flex-wrap gap-2 border-t pt-3">
              {d.contactPhone && (
                <a
                  href={waLink(d.contactPhone)}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-outline h-8 rounded-lg px-3 text-xs text-[#128C7E]"
                >
                  <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                </a>
              )}
              {d.status !== 'CONFIRMED' && d.status !== 'CANCELLED' && (
                <button
                  onClick={() => mut.mutate({ id: d.id, status: 'CONFIRMED' })}
                  className="btn-outline h-8 rounded-lg px-3 text-xs text-success"
                >
                  <Check className="h-3.5 w-3.5" /> Confirmer
                </button>
              )}
              {d.status !== 'DONE' && (
                <button
                  onClick={() => mut.mutate({ id: d.id, status: 'DONE' })}
                  className="btn-ghost h-8 rounded-lg px-3 text-xs text-content-muted"
                >
                  <BadgeCheck className="h-3.5 w-3.5" /> Marquer réalisée
                </button>
              )}
              {d.status !== 'CANCELLED' && (
                <button
                  onClick={() => {
                    if (confirm('Annuler cette réservation de démo ?')) mut.mutate({ id: d.id, status: 'CANCELLED' });
                  }}
                  className="btn-ghost h-8 rounded-lg px-3 text-xs text-danger"
                >
                  Annuler
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function SupportTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['platform-support'], queryFn: listSupportTickets });
  const mut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'OPEN' | 'CLOSED' }) => setSupportTicketStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platform-support'] }),
    onError: (e) => alert(apiErrorMessage(e)),
  });
  if (isLoading) return <PageLoader />;
  if (!data || data.length === 0) return <EmptyState icon={LifeBuoy} title="Aucune demande de support" />;

  return (
    <div className="space-y-3">
      {data.map((t) => (
        <div key={t.id} className="card p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-display font-bold text-content">{t.subject}</h4>
                <Badge tone={t.status === 'CLOSED' ? 'neutral' : 'warning'}>
                  {t.status === 'CLOSED' ? 'Résolu' : 'Ouvert'}
                </Badge>
              </div>
              <div className="mt-0.5 text-xs text-content-faint">
                {t.name} · {t.email} · {formatDateTime(t.createdAt)}
              </div>
            </div>
            <button
              onClick={() => mut.mutate({ id: t.id, status: t.status === 'CLOSED' ? 'OPEN' : 'CLOSED' })}
              className="btn-outline h-8 rounded-lg px-3 text-xs"
            >
              {t.status === 'CLOSED' ? 'Rouvrir' : 'Marquer résolu'}
            </button>
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm text-content-muted">{t.message}</p>
        </div>
      ))}
    </div>
  );
}

export function PlansTab() {
  const { data, isLoading } = useQuery({ queryKey: ['platform-plans'], queryFn: getPlatformPlans });

  return (
    <div className="space-y-4">
      <TrialSettingsCard />
      {isLoading ? (
        <PageLoader />
      ) : !data || data.length === 0 ? (
        <EmptyState icon={Layers} title="Aucune offre" />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {data.map((p) => (
            <PlanEditor key={p.id} plan={p} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Durée de l'essai gratuit (accès complet) offert à l'inscription — réglable, effet immédiat. */
function TrialSettingsCard() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['trial-settings'], queryFn: getTrialSettings });
  const [hours, setHours] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data) setHours(String(data.minutes / 60));
  }, [data]);

  const mut = useMutation({
    mutationFn: () => setTrialSettings(Math.max(0, Math.round(Number(hours) * 60))),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trial-settings'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
    onError: (e) => alert(apiErrorMessage(e)),
  });

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h3 className="font-display text-lg font-bold text-content">Essai gratuit</h3>
          <p className="mt-0.5 text-xs text-content-faint">
            Durée d'accès complet offerte dès l'inscription, avant blocage jusqu'au paiement.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="number"
              min={0}
              step={0.5}
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              className="input h-9 w-24 px-2 py-1 text-right"
            />
            <span className="text-xs text-content-faint">heures</span>
          </label>
          <Button onClick={() => mut.mutate()} loading={mut.isPending} className="h-9 px-4 text-sm">
            <Save className="h-4 w-4" /> Enregistrer
          </Button>
          {saved && <span className="text-sm text-success">Enregistré ✓</span>}
        </div>
      </div>
    </div>
  );
}

function numOrEmpty(v: number | null): string {
  return v == null ? '' : String(v);
}

function PlanEditor({ plan }: { plan: PlatformPlan }) {
  const qc = useQueryClient();
  const [price, setPrice] = useState(String(Number(plan.priceMonthly)));
  const [maxUsers, setMaxUsers] = useState(numOrEmpty(plan.maxUsers));
  const [maxBranches, setMaxBranches] = useState(numOrEmpty(plan.maxBranches));
  const [maxPatients, setMaxPatients] = useState(numOrEmpty(plan.maxPatients));
  const [maxSales, setMaxSales] = useState(numOrEmpty(plan.maxSales));
  const [saved, setSaved] = useState(false);

  const toLimit = (v: string): number | null => (v.trim() === '' ? null : Math.max(1, Number(v)));

  const mut = useMutation({
    mutationFn: () =>
      updatePlatformPlan(plan.id, {
        priceMonthly: Number(price) || 0,
        maxUsers: toLimit(maxUsers),
        maxBranches: toLimit(maxBranches),
        maxPatients: toLimit(maxPatients),
        maxSales: toLimit(maxSales),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform-plans'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
    onError: (e) => alert(apiErrorMessage(e)),
  });

  const Row = ({ label, value, set, suffix }: { label: string; value: string; set: (v: string) => void; suffix?: string }) => (
    <label className="flex items-center justify-between gap-2 text-sm">
      <span className="text-content-muted">{label}</span>
      <span className="flex items-center gap-1.5">
        <input
          type="number"
          value={value}
          onChange={(e) => set(e.target.value)}
          placeholder="∞"
          className="input h-8 w-24 px-2 py-1 text-right"
        />
        {suffix && <span className="text-xs text-content-faint">{suffix}</span>}
      </span>
    </label>
  );

  return (
    <div className="card p-5">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="font-display text-lg font-bold text-content">{plan.name}</h3>
        <Badge tone={plan.isActive ? 'success' : 'neutral'}>{plan.code}</Badge>
      </div>
      <p className="mb-4 text-xs text-content-faint">Champ vide = illimité</p>
      <div className="space-y-2.5">
        <Row label="Prix / mois" value={price} set={setPrice} suffix="FCFA" />
        <Row label="Utilisateurs" value={maxUsers} set={setMaxUsers} />
        <Row label="Magasins" value={maxBranches} set={setMaxBranches} />
        <Row label="Patients" value={maxPatients} set={setMaxPatients} />
        <Row label="Ventes" value={maxSales} set={setMaxSales} />
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button onClick={() => mut.mutate()} loading={mut.isPending} className="h-9 px-4 text-sm">
          <Save className="h-4 w-4" /> Enregistrer
        </Button>
        {saved && <span className="text-sm text-success">Enregistré ✓</span>}
      </div>
    </div>
  );
}

/**
 * Engagement sur les vidéos de démonstration : qui rappeler en priorité.
 * Trié par score d'intérêt calculé côté serveur (vidéos terminées, % moyen,
 * demandes d'aide) — les prospects les plus chauds arrivent en tête.
 */
export function EngagementTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['platform-demo-engagement'],
    queryFn: getDemoEngagement,
  });

  if (isLoading) return <PageLoader />;
  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon={Flame}
        title="Aucun visionnage pour l'instant"
        hint="Dès qu'un prospect regarde la démonstration, son niveau d'intérêt apparaît ici."
      />
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-content-faint">
              <th className="table-cell font-semibold">Établissement</th>
              <th className="table-cell font-semibold">Contact</th>
              <th className="table-cell text-center font-semibold">Vidéos</th>
              <th className="table-cell text-center font-semibold">Visionnage</th>
              <th className="table-cell text-center font-semibold">Aide</th>
              <th className="table-cell font-semibold">Dernière activité</th>
              <th className="table-cell text-center font-semibold">Intérêt</th>
              <th className="table-cell text-right font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => {
              const wa = r.whatsappPhone
                ? waLink(r.whatsappPhone, r.contactName ?? undefined, r.tenantName)
                : null;
              return (
                <tr key={r.tenantId} className="border-b last:border-0 hover:bg-surface-2/50">
                  <td className="table-cell font-medium text-content">{r.tenantName}</td>
                  <td className="table-cell text-content-muted">
                    <div>{r.contactName}</div>
                    <div className="text-xs text-content-faint">{r.contactEmail}</div>
                  </td>
                  <td className="table-cell text-center">
                    <Badge tone={r.videosCompleted >= 4 ? 'success' : r.videosCompleted > 0 ? 'info' : 'neutral'}>
                      {r.videosCompleted}/4
                    </Badge>
                  </td>
                  <td className="table-cell text-center text-content">{r.avgPercent} %</td>
                  <td className="table-cell text-center">
                    {r.notUnderstoodCount > 0 ? (
                      <Badge tone="warning">{r.notUnderstoodCount}</Badge>
                    ) : (
                      <span className="text-content-faint">—</span>
                    )}
                  </td>
                  <td className="table-cell text-content-muted">
                    {r.lastActivityAt ? formatDate(r.lastActivityAt) : '—'}
                  </td>
                  <td className="table-cell text-center">
                    <span
                      className={`font-display font-bold ${
                        r.score >= 80 ? 'text-success' : r.score >= 40 ? 'text-accent' : 'text-content-muted'
                      }`}
                    >
                      {r.score}
                    </span>
                  </td>
                  <td className="table-cell text-right">
                    {wa ? (
                      <a
                        href={wa}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-outline h-8 rounded-lg px-3 text-xs"
                      >
                        <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                      </a>
                    ) : (
                      <span className="text-xs text-content-faint">Pas de numéro</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ============================== OculoPartners ============================== */

const PARTNER_STATUS_LABEL: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }> = {
  PENDING: { label: 'En attente', tone: 'warning' },
  ACTIVE: { label: 'Actif', tone: 'success' },
  SUSPENDED: { label: 'Suspendu', tone: 'danger' },
  REJECTED: { label: 'Refusé', tone: 'neutral' },
};
const PARTNER_TIER_LABEL: Record<string, string> = {
  AMBASSADOR: 'Ambassador',
  PARTNER_PRO: 'Partner Pro',
  PARTNER_EXPERT: 'Partner Expert',
};
const COMMISSION_STATUS_LABEL: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }> = {
  PENDING: { label: 'En attente', tone: 'warning' },
  APPROVED: { label: 'Validée', tone: 'info' },
  PAYABLE: { label: 'À payer', tone: 'info' },
  PAID: { label: 'Payée', tone: 'success' },
  CANCELLED: { label: 'Annulée', tone: 'neutral' },
  REVERSED: { label: 'Reversée', tone: 'danger' },
};
const PLAN_CODES = ['STARTER', 'STANDARD', 'GROWTH'] as const;
const TIER_CODES = ['AMBASSADOR', 'PARTNER_PRO', 'PARTNER_EXPERT'] as const;

/**
 * Programme d'affiliation OculoPartners : gestion des partenaires, des règles
 * de commission (par offre × niveau) et de la file de validation des
 * commissions. Séparé en trois sous-sections pour rester lisible.
 */
export function PartnersTab() {
  const [section, setSection] = useState<'list' | 'commissions' | 'rules'>('list');
  const SECTIONS = [
    { key: 'list' as const, label: 'Partenaires' },
    { key: 'commissions' as const, label: 'Commissions' },
    { key: 'rules' as const, label: 'Règles de commission' },
  ];
  return (
    <div>
      <div className="mb-4 inline-flex flex-wrap gap-1 rounded-xl border bg-surface p-1">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            onClick={() => setSection(s.key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              section === s.key ? 'bg-primary text-white' : 'text-content-muted hover:text-content'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      {section === 'list' && <PartnersListSection />}
      {section === 'commissions' && <PartnerCommissionsSection />}
      {section === 'rules' && <PartnerRulesSection />}
    </div>
  );
}

function PartnersListSection() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['admin-partners'], queryFn: () => listPartnersAdmin() });
  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin-partners'] });
  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AdminPartner['status'] }) => setPartnerStatusAdmin(id, status),
    onSuccess: invalidate,
    onError: (e) => alert(apiErrorMessage(e)),
  });
  const tierMut = useMutation({
    mutationFn: ({ id, tier }: { id: string; tier: AdminPartner['tier'] }) => setPartnerTierAdmin(id, tier),
    onSuccess: invalidate,
    onError: (e) => alert(apiErrorMessage(e)),
  });

  if (isLoading) return <PageLoader />;
  if (!data || data.length === 0) return <EmptyState icon={Handshake} title="Aucun partenaire inscrit" />;

  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs uppercase tracking-wide text-content-faint">
            <th className="table-cell font-semibold">Partenaire</th>
            <th className="table-cell font-semibold">Contact</th>
            <th className="table-cell font-semibold">Code</th>
            <th className="table-cell font-semibold">Statut</th>
            <th className="table-cell font-semibold">Niveau</th>
            <th className="table-cell text-center font-semibold">Prospects</th>
            <th className="table-cell text-center font-semibold">Commissions</th>
            <th className="table-cell text-right font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody>
          {data.map((p) => (
            <tr key={p.id} className="border-b last:border-0 hover:bg-surface-2/50">
              <td className="table-cell">
                <div className="font-medium text-content">{p.firstName} {p.lastName}</div>
                <div className="text-xs text-content-faint">{formatDate(p.createdAt)}</div>
              </td>
              <td className="table-cell text-content-muted">
                <div>{p.email}</div>
                <a
                  href={waLink(p.whatsapp, `${p.firstName} ${p.lastName}`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-content-faint hover:text-success"
                >
                  <MessageCircle className="h-3 w-3" /> {p.whatsapp}
                </a>
              </td>
              <td className="table-cell font-mono text-xs text-content-muted">{p.referralCode}</td>
              <td className="table-cell">
                <Badge tone={PARTNER_STATUS_LABEL[p.status]?.tone ?? 'neutral'}>
                  {PARTNER_STATUS_LABEL[p.status]?.label ?? p.status}
                </Badge>
              </td>
              <td className="table-cell">
                <select
                  value={p.tier}
                  onChange={(e) => tierMut.mutate({ id: p.id, tier: e.target.value as AdminPartner['tier'] })}
                  className="input h-8 py-0 text-xs"
                >
                  {TIER_CODES.map((t) => (
                    <option key={t} value={t}>{PARTNER_TIER_LABEL[t]}</option>
                  ))}
                </select>
              </td>
              <td className="table-cell text-center text-content-muted">{p._count.leads}</td>
              <td className="table-cell text-center text-content-muted">{p._count.commissions}</td>
              <td className="table-cell text-right">
                <div className="flex justify-end gap-1.5">
                  {p.status === 'PENDING' && (
                    <button
                      onClick={() => statusMut.mutate({ id: p.id, status: 'ACTIVE' })}
                      className="btn-outline h-8 rounded-lg px-2.5 text-xs text-success"
                    >
                      <BadgeCheck className="h-3.5 w-3.5" /> Approuver
                    </button>
                  )}
                  {p.status === 'PENDING' && (
                    <button
                      onClick={() => statusMut.mutate({ id: p.id, status: 'REJECTED' })}
                      className="btn-ghost h-8 rounded-lg px-2.5 text-xs text-danger"
                    >
                      <Ban className="h-3.5 w-3.5" /> Refuser
                    </button>
                  )}
                  {p.status === 'ACTIVE' && (
                    <button
                      onClick={() => { if (confirm(`Suspendre ${p.firstName} ${p.lastName} ?`)) statusMut.mutate({ id: p.id, status: 'SUSPENDED' }); }}
                      className="btn-ghost h-8 rounded-lg px-2.5 text-xs text-danger"
                    >
                      <Pause className="h-3.5 w-3.5" /> Suspendre
                    </button>
                  )}
                  {p.status === 'SUSPENDED' && (
                    <button
                      onClick={() => statusMut.mutate({ id: p.id, status: 'ACTIVE' })}
                      className="btn-ghost h-8 rounded-lg px-2.5 text-xs text-content-muted"
                    >
                      <Play className="h-3.5 w-3.5" /> Réactiver
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PartnerCommissionsSection() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<AdminCommission['status'] | 'ALL'>('ALL');
  const { data, isLoading } = useQuery({
    queryKey: ['admin-commissions', status],
    queryFn: () => listCommissionsAdmin(status === 'ALL' ? undefined : status),
  });
  const actionMut = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'APPROVE' | 'CANCEL' | 'REVERSE' | 'MARK_PAID' }) =>
      applyCommissionActionAdmin(id, { action }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-commissions'] }),
    onError: (e) => alert(apiErrorMessage(e)),
  });

  const FILTERS: { key: AdminCommission['status'] | 'ALL'; label: string }[] = [
    { key: 'ALL', label: 'Toutes' },
    { key: 'PENDING', label: 'En attente' },
    { key: 'APPROVED', label: 'Validées' },
    { key: 'PAID', label: 'Payées' },
  ];

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setStatus(f.key)}
            className={`badge px-3 py-1.5 text-xs ${
              status === f.key ? 'bg-primary text-white' : 'bg-surface-2 text-content-muted'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      {isLoading ? (
        <PageLoader />
      ) : !data || data.length === 0 ? (
        <EmptyState icon={Percent} title="Aucune commission" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-content-faint">
                <th className="table-cell font-semibold">Partenaire</th>
                <th className="table-cell font-semibold">Offre</th>
                <th className="table-cell text-right font-semibold">Payé par le client</th>
                <th className="table-cell text-right font-semibold">Commission</th>
                <th className="table-cell font-semibold">Statut</th>
                <th className="table-cell font-semibold">Date</th>
                <th className="table-cell text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map((c) => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-surface-2/50">
                  <td className="table-cell">
                    <div className="font-medium text-content">{c.partner.firstName} {c.partner.lastName}</div>
                    <div className="text-xs text-content-faint">{c.partner.email}</div>
                  </td>
                  <td className="table-cell text-content-muted">{c.planCode}</td>
                  <td className="table-cell text-right text-content-muted">{formatCurrency(Number(c.customerAmount))}</td>
                  <td className="table-cell text-right font-semibold text-content">{formatCurrency(Number(c.amount))}</td>
                  <td className="table-cell">
                    <Badge tone={COMMISSION_STATUS_LABEL[c.status]?.tone ?? 'neutral'}>
                      {COMMISSION_STATUS_LABEL[c.status]?.label ?? c.status}
                    </Badge>
                  </td>
                  <td className="table-cell text-content-muted">{formatDate(c.createdAt)}</td>
                  <td className="table-cell text-right">
                    <div className="flex justify-end gap-1.5">
                      {c.status === 'PENDING' && (
                        <button
                          onClick={() => actionMut.mutate({ id: c.id, action: 'APPROVE' })}
                          className="btn-outline h-8 rounded-lg px-2.5 text-xs text-success"
                        >
                          <BadgeCheck className="h-3.5 w-3.5" /> Valider
                        </button>
                      )}
                      {(c.status === 'PENDING' || c.status === 'APPROVED') && (
                        <button
                          onClick={() => { if (confirm('Annuler cette commission ?')) actionMut.mutate({ id: c.id, action: 'CANCEL' }); }}
                          className="btn-ghost h-8 rounded-lg px-2.5 text-xs text-danger"
                        >
                          <Ban className="h-3.5 w-3.5" /> Annuler
                        </button>
                      )}
                      {c.status === 'APPROVED' && (
                        <button
                          onClick={() => actionMut.mutate({ id: c.id, action: 'MARK_PAID' })}
                          className="btn-ghost h-8 rounded-lg px-2.5 text-xs text-content-muted"
                        >
                          <Banknote className="h-3.5 w-3.5" /> Marquer payée
                        </button>
                      )}
                      {c.status === 'PAID' && (
                        <button
                          onClick={() => { if (confirm('Reverser cette commission (remboursement client) ?')) actionMut.mutate({ id: c.id, action: 'REVERSE' }); }}
                          className="btn-ghost h-8 rounded-lg px-2.5 text-xs text-danger"
                        >
                          <Ban className="h-3.5 w-3.5" /> Reverser
                        </button>
                      )}
                    </div>
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

function PartnerRulesSection() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['admin-commission-rules'], queryFn: listCommissionRulesAdmin });
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const saveMut = useMutation({
    mutationFn: (input: { planCode: (typeof PLAN_CODES)[number]; tier: (typeof TIER_CODES)[number]; amount: number }) =>
      upsertCommissionRuleAdmin({
        planCode: input.planCode,
        tier: input.tier,
        amount: input.amount,
        currency: 'XOF',
        isActive: true,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-commission-rules'] }),
    onError: (e) => alert(apiErrorMessage(e)),
  });

  if (isLoading) return <PageLoader />;

  const ruleFor = (planCode: string, tier: string): CommissionRule | undefined =>
    data?.find((r) => r.planCode === planCode && r.tier === tier);

  return (
    <div className="card overflow-x-auto p-4">
      <p className="mb-4 text-sm text-content-muted">
        Montant fixe versé au partenaire au premier paiement d'abonnement confirmé d'un client qu'il a apporté,
        selon l'offre souscrite et son niveau. Modifier un montant ne change jamais les commissions déjà générées.
      </p>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs uppercase tracking-wide text-content-faint">
            <th className="table-cell font-semibold">Offre</th>
            {TIER_CODES.map((t) => (
              <th key={t} className="table-cell text-center font-semibold">{PARTNER_TIER_LABEL[t]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PLAN_CODES.map((plan) => (
            <tr key={plan} className="border-b last:border-0">
              <td className="table-cell font-medium text-content">{plan}</td>
              {TIER_CODES.map((tier) => {
                const key = `${plan}-${tier}`;
                const rule = ruleFor(plan, tier);
                const value = amounts[key] ?? (rule ? String(Number(rule.amount)) : '');
                return (
                  <td key={tier} className="table-cell">
                    <div className="flex items-center justify-center gap-1.5">
                      <input
                        type="number"
                        min={0}
                        value={value}
                        onChange={(e) => setAmounts((a) => ({ ...a, [key]: e.target.value }))}
                        className="input h-8 w-24 px-2 text-right text-xs"
                        placeholder="0"
                      />
                      <button
                        title="Enregistrer"
                        onClick={() => {
                          const amount = Number(amounts[key] ?? rule?.amount ?? 0);
                          if (!Number.isFinite(amount) || amount < 0) return;
                          saveMut.mutate({ planCode: plan, tier, amount });
                        }}
                        className="btn-ghost h-8 w-8 rounded-lg p-0 text-primary"
                      >
                        <Save className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
