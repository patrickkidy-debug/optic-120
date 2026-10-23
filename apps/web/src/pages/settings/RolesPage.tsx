import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  ShieldHalf,
  Plus,
  Lock,
  Save,
  Trash2,
  Users,
  KeyRound,
  LayoutList,
  Search,
  AlertTriangle,
  Check,
  RotateCcw,
  Eye,
  EyeOff,
  Store,
  Grid3x3,
  ChevronDown,
} from 'lucide-react';
import {
  listRoles,
  listPermissions,
  listUsers,
  createRole,
  updateRole,
  deleteRole,
  type RoleDto,
} from '../../features/rbac/api';
import { usePermission } from '../../store/auth';
import { apiErrorMessage } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { PageHeader, Button, Modal, Field, Badge, PageLoader, StatCard } from '../../components/ui';
import { NAV } from '../../components/layout/nav';
import { tr } from '../../lib/tr';
import { trFr } from '../../lib/sharedLabels';

const MODULE_LABELS: Record<string, string> = {
  get dashboard() { return tr('ui.RolesPage.tableauDeBord'); },
  get billing() { return tr('ui.RolesPage.abonnement'); },
  get 'optique.products'() { return tr('ui.RolesPage.optiqueProduits'); },
  get 'optique.stock'() { return tr('ui.RolesPage.optiqueStock'); },
  get 'optique.inventory'() { return tr('ui.RolesPage.optiqueInventaire'); },
  get 'optique.sales'() { return tr('ui.RolesPage.optiqueVentes'); },
  get 'optique.quotes'() { return tr('ui.RolesPage.optiqueDevis'); },
  get 'optique.cashregister'() { return tr('ui.RolesPage.optiqueCaisses'); },
  get 'optique.customers'() { return tr('ui.RolesPage.optiqueClients'); },
  get 'optique.prescriptions'() { return tr('ui.RolesPage.optiqueOrdonnances'); },
  get 'optique.payments'() { return tr('ui.RolesPage.optiquePaiements'); },
  get 'optique.lensOrders'() { return tr('ui.RolesPage.optiqueCommandesVerres'); },
  get 'optique.repairs'() { return tr('ui.RolesPage.optiqueReparations'); },
  get oculotrack() { return tr('ui.RolesPage.oculotrack'); },
  get 'clinic.patients'() { return tr('ui.RolesPage.cliniquePatients'); },
  get 'clinic.consultations'() { return tr('ui.RolesPage.cliniqueConsultations'); },
  get 'clinic.appointments'() { return tr('ui.RolesPage.cliniqueRendezVous'); },
  get 'clinic.surgeries'() { return tr('ui.RolesPage.cliniqueChirurgies'); },
  get 'hr.employees'() { return tr('ui.RolesPage.personnel'); },
  get 'finance.expenses'() { return tr('ui.RolesPage.financeDepenses'); },
  get 'finance.reports'() { return tr('ui.RolesPage.financeRapports'); },
  get suppliers() { return tr('ui.RolesPage.fournisseurs'); },
  get insurance() { return tr('ui.RolesPage.assurances'); },
  get anomalies() { return tr('ui.RolesPage.anomalies'); },
  get 'rbac.roles'() { return tr('ui.RolesPage.roles'); },
  get 'rbac.users'() { return tr('ui.RolesPage.utilisateurs'); },
  get 'settings.branches'() { return tr('ui.RolesPage.magasins'); },
  get 'settings.payments'() { return tr('ui.RolesPage.paiements'); },
  get 'audit.logs'() { return tr('ui.RolesPage.audit'); },
  get platform() { return tr('ui.RolesPage.plateforme'); },
};

// Regroupement des modules par grand domaine du logiciel.
const DOMAINS: { key: string; label: () => string; match: (m: string) => boolean }[] = [
  { key: 'core', label: () => tr('ui.RolesPage.domCore'), match: (m) => m === 'dashboard' || m === 'billing' },
  { key: 'optique', label: () => tr('ui.RolesPage.domOptique'), match: (m) => m.startsWith('optique.') || m === 'oculotrack' },
  { key: 'clinic', label: () => tr('ui.RolesPage.domClinique'), match: (m) => m.startsWith('clinic.') },
  {
    key: 'gestion',
    label: () => tr('ui.RolesPage.domGestion'),
    match: (m) => m.startsWith('hr.') || m.startsWith('finance.') || ['suppliers', 'insurance', 'anomalies'].includes(m),
  },
  { key: 'admin', label: () => tr('ui.RolesPage.domAdmin'), match: () => true },
];

