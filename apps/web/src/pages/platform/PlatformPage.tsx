import { useMemo, useState } from 'react';
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
  Server,
  Layers,
  UserPlus,
  Save,
  LifeBuoy,
  BadgeCheck,
  Wallet,
  TrendingUp,
  TrendingDown,
  Receipt,
  Search,
  ShieldOff,
  ShieldCheck,
  LogOut,
  Trash2,
  Lock,
} from 'lucide-react';
import {
  listAllSubscriptions,
  platformSuspend,
  platformReactivate,
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
  type PlatformPlan,
} from '../../features/billing/api';
import { listSupportTickets, setSupportTicketStatus } from '../../features/support/api';
import { listPendingPayments, confirmPayment } from '../../features/billing/api';
import { apiErrorMessage } from '../../lib/api';
import { formatCurrency, formatDate, formatDateTime } from '../../lib/format';
import { PageHeader, Button, Badge, PageLoader, EmptyState, StatCard, Field } from '../../components/ui';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);

const STATUS: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' | 'info' }> = {
  TRIALING: { label: 'Essai', tone: 'info' },
  ACTIVE: { label: 'Actif', tone: 'success' },
  PAST_DUE: { label: 'En retard', tone: 'warning' },
  SUSPENDED: { label: 'Suspendu', tone: 'danger' },
  CANCELLED: { label: 'Annulé', tone: 'danger' },
};

type Tab = 'subs' | 'payments' | 'users' | 'plans' | 'support' | 'finance' | 'team';

