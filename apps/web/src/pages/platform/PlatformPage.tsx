import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  type PlatformPlan,
} from '../../features/billing/api';
import { apiErrorMessage } from '../../lib/api';
import { formatCurrency, formatDate, formatDateTime } from '../../lib/format';
import { PageHeader, Button, Badge, PageLoader, EmptyState, StatCard } from '../../components/ui';

const STATUS: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' | 'info' }> = {
  TRIALING: { label: 'Essai', tone: 'info' },
  ACTIVE: { label: 'Actif', tone: 'success' },
  PAST_DUE: { label: 'En retard', tone: 'warning' },
  SUSPENDED: { label: 'Suspendu', tone: 'danger' },
  CANCELLED: { label: 'Annulé', tone: 'danger' },
};

type Tab = 'subs' | 'users' | 'plans';

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
      <div className="mt-6 flex gap-1 border-b">
        {[
          { id: 'subs' as Tab, label: 'Abonnements', icon: Server },
          { id: 'users' as Tab, label: 'Utilisateurs', icon: Users },
          { id: 'plans' as Tab, label: 'Offres', icon: Layers },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition ${
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
        {tab === 'subs' && <SubscriptionsTab />}
        {tab === 'users' && <UsersTab />}
        {tab === 'plans' && <PlansTab />}
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
  const { data, isLoading } = useQuery({ queryKey: ['platform-users'], queryFn: listPlatformUsers });
  if (isLoading) return <PageLoader />;
  if (!data || data.length === 0) return <EmptyState icon={Users} title="Aucun utilisateur" />;

  return (
    <div className="card overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b text-left text-xs uppercase tracking-wide text-content-faint">
            <th className="table-cell font-semibold">Utilisateur</th>
            <th className="table-cell font-semibold">Établissement</th>
            <th className="table-cell font-semibold">Rôle</th>
            <th className="table-cell font-semibold">Statut</th>
            <th className="table-cell font-semibold">Dernière connexion</th>
            <th className="table-cell font-semibold">Inscrit le</th>
          </tr>
        </thead>
        <tbody>
          {data.map((u) => (
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
              <td className="table-cell text-content-muted">{formatDate(u.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
