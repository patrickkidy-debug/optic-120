import { useMemo, useState, type ReactNode } from 'react';
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
  KeyRound,
  Copy,
  Check,
  MessageCircle,
  type LucideIcon,
} from 'lucide-react';
import {
  listAllSubscriptions,
  platformSuspend,
  platformReactivate,
  platformActivate,
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
  type PlatformPlan,
  type PlatformUser,
} from '../../features/billing/api';
import { listSupportTickets, setSupportTicketStatus } from '../../features/support/api';
import { listPendingPayments, confirmPayment } from '../../features/billing/api';
import { apiErrorMessage } from '../../lib/api';
import { formatCurrency, formatDate, formatDateTime } from '../../lib/format';
import { PageHeader, Button, Badge, PageLoader, EmptyState, Field, Modal } from '../../components/ui';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);

/** Construit un lien wa.me à partir d'un numéro saisi librement (garde le + international). */
function waLink(phone: string): string {
  const digits = phone.replace(/[^\d]/g, '');
  return `https://wa.me/${digits}`;
}

const STATUS: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' | 'info' }> = {
  TRIALING: { label: 'Essai', tone: 'info' },
  ACTIVE: { label: 'Actif', tone: 'success' },
  PAST_DUE: { label: 'En retard', tone: 'warning' },
  SUSPENDED: { label: 'Suspendu', tone: 'danger' },
  CANCELLED: { label: 'Annulé', tone: 'danger' },
};

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

      {/* KPI — vue d'ensemble */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={Building2}
          tone="primary"
          label="Établissements"
          value={stats?.tenantsTotal ?? '—'}
          sub={stats ? <Delta value={`+${stats.newTenants30d} ce mois`} /> : null}
        />
        <KpiCard
          icon={Banknote}
          tone="success"
          label="Revenu mensuel (MRR)"
          value={stats ? formatCurrency(stats.mrr) : '—'}
          sub={stats ? <span className="text-content-faint">{stats.subsActive} abonnements actifs</span> : null}
        />
        <KpiCard
          icon={Sparkles}
          tone="accent"
          label="Abonnements actifs"
          value={stats?.subsActive ?? '—'}
          sub={stats ? <span className="text-content-faint">{stats.subsTrialing} en essai</span> : null}
        />
        <KpiCard
          icon={Users}
          tone="info"
          label="Utilisateurs"
          value={stats?.usersTotal ?? '—'}
          sub={stats ? <Delta value={`+${stats.newUsers30d} ce mois`} /> : null}
        />
      </div>
      {stats && (
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
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
  const activateMut = useMutation({
    mutationFn: ({ tenantId, months }: { tenantId: string; months: number }) => platformActivate(tenantId, months),
    onSuccess: invalidate,
    onError: (e) => alert(apiErrorMessage(e)),
  });
  const now = Date.now();
  const promptActivate = (tenantId: string, tenantName: string) => {
    const raw = window.prompt(`Activer l'abonnement de « ${tenantName} » pour combien de mois ? (paiement reçu en direct)`, '1');
    if (raw == null) return;
    const months = Number(raw);
    if (!Number.isFinite(months) || months < 1) return alert('Nombre de mois invalide.');
    activateMut.mutate({ tenantId, months });
  };

  if (isLoading) return <PageLoader />;
  if (!data || data.length === 0) return <EmptyState icon={Server} title="Aucun abonnement" />;

  return (
    <div className="card overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b text-left text-xs uppercase tracking-wide text-content-faint">
            <th className="table-cell font-semibold">Établissement</th>
            <th className="table-cell font-semibold">WhatsApp</th>
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
              <td className="table-cell">
                {s.whatsapp ? (
                  <a
                    href={waLink(s.whatsapp)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#25D366]/12 px-2 py-1 text-xs font-medium text-[#128C7E] hover:bg-[#25D366]/20"
                    title="Contacter sur WhatsApp"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    {s.whatsapp}
                  </a>
                ) : (
                  <span className="text-xs text-content-faint">—</span>
                )}
              </td>
              <td className="table-cell text-content-muted">{s.planName}</td>
              <td className="table-cell"><Badge tone={STATUS[s.status]?.tone ?? 'neutral'}>{STATUS[s.status]?.label ?? s.status}</Badge></td>
              <td className="table-cell text-content-muted">{formatDate(s.currentPeriodEnd)}</td>
              <td className="table-cell text-right">
                {(() => {
                  const hasAccess = s.status === 'ACTIVE' && new Date(s.currentPeriodEnd).getTime() > now;
                  return (
                    <div className="flex justify-end gap-2">
                      {hasAccess ? (
                        <button onClick={() => { if (confirm(`Suspendre ${s.tenantName} ?`)) suspendMut.mutate(s.tenantId); }} className="btn-ghost h-8 rounded-lg px-2.5 text-xs text-danger">
                          <Pause className="h-3.5 w-3.5" /> Suspendre
                        </button>
                      ) : (
                        <>
                          {s.status === 'SUSPENDED' && (
                            <button onClick={() => reactivateMut.mutate(s.tenantId)} className="btn-ghost h-8 rounded-lg px-2.5 text-xs text-content-muted">
                              <Play className="h-3.5 w-3.5" /> Réactiver
                            </button>
                          )}
                          <button onClick={() => promptActivate(s.tenantId, s.tenantName)} className="btn-outline h-8 rounded-lg px-2.5 text-xs text-success">
                            <BadgeCheck className="h-3.5 w-3.5" /> Activer
                          </button>
                        </>
                      )}
                    </div>
                  );
                })()}
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
  const resetPasswordMut = useMutation({
    mutationFn: platformResetPassword,
    onError: (e) => alert(apiErrorMessage(e)),
  });
  const [resetResult, setResetResult] = useState<{ user: PlatformUser; tempPassword: string } | null>(null);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return data.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.tenantName.toLowerCase().includes(q) ||
        (u.phone ?? '').replace(/\s/g, '').includes(q.replace(/\s/g, '')),
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
              <th className="table-cell font-semibold">Téléphone</th>
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
                <td className="table-cell">
                  {u.phone ? (
                    <a
                      href={waLink(u.phone)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Ouvrir la discussion WhatsApp"
                      className="inline-flex items-center gap-1.5 text-sm text-content-muted transition hover:text-success"
                    >
                      <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                      {u.phone}
                    </a>
                  ) : (
                    <span className="text-content-faint">—</span>
                  )}
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
                      title="Réinitialiser le mot de passe (sans email)"
                      onClick={() => {
                        if (confirm(`Générer un nouveau mot de passe temporaire pour ${u.name} ? Ses sessions actives seront déconnectées.`)) {
                          resetPasswordMut.mutate(u.id, {
                            onSuccess: (res) => setResetResult({ user: u, tempPassword: res.tempPassword }),
                          });
                        }
                      }}
                      className="btn-ghost h-8 rounded-lg px-2.5 text-xs"
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                    </button>
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
      {resetResult && (
        <PlatformResetPasswordModal
          user={resetResult.user}
          tempPassword={resetResult.tempPassword}
          onClose={() => setResetResult(null)}
        />
      )}
    </div>
  );
}

/**
 * Affiche le mot de passe temporaire généré UNE SEULE FOIS (jamais stocké en
 * clair). Débloque un compte (page de connexion) sans dépendre de l'envoi
 * d'email, même si le tenant concerné n'a plus d'administrateur actif.
 */
function PlatformResetPasswordModal({
  user,
  tempPassword,
  onClose,
}: {
  user: PlatformUser;
  tempPassword: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Presse-papier indisponible : copie manuelle.
    }
  }

  return (
    <Modal open onClose={onClose} title="Mot de passe temporaire" size="sm">
      <p className="text-sm text-content-muted">
        Nouveau mot de passe pour <b className="text-content">{user.name}</b> ({user.email}) —{' '}
        {user.tenantName}. Transmettez-le vous-même (WhatsApp, SMS…) — il ne sera plus affiché après
        fermeture de cette fenêtre.
      </p>
      <div className="mt-4 flex items-center gap-2 rounded-xl border bg-surface-2 p-3">
        <span className="flex-1 select-all font-mono text-lg font-bold tracking-wider text-content">{tempPassword}</span>
        <button onClick={copy} className="btn-ghost h-9 w-9 rounded-lg p-0" title="Copier">
          {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
      <p className="mt-3 text-xs text-content-faint">
        Ses sessions actives ont été déconnectées ; il devra se reconnecter avec ce mot de passe.
      </p>
      <Button className="mt-5 w-full" onClick={onClose}>
        J'ai noté le mot de passe
      </Button>
    </Modal>
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