export function PlatformPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('subs');

  const { data: stats } = useQuery({ queryKey: ['platform-stats'], queryFn: getPlatformStats });

  const billingMut = useMutation({
    mutationFn: runBilling,
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['platform-subs'] });
      qc.invalidateQueries({ queryKey: ['platform-stats'] });
      alert(`Cycle exécuté : ${r.markedPastDue} en retard, ${r.suspended} suspendu(s).`);
    },
    onError: (e) => alert(apiErrorMessage(e)),
  });

  return (
    <div>
      <PageHeader
        title="Console fondateur"
        subtitle="Pilotage de toute la plateforme — établissements, utilisateurs et offres"
        actions={
          <Button variant="outline" onClick={() => billingMut.mutate()} loading={billingMut.isPending}>
            <RefreshCw className="h-4 w-4" /> Cycle de facturation
          </Button>
        }
      />

      {/* KPI */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Building2} label="Établissements" value={stats?.tenantsTotal ?? '—'} tone="primary" />
        <StatCard icon={Banknote} label="Revenu mensuel (MRR)" value={stats ? formatCurrency(stats.mrr) : '—'} tone="success" />
        <StatCard icon={Sparkles} label="Abonnements actifs" value={stats?.subsActive ?? '—'} tone="accent" />
        <StatCard icon={Users} label="Utilisateurs" value={stats?.usersTotal ?? '—'} tone="primary" />
      </div>
      {stats && (
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="badge bg-primary-soft text-content"><UserPlus className="h-3.5 w-3.5" /> {stats.newTenants30d} nouv. établissements (30j)</span>
          <span className="badge bg-primary-soft text-content"><UserPlus className="h-3.5 w-3.5" /> {stats.newUsers30d} nouv. utilisateurs (30j)</span>
          <span className="badge bg-surface-3 text-content-muted">{stats.subsTrialing} en essai</span>
          <span className="badge bg-surface-3 text-content-muted">{stats.subsPastDue} en retard</span>
          <span className="badge bg-surface-3 text-content-muted">{stats.subsSuspended} suspendus</span>
        </div>
      )}

      {/* Onglets */}
      <div className="mt-6 flex gap-1 overflow-x-auto border-b">
        {[
          { id: 'finance' as Tab, label: 'Finances', icon: Wallet },
          { id: 'subs' as Tab, label: 'Abonnements', icon: Server },
          { id: 'payments' as Tab, label: 'À confirmer', icon: BadgeCheck },
          { id: 'users' as Tab, label: 'Utilisateurs', icon: Users },
          { id: 'team' as Tab, label: 'Équipe & accès', icon: Lock },
          { id: 'plans' as Tab, label: 'Offres', icon: Layers },
          { id: 'support' as Tab, label: 'Support', icon: LifeBuoy },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              tab === t.id
                ? 'border-primary text-content'
                : 'border-transparent text-content-muted hover:text-content'
            }`}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {tab === 'finance' && <FinanceTab />}
        {tab === 'subs' && <SubscriptionsTab />}
        {tab === 'payments' && <PaymentsTab />}
        {tab === 'users' && <UsersTab />}
        {tab === 'team' && <TeamTab />}
        {tab === 'plans' && <PlansTab />}
        {tab === 'support' && <SupportTab />}
      </div>
    </div>
  );
}

function SubscriptionsTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['platform-subs'], queryFn: listAllSubscriptions });
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['platform-subs'] });
    qc.invalidateQueries({ queryKey: ['platform-stats'] });
  };
  const suspendMut = useMutation({ mutationFn: platformSuspend, onSuccess: invalidate, onError: (e) => alert(apiErrorMessage(e)) });
  const reactivateMut = useMutation({ mutationFn: platformReactivate, onSuccess: invalidate, onError: (e) => alert(apiErrorMessage(e)) });

  if (isLoading) return <PageLoader />;
  if (!data || data.length === 0) return <EmptyState icon={Server} title="Aucun abonnement" />;

  return (
    <div className="card overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b text-left text-xs uppercase tracking-wide text-content-faint">
            <th className="table-cell font-semibold">Établissement</th>
            <th className="table-cell font-semibold">Offre</th>
            <th className="table-cell font-semibold">Statut</th>
            <th className="table-cell font-semibold">Échéance</th>
            <th className="table-cell text-right font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody>
          {data.map((s) => (
            <tr key={s.tenantId} className="border-b last:border-0 hover:bg-surface-2/50">
              <td className="table-cell">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary-soft text-primary">
                    <Building2 className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="font-medium text-content">{s.tenantName}</div>
                    <div className="text-xs text-content-faint">{s.tenantSlug}</div>
                  </div>
                </div>
              </td>
              <td className="table-cell text-content-muted">{s.planName}</td>
              <td className="table-cell"><Badge tone={STATUS[s.status]?.tone ?? 'neutral'}>{STATUS[s.status]?.label ?? s.status}</Badge></td>
              <td className="table-cell text-content-muted">{formatDate(s.currentPeriodEnd)}</td>
              <td className="table-cell text-right">
                {s.status === 'SUSPENDED' ? (
                  <button onClick={() => reactivateMut.mutate(s.tenantId)} className="btn-outline h-8 rounded-lg px-2.5 text-xs text-success">
                    <Play className="h-3.5 w-3.5" /> Réactiver
                  </button>
                ) : (
                  <button onClick={() => { if (confirm(`Suspendre ${s.tenantName} ?`)) suspendMut.mutate(s.tenantId); }} className="btn-ghost h-8 rounded-lg px-2.5 text-xs text-danger">
                    <Pause className="h-3.5 w-3.5" /> Suspendre
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UsersTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['platform-users'], queryFn: listPlatformUsers });
  const [query, setQuery] = useState('');

  const invalidate = () => qc.invalidateQueries({ queryKey: ['platform-users'] });
  const activeMut = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => setUserActive(id, isActive),
    onSuccess: invalidate,
    onError: (e) => alert(apiErrorMessage(e)),
  });
  const logoutMut = useMutation({
    mutationFn: forceLogoutUser,
    onSuccess: () => alert('Sessions révoquées : cet utilisateur devra se reconnecter.'),
    onError: (e) => alert(apiErrorMessage(e)),
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return data.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.tenantName.toLowerCase().includes(q),
    );
  }, [data, query]);

  if (isLoading) return <PageLoader />;
  if (!data || data.length === 0) return <EmptyState icon={Users} title="Aucun utilisateur" />;

  return (
    <div>
      <div className="relative mb-3 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-faint" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher (nom, email, établissement)…"
          className="input pl-9"
        />
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-content-faint">
              <th className="table-cell font-semibold">Utilisateur</th>
              <th className="table-cell font-semibold">Établissement</th>
              <th className="table-cell font-semibold">Rôle</th>
              <th className="table-cell font-semibold">Statut</th>
              <th className="table-cell font-semibold">Dernière connexion</th>
              <th className="table-cell text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="border-b last:border-0 hover:bg-surface-2/50">
                <td className="table-cell">
                  <div className="font-medium text-content">{u.name}</div>
                  <div className="text-xs text-content-faint">{u.email}</div>
                </td>
                <td className="table-cell text-content-muted">{u.tenantName}</td>
                <td className="table-cell text-content-muted">{u.roleLabel}</td>
                <td className="table-cell">
                  <Badge tone={u.isActive ? 'success' : 'neutral'}>{u.isActive ? 'Actif' : 'Inactif'}</Badge>
                </td>
                <td className="table-cell text-content-muted">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : 'Jamais'}</td>
                <td className="table-cell text-right">
                  <div className="flex justify-end gap-1.5">
                    <button
                      title="Déconnecter de toutes les sessions"
                      onClick={() => { if (confirm(`Forcer la déconnexion de ${u.name} ?`)) logoutMut.mutate(u.id); }}
                      className="btn-ghost h-8 rounded-lg px-2.5 text-xs"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                    </button>
                    {u.isActive ? (
                      <button
                        onClick={() => { if (confirm(`Désactiver le compte de ${u.name} ?`)) activeMut.mutate({ id: u.id, isActive: false }); }}
                        className="btn-ghost h-8 rounded-lg px-2.5 text-xs text-danger"
                      >
                        <ShieldOff className="h-3.5 w-3.5" /> Désactiver
                      </button>
                    ) : (
                      <button
                        onClick={() => activeMut.mutate({ id: u.id, isActive: true })}
                        className="btn-outline h-8 rounded-lg px-2.5 text-xs text-success"
                      >
                        <ShieldCheck className="h-3.5 w-3.5" /> Réactiver
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TeamTab() {
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

function FinanceTab() {
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
        borderColor: '#22c55e',
        backgroundColor: (ctx: { chart: ChartJS }) => {
          const { ctx: c, chartArea } = ctx.chart;
          if (!chartArea) return 'rgba(34,197,94,0.15)';
          const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          g.addColorStop(0, 'rgba(34,197,94,0.35)');
          g.addColorStop(1, 'rgba(34,197,94,0)');
          return g;
        },
        fill: true,
        tension: 0.4,
        pointRadius: 2,
        pointBackgroundColor: '#22c55e',
      },
    ],
  };

  if (loadingSummary) return <PageLoader />;

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Wallet} label="Revenu total encaissé" value={summary ? formatCurrency(summary.totalRevenue) : '—'} tone="success" />
        <StatCard icon={TrendingUp} label="Panier moyen (ARPU)" value={summary ? formatCurrency(summary.arpu) : '—'} tone="primary" />
        <StatCard icon={Receipt} label="Factures payées" value={summary?.paidInvoicesCount ?? '—'} tone="accent" />
        <StatCard
          icon={TrendingDown}
          label="Churn (30j)"
          value={summary ? `${summary.churnRate30d}%` : '—'}
          tone={summary && summary.churnRate30d > 5 ? 'danger' : 'primary'}
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
              plugins: { legend: { display: false } },
              scales: {
                x: { grid: { display: false }, ticks: { color: '#94a3b8', maxTicksLimit: 10 } },
                y: { grid: { color: 'rgba(148,163,184,0.1)' }, ticks: { color: '#94a3b8' } },
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

function PaymentsTab() {
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

function SupportTab() {
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

function PlansTab() {
  const { data, isLoading } = useQuery({ queryKey: ['platform-plans'], queryFn: getPlatformPlans });
  if (isLoading) return <PageLoader />;
  if (!data || data.length === 0) return <EmptyState icon={Layers} title="Aucune offre" />;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {data.map((p) => (
        <PlanEditor key={p.id} plan={p} />
      ))}
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