const SENSITIVE_ACTIONS = new Set(['delete', 'cancel', 'refund', 'correct', 'approve', 'apply', 'regularize', 'deactivate', 'manage']);
/** Droits à fort impact : suppression, argent, corrections, gestion des accès. */
function isSensitive(key: string) {
  const i = key.lastIndexOf('.');
  const module = key.slice(0, i);
  const action = key.slice(i + 1);
  return SENSITIVE_ACTIONS.has(action) || (module.startsWith('rbac.') && action !== 'view') || key === 'settings.payments.update';
}

// Rubriques du menu visibles par les boutiques (hors console éditeur).
const RUBRIQUES = NAV.flatMap((g) => g.items.filter((i) => !i.operatorOnly).map((i) => ({ ...i, group: g.titleKey })));

const PROTECTED = ['admin', 'super_admin'];
type Filter = 'all' | 'granted' | 'denied' | 'sensitive';

export function RolesPage() {
  const qc = useQueryClient();
  const canCreate = usePermission('rbac.roles.create');
  const canUpdate = usePermission('rbac.roles.update');
  const canDelete = usePermission('rbac.roles.delete');
  const canViewUsers = usePermission('rbac.users.view');

  const { data: roles, isLoading } = useQuery({ queryKey: ['roles'], queryFn: listRoles });
  const { data: perms } = useQuery({ queryKey: ['permissions'], queryFn: listPermissions });
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: listUsers, enabled: canViewUsers });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState<'detail' | 'matrix'>('detail');
  const [roleQuery, setRoleQuery] = useState('');
  const [permQuery, setPermQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const selected = roles?.find((r) => r.id === selectedId) ?? null;
  const isProtected = selected ? PROTECTED.includes(selected.code) : false;
  const editable = canUpdate && !isProtected;

  useEffect(() => {
    if (roles && roles.length > 0 && !selectedId) setSelectedId(roles[0].id);
  }, [roles, selectedId]);
  useEffect(() => {
    if (selected) setDraft(new Set(selected.permissions));
    setError('');
  }, [selected]);

  const allKeys = useMemo(() => (perms ? Object.values(perms.grouped).flat().map((p) => p.key) : []), [perms]);
  const sensitiveCount = useMemo(() => allKeys.filter(isSensitive).length, [allKeys]);

  // Permissions effectives d'un rôle (les rôles protégés ont tout).
  const effective = (r: RoleDto) => (PROTECTED.includes(r.code) ? new Set(allKeys) : new Set(r.permissions));
  const rubriquesFor = (set: Set<string>) => RUBRIQUES.filter((i) => !i.permission || set.has(i.permission));
  const current = isProtected ? new Set(allKeys) : draft;

  const changes = useMemo(() => {
    if (!selected || isProtected) return 0;
    const orig = new Set(selected.permissions);
    let n = 0;
    for (const k of draft) if (!orig.has(k)) n++;
    for (const k of orig) if (!draft.has(k)) n++;
    return n;
  }, [draft, selected, isProtected]);

  const saveMut = useMutation({
    mutationFn: () => updateRole(selected!.id, { permissions: [...draft] }),
    onSuccess: () => {
      setNotice(tr('ui.RolesPage.saved'));
      setTimeout(() => setNotice(''), 2500);
      qc.invalidateQueries({ queryKey: ['roles'] });
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteRole(id),
    onSuccess: () => {
      setSelectedId(null);
      qc.invalidateQueries({ queryKey: ['roles'] });
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  function toggle(key: string) {
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }
  function setMany(keys: string[], on: boolean) {
    setDraft((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => (on ? next.add(k) : next.delete(k)));
      return next;
    });
  }

  if (isLoading || !roles) return <PageLoader />;

  const systemCount = roles.filter((r) => r.isSystem).length;
  const assignedUsers = roles.reduce((s, r) => s + r.userCount, 0);
  const emptyRoles = roles.filter((r) => r.userCount === 0).length;
  const moduleCount = perms ? Object.keys(perms.grouped).length : 0;
  const visibleRoles = roles.filter((r) => trFr(r.name).toLowerCase().includes(roleQuery.trim().toLowerCase()));

  // Modules filtrés (recherche + filtre), groupés par domaine.
  const q = permQuery.trim().toLowerCase();
  const domains = perms
    ? DOMAINS.map((d) => ({
        ...d,
        modules: Object.entries(perms.grouped)
          .filter(([m]) => DOMAINS.find((x) => x.match(m))?.key === d.key)
          .map(([module, items]) => ({
            module,
            items,
            shown: items.filter((p) => {
              const label = `${trFr(p.label)} ${MODULE_LABELS[module] ?? module} ${p.key}`.toLowerCase();
              if (q && !label.includes(q)) return false;
              if (filter === 'granted') return current.has(p.key);
              if (filter === 'denied') return !current.has(p.key);
              if (filter === 'sensitive') return isSensitive(p.key);
              return true;
            }),
          }))
          .filter((m) => m.shown.length > 0),
      })).filter((d) => d.modules.length > 0)
    : [];

  const roleUsers = selected && users ? users.filter((u) => u.role?.id === selected.id) : [];
  const visibleRubriques = rubriquesFor(current);
  const grantedSensitive = [...current].filter(isSensitive).length;

  return (
    <div>
      <PageHeader
        title={tr('ui.RolesPage.rolesPermissions')}
        subtitle={tr('ui.RolesPage.n12RolesMetierPretsA')}
        actions={
          canCreate && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> {tr('ui.RolesPage.nouveauRole')}
            </Button>
          )
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          icon={ShieldHalf}
          label={tr('ui.RolesPage.kpiRoles')}
          value={roles.length}
          hint={tr('ui.RolesPage.kpiRolesHint', { system: systemCount, custom: roles.length - systemCount })}
        />
        <StatCard
          icon={Users}
          tone="accent"
          label={tr('ui.RolesPage.kpiUsers')}
          value={assignedUsers}
          hint={tr('ui.RolesPage.kpiUsersHint', { n: emptyRoles })}
        />
        <StatCard
          icon={KeyRound}
          tone="danger"
          label={tr('ui.RolesPage.kpiCatalog')}
          value={allKeys.length}
          hint={tr('ui.RolesPage.kpiCatalogHint', { modules: moduleCount, sensitive: sensitiveCount })}
        />
        <StatCard
          icon={LayoutList}
          tone="success"
          label={tr('ui.RolesPage.kpiRubriques')}
          value={RUBRIQUES.length}
          hint={tr('ui.RolesPage.kpiRubriquesHint')}
        />
      </div>

      <div className="mb-4 inline-flex rounded-xl border bg-surface-2 p-1">
        {(['detail', 'matrix'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              'flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition',
              tab === t ? 'bg-surface text-primary shadow-sm' : 'text-content-muted hover:text-content',
            )}
          >
            {t === 'detail' ? <ShieldHalf className="h-4 w-4" /> : <Grid3x3 className="h-4 w-4" />}
            {t === 'detail' ? tr('ui.RolesPage.tabDetail') : tr('ui.RolesPage.tabMatrix')}
          </button>
        ))}
      </div>

      {tab === 'matrix' && perms ? (
        <MatrixView roles={roles} grouped={perms.grouped} effective={effective} rubriquesFor={rubriquesFor} onPick={(id) => { setSelectedId(id); setTab('detail'); }} />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Liste des rôles */}
          <div className="space-y-2 lg:col-span-4 xl:col-span-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-faint" />
              <input className="input pl-9" value={roleQuery} onChange={(e) => setRoleQuery(e.target.value)} placeholder={tr('ui.RolesPage.searchRoles')} />
            </div>
            {visibleRoles.map((r) => {
              const eff = effective(r);
              const pct = allKeys.length ? Math.round((eff.size / allKeys.length) * 100) : 0;
              return (
                <button
                  key={r.id}
                  onClick={() => setSelectedId(r.id)}
                  className={clsx(
                    'card w-full p-3 text-left transition',
                    r.id === selectedId ? 'border-primary shadow-glow' : 'hover:border-line-strong',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
                        <ShieldHalf className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 truncate font-semibold text-content">
                          {trFr(r.name)}
                          {PROTECTED.includes(r.code) && <Lock className="h-3 w-3 shrink-0 text-content-faint" />}
                        </div>
                        <div className="text-xs text-content-faint">
                          {r.userCount} {tr('ui.RolesPage.usersShort')} · {rubriquesFor(eff).length} {tr('ui.RolesPage.rubriquesShort')}
                        </div>
                      </div>
                    </div>
                    {r.isSystem ? <Badge tone="info">{tr('ui.RolesPage.systeme')}</Badge> : <Badge tone="accent">{tr('ui.RolesPage.custom')}</Badge>}
                  </div>
                  <div className="mt-2.5 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
                      <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-16 text-right text-[11px] font-semibold tabular-nums text-content-muted">
                      {eff.size}/{allKeys.length}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Détail du rôle */}
          <div className="space-y-4 lg:col-span-8 xl:col-span-9">
            {!selected || !perms ? (
              <div className="card p-5 text-content-muted">{tr('ui.RolesPage.selectionnezUnRole')}</div>
            ) : (
              <>
                <div className="card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-xl font-bold text-content">{trFr(selected.name)}</h3>
                        {selected.isSystem ? <Badge tone="info">{tr('ui.RolesPage.systeme')}</Badge> : <Badge tone="accent">{tr('ui.RolesPage.custom')}</Badge>}
                        {isProtected && <Badge tone="warning"><Lock className="mr-1 inline h-3 w-3" />{tr('ui.RolesPage.fullAccess')}</Badge>}
                        {selected.permissionsCustomized && !isProtected && (
                          <span title={tr('ui.RolesPage.customizedHint')}><Badge>{tr('ui.RolesPage.customized')}</Badge></span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-content-muted">
                        {isProtected ? tr('ui.RolesPage.roleProtegeAccesCompletNon') : tr('ui.RolesPage.cochezLesPermissionsAccordees')}
                        <span className="ml-1 font-mono text-xs text-content-faint">({selected.code})</span>
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {canDelete && selected.isCustom && (
                        <Button
                          variant="ghost"
                          className="text-danger"
                          onClick={() => {
                            if (confirm(tr('ui.RolesPage.supprimerLeRoleName', { name: selected.name }))) deleteMut.mutate(selected.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                      {editable && changes > 0 && (
                        <Button variant="ghost" onClick={() => setDraft(new Set(selected.permissions))}>
                          <RotateCcw className="h-4 w-4" /> {tr('ui.RolesPage.reset')}
                        </Button>
                      )}
                      {editable && (
                        <Button onClick={() => saveMut.mutate()} loading={saveMut.isPending} disabled={changes === 0}>
                          <Save className="h-4 w-4" /> {tr('ui.RolesPage.enregistrer')}
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
                    <MiniStat label={tr('ui.RolesPage.statPerms')} value={`${current.size}/${allKeys.length}`} pct={current.size / (allKeys.length || 1)} />
                    <MiniStat label={tr('ui.RolesPage.statRubriques')} value={`${visibleRubriques.length}/${RUBRIQUES.length}`} pct={visibleRubriques.length / RUBRIQUES.length} />
                    <MiniStat label={tr('ui.RolesPage.statSensitive')} value={`${grantedSensitive}/${sensitiveCount}`} pct={grantedSensitive / (sensitiveCount || 1)} danger />
                    <MiniStat label={tr('ui.RolesPage.statUsers')} value={String(selected.userCount)} />
                    <MiniStat
                      label={tr('ui.RolesPage.statBranches')}
                      value={selected.allBranches ? tr('ui.RolesPage.allBranches') : tr('ui.RolesPage.assignedBranches')}
                    />
                  </div>

                  {changes > 0 && (
                    <p className="mt-3 rounded-lg bg-[color:var(--warning)]/10 px-3 py-2 text-sm font-medium text-warning">
                      {tr('ui.RolesPage.unsaved', { n: changes })}
                    </p>
                  )}
                  {notice && <p className="mt-3 rounded-lg bg-[color:var(--success)]/10 px-3 py-2 text-sm font-medium text-success">✓ {notice}</p>}
                  {error && <p className="mt-3 text-sm text-danger">{error}</p>}
                </div>

                <div className="grid grid-cols-1 gap-4 2xl:grid-cols-3">
                  {/* Permissions */}
                  <div className="card p-5 2xl:col-span-2">
                    <div className="mb-4 flex flex-wrap items-center gap-2">
                      <div className="relative min-w-[200px] flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-faint" />
                        <input className="input pl-9" value={permQuery} onChange={(e) => setPermQuery(e.target.value)} placeholder={tr('ui.RolesPage.searchPerms')} />
                      </div>
                      <div className="inline-flex flex-wrap rounded-xl border bg-surface-2 p-1">
                        {(['all', 'granted', 'denied', 'sensitive'] as const).map((f) => (
                          <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={clsx(
                              'rounded-lg px-2.5 py-1 text-xs font-semibold transition',
                              filter === f ? 'bg-surface text-primary shadow-sm' : 'text-content-muted hover:text-content',
                            )}
                          >
                            {tr(`ui.RolesPage.filter${f[0].toUpperCase()}${f.slice(1)}`)}
                          </button>
                        ))}
                      </div>
                    </div>

                    {domains.length === 0 && <p className="py-8 text-center text-sm text-content-muted">{tr('ui.RolesPage.noMatch')}</p>}

                    <div className="space-y-6">
                      {domains.map((d) => (
                        <section key={d.key}>
                          <h4 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-content-faint">{d.label()}</h4>
                          <div className="space-y-2.5">
                            {d.modules.map(({ module, items, shown }) => {
                              const granted = items.filter((p) => current.has(p.key)).length;
                              const all = granted === items.length;
                              const open = !collapsed.has(module);
                              return (
                                <div key={module} className="rounded-xl border bg-surface-2/60">
                                  <div className="flex items-center gap-3 px-3.5 py-2.5">
                                    <button
                                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                                      onClick={() =>
                                        setCollapsed((prev) => {
                                          const next = new Set(prev);
                                          if (next.has(module)) next.delete(module);
                                          else next.add(module);
                                          return next;
                                        })
                                      }
                                    >
                                      <ChevronDown className={clsx('h-4 w-4 shrink-0 text-content-faint transition', !open && '-rotate-90')} />
                                      <span className="truncate text-sm font-semibold text-content">{MODULE_LABELS[module] ?? module}</span>
                                    </button>
                                    <div className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-surface-3 sm:block">
                                      <div
                                        className={clsx('h-full rounded-full', all ? 'bg-success' : 'bg-primary')}
                                        style={{ width: `${(granted / items.length) * 100}%` }}
                                      />
                                    </div>
                                    <span className="w-10 text-right text-xs font-semibold tabular-nums text-content-muted">
                                      {granted}/{items.length}
                                    </span>
                                    {editable && (
                                      <button
                                        className="rounded-md px-2 py-1 text-xs font-semibold text-primary hover:bg-primary-soft"
                                        onClick={() => setMany(items.map((p) => p.key), !all)}
                                      >
                                        {all ? tr('ui.RolesPage.uncheckAll') : tr('ui.RolesPage.checkAll')}
                                      </button>
                                    )}
                                  </div>
                                  {open && (
                                    <div className="grid grid-cols-1 gap-2 border-t px-3.5 py-3 sm:grid-cols-2">
                                      {shown.map((p) => {
                                        const checked = current.has(p.key);
                                        const sens = isSensitive(p.key);
                                        return (
                                          <label
                                            key={p.key}
                                            className={clsx(
                                              'flex items-start gap-2.5 rounded-lg border px-3 py-2 text-sm transition',
                                              checked ? 'border-primary/40 bg-primary-soft' : 'bg-surface',
                                              editable ? 'cursor-pointer hover:border-primary/60' : 'cursor-default opacity-80',
                                            )}
                                          >
                                            <input
                                              type="checkbox"
                                              className="mt-0.5 h-4 w-4 accent-[var(--primary)]"
                                              checked={checked}
                                              disabled={!editable}
                                              onChange={() => toggle(p.key)}
                                            />
                                            <span className="min-w-0 flex-1">
                                              <span className="flex flex-wrap items-center gap-1.5 font-medium text-content">
                                                {trFr(p.label)}
                                                {sens && (
                                                  <span
                                                    title={tr('ui.RolesPage.sensitiveHint')}
                                                    className="inline-flex items-center gap-0.5 rounded bg-[color:var(--danger)]/10 px-1.5 py-px text-[10px] font-bold uppercase text-danger"
                                                  >
                                                    <AlertTriangle className="h-2.5 w-2.5" /> {tr('ui.RolesPage.sensitive')}
                                                  </span>
                                                )}
                                              </span>
                                              <span className="block truncate font-mono text-[11px] text-content-faint">{p.key}</span>
                                            </span>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </section>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* Rubriques du menu */}
                    <div className="card p-5">
                      <h4 className="font-display font-bold text-content">{tr('ui.RolesPage.rubriquesTitle')}</h4>
                      <p className="mb-3 text-xs text-content-muted">{tr('ui.RolesPage.rubriquesHint')}</p>
                      <div className="space-y-3">
                        {NAV.filter((g) => g.items.some((i) => !i.operatorOnly)).map((g) => (
                          <div key={g.titleKey}>
                            <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-content-faint">{tr(g.titleKey)}</p>
                            <ul className="space-y-0.5">
                              {g.items.filter((i) => !i.operatorOnly).map((i) => {
                                const ok = !i.permission || current.has(i.permission);
                                const Icon = i.icon;
                                return (
                                  <li
                                    key={i.to}
                                    title={i.permission ? tr('ui.RolesPage.requires', { p: i.permission }) : tr('ui.RolesPage.rubriqueAlways')}
                                    className={clsx('flex items-center gap-2 rounded-md px-2 py-1 text-sm', ok ? 'text-content' : 'text-content-faint line-through decoration-content-faint/40')}
                                  >
                                    <Icon className={clsx('h-3.5 w-3.5 shrink-0', ok ? 'text-primary' : '')} />
                                    <span className="flex-1 truncate">{tr(i.labelKey)}</span>
                                    {ok ? <Eye className="h-3.5 w-3.5 text-success" /> : <EyeOff className="h-3.5 w-3.5" />}
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Utilisateurs du rôle */}
                    {canViewUsers && (
                      <div className="card p-5">
                        <h4 className="mb-3 flex items-center gap-2 font-display font-bold text-content">
                          <Users className="h-4 w-4 text-primary" /> {tr('ui.RolesPage.usersTitle')}
                          <span className="ml-auto text-sm font-semibold text-content-muted">{roleUsers.length}</span>
                        </h4>
                        {roleUsers.length === 0 ? (
                          <p className="text-sm text-content-muted">{tr('ui.RolesPage.noUsers')}</p>
                        ) : (
                          <ul className="space-y-2">
                            {roleUsers.map((u) => (
                              <li key={u.id} className="flex items-center gap-2.5">
                                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-bold text-primary">
                                  {(u.firstName[0] ?? '') + (u.lastName[0] ?? '')}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-semibold text-content">
                                    {u.firstName} {u.lastName}
                                    {!u.isActive && <span className="ml-1.5 text-xs font-medium text-danger">· {tr('ui.RolesPage.inactive')}</span>}
                                  </p>
                                  <p className="flex items-center gap-1 truncate text-xs text-content-faint">
                                    {u.branches.length > 0 && <><Store className="h-3 w-3" /> {u.branches.map((b) => b.name).join(', ')} · </>}
                                    {u.lastLoginAt ? tr('ui.RolesPage.lastLogin', { d: formatDate(u.lastLoginAt) }) : tr('ui.RolesPage.neverLogged')}
                                  </p>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {createOpen && <CreateRoleModal roles={roles} onClose={() => setCreateOpen(false)} onCreated={(id) => setSelectedId(id)} />}
    </div>
  );
}

function MiniStat({ label, value, pct, danger }: { label: string; value: string; pct?: number; danger?: boolean }) {
  return (
    <div className="rounded-xl border bg-surface-2/60 px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-content-faint">{label}</p>
      <p className="mt-0.5 font-display text-lg font-bold tabular-nums text-content">{value}</p>
      {pct !== undefined && (
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-3">
          <div className={clsx('h-full rounded-full', danger ? 'bg-danger' : 'bg-primary')} style={{ width: `${Math.round(pct * 100)}%` }} />
        </div>
      )}
    </div>
  );
}

function MatrixView({
  roles,
  grouped,
  effective,
  rubriquesFor,
  onPick,
}: {
  roles: RoleDto[];
  grouped: Record<string, { key: string; action: string; label: string }[]>;
  effective: (r: RoleDto) => Set<string>;
  rubriquesFor: (s: Set<string>) => unknown[];
  onPick: (id: string) => void;
}) {
  const sets = roles.map((r) => effective(r));
  const total = Object.values(grouped).reduce((s, l) => s + l.length, 0);
  return (
    <div className="card p-5">
      <p className="mb-3 text-sm text-content-muted">{tr('ui.RolesPage.matrixHint')}</p>
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-surface px-2 py-2 text-left text-xs font-bold uppercase tracking-wider text-content-faint">
                {tr('ui.RolesPage.matrixModule')}
              </th>
              {roles.map((r) => (
                <th key={r.id} className="px-1 py-2 align-bottom">
                  <button onClick={() => onPick(r.id)} className="mx-auto block max-w-[88px] truncate text-xs font-semibold text-content hover:text-primary" title={trFr(r.name)}>
                    {trFr(r.name)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DOMAINS.map((d) => {
              const mods = Object.entries(grouped).filter(([m]) => DOMAINS.find((x) => x.match(m))?.key === d.key);
              if (mods.length === 0) return null;
              return [
                <tr key={d.key}>
                  <td colSpan={roles.length + 1} className="sticky left-0 bg-surface px-2 pb-1 pt-4 text-[11px] font-bold uppercase tracking-wider text-primary">
                    {d.label()}
                  </td>
                </tr>,
                ...mods.map(([module, items]) => (
                  <tr key={module} className="hover:bg-surface-2/60">
                    <td className="sticky left-0 z-10 whitespace-nowrap border-t bg-surface px-2 py-1.5 text-content">{MODULE_LABELS[module] ?? module}</td>
                    {sets.map((s, i) => {
                      const n = items.filter((p) => s.has(p.key)).length;
                      const ratio = n / items.length;
                      return (
                        <td key={roles[i].id} className="border-t px-1 py-1 text-center">
                          <span
                            title={items.filter((p) => s.has(p.key)).map((p) => trFr(p.label)).join('\n')}
                            className={clsx(
                              'inline-flex h-7 min-w-[44px] items-center justify-center rounded-md px-1.5 text-xs font-semibold tabular-nums',
                              n === 0 && 'text-content-faint',
                              ratio === 1 && 'bg-[color:var(--success)]/20 text-success',
                              ratio > 0 && ratio < 1 && 'bg-primary-soft text-primary',
                            )}
                          >
                            {n === 0 ? '—' : ratio === 1 ? <Check className="h-3.5 w-3.5" /> : `${n}/${items.length}`}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                )),
              ];
            })}
            <tr>
              <td className="sticky left-0 z-10 border-t-2 bg-surface px-2 py-2 font-bold text-content">{tr('ui.RolesPage.matrixTotal')}</td>
              {sets.map((s, i) => (
                <td key={roles[i].id} className="border-t-2 px-1 py-2 text-center">
                  <p className="text-xs font-bold tabular-nums text-content">{s.size}/{total}</p>
                  <p className="text-[10px] text-content-faint">{rubriquesFor(s).length} {tr('ui.RolesPage.rubriquesShort')}</p>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CreateRoleModal({ roles, onClose, onCreated }: { roles: RoleDto[]; onClose: () => void; onCreated: (id: string) => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [copyFrom, setCopyFrom] = useState('');
  const [error, setError] = useState('');
  const mut = useMutation({
    mutationFn: () => createRole(name, roles.find((r) => r.id === copyFrom)?.permissions ?? []),
    onSuccess: (role: { id?: string } | undefined) => {
      qc.invalidateQueries({ queryKey: ['roles'] });
      if (role?.id) onCreated(role.id);
      onClose();
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });
  return (
    <Modal open onClose={onClose} title={tr('ui.RolesPage.nouveauRole')} size="sm">
      <div className="space-y-4">
        <Field label={tr('ui.RolesPage.nomDuRole')}>
          <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={tr('ui.RolesPage.exResponsableAtelier')} />
        </Field>
        <Field label={tr('ui.RolesPage.copyFrom')}>
          <select className="input" value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)}>
            <option value="">{tr('ui.RolesPage.copyNone')}</option>
            {roles
              .filter((r) => !PROTECTED.includes(r.code))
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {trFr(r.name)} ({r.permissions.length})
                </option>
              ))}
          </select>
        </Field>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{tr('ui.RolesPage.annuler')}</Button>
          <Button onClick={() => mut.mutate()} loading={mut.isPending} disabled={name.trim().length < 2}>
            {tr('ui.RolesPage.creer')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
