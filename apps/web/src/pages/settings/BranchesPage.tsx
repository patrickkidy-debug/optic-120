import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import {
  Plus, Store, Search, LayoutGrid, Table2, MapPin, Users, Star, AlertTriangle, ArrowRightLeft, PackageX,
  Pencil, UserCog, Archive, RotateCcw, Eye, CheckCircle2, Wallet, Building2, Crosshair,
} from 'lucide-react';
import type { BranchPeriod } from '@oculo/shared-types';
import { useAuthStore } from '../../store/auth';
import { useUIStore } from '../../store/ui';
import { apiErrorMessage } from '../../lib/api';
import { formatCurrency, formatDate } from '../../lib/format';
import { PageHeader, Button, Badge, PageLoader, EmptyState, DropdownMenu, type DropdownItem } from '../../components/ui';
import { useToast } from '../../components/Toast';
import { tr } from '../../lib/tr';
import { getBranchOverview, restoreBranch, setMainBranch, type BranchRow, type BranchStatus } from '../../features/branches/api';
import { BranchFormPanel } from '../../features/branches/BranchFormPanel';
import { ArchiveBranchDialog, BranchTeamModal } from '../../features/branches/BranchDialogs';
import { switchBranch } from '../../features/branches/context';

const STATUS_TONE: Record<BranchStatus, 'success' | 'warning' | 'neutral' | 'danger'> = {
  ACTIVE: 'success',
  SETUP: 'warning',
  INACTIVE: 'neutral',
  ARCHIVED: 'neutral',
};
type StatusFilter = 'all' | BranchStatus;
type View = 'cards' | 'table';
const VIEW_KEY = 'oculo_branches_view';

export function BranchesPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  const user = useAuthStore((s) => s.user);
  const activeBranchId = useUIStore((s) => s.activeBranchId);
  const [period, setPeriod] = useState<BranchPeriod>('month');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [city, setCity] = useState('');
  const [view, setView] = useState<View>(() => {
    try {
      return (localStorage.getItem(VIEW_KEY) as View) || 'cards';
    } catch {
      return 'cards';
    }
  });
  const [sort, setSort] = useState<'name' | 'revenue' | 'staff'>('name');
  const [editing, setEditing] = useState<BranchRow | 'new' | null>(null);
  const [team, setTeam] = useState<BranchRow | null>(null);
  const [archiving, setArchiving] = useState<BranchRow | null>(null);

  const includeArchived = status === 'ARCHIVED';
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['branch-overview', period, includeArchived],
    queryFn: () => getBranchOverview(period, includeArchived),
  });
  const perms = data?.permissions;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['branch-overview'] });
    qc.invalidateQueries({ queryKey: ['branches'] });
    qc.invalidateQueries({ queryKey: ['branch'] });
    qc.invalidateQueries({ queryKey: ['users'] });
  };

  const mainMut = useMutation({
    mutationFn: (b: BranchRow) => setMainBranch(b.id),
    onSuccess: (_d, b) => {
      toast.success(tr('br.mainSet', { name: b.name }));
      refresh();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const restoreMut = useMutation({
    mutationFn: (b: BranchRow) => restoreBranch(b.id),
    onSuccess: (_d, b) => {
      toast.success(tr('br.restored', { name: b.name }));
      refresh();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const cities = useMemo(
    () => [...new Set((data?.branches ?? []).map((b) => b.city?.trim()).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b)),
    [data],
  );
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = (data?.branches ?? []).filter((b) => {
      if (status === 'ARCHIVED' ? b.status !== 'ARCHIVED' : status !== 'all' ? b.status !== status : b.status === 'ARCHIVED') return false;
      if (city && (b.city ?? '').trim() !== city) return false;
      if (!q) return true;
      const hay = [b.name, b.code, b.city, b.address, b.manager ? `${b.manager.firstName} ${b.manager.lastName}` : ''].join(' ').toLowerCase();
      return hay.includes(q);
    });
    return [...list].sort((a, b) =>
      sort === 'revenue' ? (b.revenue ?? 0) - (a.revenue ?? 0) : sort === 'staff' ? b.staffCount - a.staffCount : Number(b.isMain) - Number(a.isMain) || a.name.localeCompare(b.name),
    );
  }, [data, search, status, city, sort]);

  const setViewPersist = (v: View) => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* stockage indisponible : préférence non mémorisée */
    }
  };

  const actions = (b: BranchRow): DropdownItem[] => {
    const items: DropdownItem[] = [{ label: tr('br.view'), icon: Eye, onClick: () => navigate(`/parametres/magasins/${b.id}`) }];
    if (b.status === 'ARCHIVED') {
      if (perms?.update) items.push({ label: tr('br.restore'), icon: RotateCcw, onClick: () => restoreMut.mutate(b) });
      return items;
    }
    if (b.id !== activeBranchId && b.isActive) items.push({ label: tr('br.workHere'), icon: Crosshair, onClick: () => switchBranch(b.id, qc) });
    if (perms?.update) items.push({ label: tr('br.edit'), icon: Pencil, onClick: () => setEditing(b) });
    if (perms?.team) items.push({ label: tr('br.manageTeam'), icon: UserCog, onClick: () => setTeam(b) });
    if (perms?.update && perms.allBranches && !b.isMain && b.isActive) items.push({ label: tr('br.makeMain'), icon: Star, onClick: () => mainMut.mutate(b) });
    if (perms?.update && !b.isMain) items.push({ label: tr('br.archive.action'), icon: Archive, variant: 'danger', onClick: () => setArchiving(b) });
    return items;
  };

  const periodLabel = data ? tr(`br.period.${period}Since`, { date: formatDate(data.from) }) : '';
  const activeName = data?.branches.find((b) => b.id === activeBranchId)?.name;
  const mainName = data?.branches.find((b) => b.isMain)?.name;

  return (
    <div>
      <PageHeader
        title={tr('br.title')}
        subtitle={tr('br.subtitle')}
        actions={
          perms?.create && (
            <Button onClick={() => setEditing('new')}>
              <Plus className="h-4 w-4" /> {tr('br.add')}
            </Button>
          )
        }
      />

      {isLoading ? (
        <PageLoader />
      ) : isError ? (
        <div className="card flex flex-wrap items-center justify-between gap-3 p-5" role="alert">
          <p className="text-sm text-danger">{apiErrorMessage(error)}</p>
          <Button variant="outline" onClick={() => refetch()}>{tr('br.retry')}</Button>
        </div>
      ) : !data || data.totals.branches + data.totals.archived === 0 ? (
        <EmptyState
          icon={Store}
          title={tr('br.empty')}
          hint={tr('br.emptyHint')}
          action={perms?.create ? <Button onClick={() => setEditing('new')}><Plus className="h-4 w-4" /> {tr('br.add')}</Button> : undefined}
        />
      ) : (
        <>
          {/* Contexte : magasin sélectionné ≠ magasin principal */}
          <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-content-muted">
            <span className="flex items-center gap-1.5"><Crosshair className="h-4 w-4 text-primary" /> {tr('br.ctx.selected')} <b className="text-content">{activeName ?? '—'}</b></span>
            {mainName && <span className="flex items-center gap-1.5"><Star className="h-4 w-4 text-accent" /> {tr('br.ctx.main')} <b className="text-content">{mainName}</b></span>}
          </div>

          {/* Synthèse */}
          <div className="mb-5 card p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-content-faint">{tr('br.summary')}</p>
              {perms?.revenue && (
                <div className="flex items-center gap-1 rounded-xl bg-surface-2 p-1" role="group" aria-label={tr('br.period.label')}>
                  {(['today', 'month', '30d'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPeriod(p)}
                      aria-pressed={period === p}
                      className={clsx('rounded-lg px-3 py-1.5 text-xs font-semibold transition', period === p ? 'bg-surface text-primary shadow-card' : 'text-content-muted hover:text-content')}
                    >
                      {tr(`br.period.${p}`)}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className={clsx('grid grid-cols-2 gap-3', perms?.revenue ? 'lg:grid-cols-4' : 'lg:grid-cols-3')}>
              <Kpi icon={Building2} label={tr('br.kpi.branches')} value={data.totals.branches} hint={data.totals.archived ? tr('br.kpi.archived', { n: data.totals.archived }) : undefined} />
              <Kpi icon={CheckCircle2} label={tr('br.kpi.active')} value={data.totals.active} hint={tr('br.kpi.ofTotal', { n: data.totals.branches })} />
              <Kpi icon={Users} label={tr('br.kpi.staff')} value={data.totals.collaborators} hint={perms?.allBranches ? tr('br.kpi.staffAll') : tr('br.kpi.staffScoped')} />
              {perms?.revenue && (
                <Kpi icon={Wallet} label={tr('br.kpi.revenue')} value={formatCurrency(data.totals.revenue ?? 0, data.currency)} hint={periodLabel} />
              )}
            </div>
          </div>

          {/* Outils */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-faint" />
              <input className="input pl-9" placeholder={tr('br.search')} value={search} onChange={(e) => setSearch(e.target.value)} aria-label={tr('br.search')} />
            </div>
            <select className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} aria-label={tr('br.filter.status')}>
              <option value="all">{tr('br.filter.allStatus')}</option>
              <option value="ACTIVE">{tr('br.status.ACTIVE')}</option>
              <option value="SETUP">{tr('br.status.SETUP')}</option>
              <option value="INACTIVE">{tr('br.status.INACTIVE')}</option>
              <option value="ARCHIVED">{tr('br.status.ARCHIVED')}</option>
            </select>
            <select className="input w-auto" value={city} onChange={(e) => setCity(e.target.value)} aria-label={tr('br.filter.city')} disabled={!cities.length}>
              <option value="">{tr('br.filter.allCities')}</option>
              {cities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            {view === 'table' && (
              <select className="input w-auto" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label={tr('br.sort.label')}>
                <option value="name">{tr('br.sort.name')}</option>
                {perms?.revenue && <option value="revenue">{tr('br.sort.revenue')}</option>}
                <option value="staff">{tr('br.sort.staff')}</option>
              </select>
            )}
            <div className="flex rounded-xl border p-0.5" role="group" aria-label={tr('br.viewMode')}>
              <button type="button" onClick={() => setViewPersist('cards')} aria-pressed={view === 'cards'} title={tr('br.viewCards')} className={clsx('grid h-9 w-9 place-items-center rounded-lg', view === 'cards' ? 'bg-primary-soft text-primary' : 'text-content-muted')}>
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => setViewPersist('table')} aria-pressed={view === 'table'} title={tr('br.viewTable')} className={clsx('grid h-9 w-9 place-items-center rounded-lg', view === 'table' ? 'bg-primary-soft text-primary' : 'text-content-muted')}>
                <Table2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div aria-busy={isFetching} className={clsx(isFetching && 'opacity-60 transition-opacity')}>
            {rows.length === 0 ? (
              <EmptyState
                icon={Search}
                title={tr('br.noMatch')}
                action={<Button variant="outline" onClick={() => { setSearch(''); setStatus('all'); setCity(''); }}>{tr('br.resetFilters')}</Button>}
              />
            ) : view === 'cards' ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {rows.map((b) => (
                  <BranchCard
                    key={b.id}
                    b={b}
                    selected={b.id === activeBranchId}
                    currency={data.currency}
                    showRevenue={Boolean(perms?.revenue)}
                    periodLabel={periodLabel}
                    actions={actions(b)}
                    onOpen={() => navigate(`/parametres/magasins/${b.id}`)}
                    onComplete={perms?.update && b.status !== 'ARCHIVED' ? () => setEditing(b) : undefined}
                  />
                ))}
              </div>
            ) : (
              <BranchTable rows={rows} activeBranchId={activeBranchId} currency={data.currency} showRevenue={Boolean(perms?.revenue)} actions={actions} onOpen={(b) => navigate(`/parametres/magasins/${b.id}`)} />
            )}
          </div>
        </>
      )}

      {editing && (
        <BranchFormPanel
          branch={editing === 'new' ? null : editing}
          tenantCountry={user?.tenantCountryCode ?? 'SN'}
          currency={data?.currency ?? user?.tenantCurrency ?? 'XOF'}
          canAssignTeam={Boolean(perms?.team)}
          selfId={user?.id ?? ''}
          selfAllBranches={Boolean(perms?.allBranches)}
          onClose={() => setEditing(null)}
          onSaved={(id) => {
            const wasNew = editing === 'new';
            setEditing(null);
            refresh();
            if (wasNew) navigate(`/parametres/magasins/${id}`);
          }}
        />
      )}
      {team && <BranchTeamModal branch={team} onClose={() => setTeam(null)} onSaved={() => { setTeam(null); refresh(); }} />}
      {archiving && <ArchiveBranchDialog branch={archiving} onClose={() => setArchiving(null)} onDone={() => { setArchiving(null); refresh(); }} />}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, hint }: { icon: typeof Store; label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border bg-surface px-3.5 py-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary"><Icon className="h-4 w-4" /></span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-content-muted">{label}</p>
        <p className="font-display text-xl font-bold leading-tight text-content">{value}</p>
        {hint && <p className="truncate text-[11px] text-content-faint">{hint}</p>}
      </div>
    </div>
  );
}

export function BranchLogo({ b, size = 'md' }: { b: { logoUrl: string | null; name: string }; size?: 'md' | 'lg' }) {
  const cls = size === 'lg' ? 'h-14 w-14 rounded-2xl' : 'h-11 w-11 rounded-xl';
  return b.logoUrl ? (
    <img src={b.logoUrl} alt="" className={clsx(cls, 'shrink-0 border object-cover')} />
  ) : (
    <span className={clsx(cls, 'grid shrink-0 place-items-center bg-primary-soft text-primary')}><Store className={size === 'lg' ? 'h-6 w-6' : 'h-5 w-5'} /></span>
  );
}

export function StatusBadges({ b, selected }: { b: Pick<BranchRow, 'status' | 'isMain'>; selected?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge tone={STATUS_TONE[b.status]}>{tr(`br.status.${b.status}`)}</Badge>
      {b.isMain && (
        <span className="badge bg-accent-soft text-accent"><Star className="mr-1 h-3 w-3" />{tr('br.mainBadge')}</span>
      )}
      {selected && (
        <span className="badge bg-primary-soft text-primary"><Crosshair className="mr-1 h-3 w-3" />{tr('br.selectedBadge')}</span>
      )}
    </div>
  );
}

function Alerts({ b, onComplete }: { b: BranchRow; onComplete?: () => void }) {
  const items: React.ReactNode[] = [];
  if (b.status === 'SETUP' && b.missing.length) {
    items.push(
      <li key="setup" className="flex items-start gap-2 text-warning">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          {tr('br.alert.setup', { fields: b.missing.map((m) => tr(`br.missing.${m}`)).join(', ') })}
          {onComplete && <button type="button" onClick={onComplete} className="ml-1 font-semibold underline">{tr('br.alert.complete')}</button>}
        </span>
      </li>,
    );
  }
  if (b.lowStock > 0) items.push(<li key="low" className="flex items-center gap-2 text-danger"><PackageX className="h-3.5 w-3.5" />{tr('br.alert.lowStock', { count: b.lowStock })}</li>);
  if (b.pendingIn > 0) items.push(<li key="in" className="flex items-center gap-2 text-primary"><ArrowRightLeft className="h-3.5 w-3.5" />{tr('br.alert.toReceive', { count: b.pendingIn })}</li>);
  if (b.pendingOut > 0) items.push(<li key="out" className="flex items-center gap-2 text-content-muted"><ArrowRightLeft className="h-3.5 w-3.5" />{tr('br.alert.inTransit', { count: b.pendingOut })}</li>);
  if (!items.length) return null;
  return <ul className="space-y-1 rounded-lg bg-surface-2 px-3 py-2 text-xs">{items}</ul>;
}

function BranchCard({
  b, selected, currency, showRevenue, periodLabel, actions, onOpen, onComplete,
}: {
  b: BranchRow; selected: boolean; currency: string; showRevenue: boolean; periodLabel: string; actions: DropdownItem[]; onOpen: () => void; onComplete?: () => void;
}) {
  const location = [b.city, b.address].filter(Boolean).join(' · ');
  return (
    <article className={clsx('card flex flex-col gap-3 p-4 transition hover:shadow-card-lg', selected && 'ring-2 ring-primary/50', b.status === 'ARCHIVED' && 'opacity-75')}>
      <div className="flex items-start gap-3">
        <BranchLogo b={b} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display font-bold text-content">{b.name}</h3>
          <p className="flex items-center gap-1 truncate text-xs text-content-muted">
            <MapPin className="h-3 w-3 shrink-0" />
            {location || <span className="italic text-content-faint">{tr('br.noLocation')}</span>}
          </p>
          {b.code && <p className="font-mono text-[11px] text-content-faint">{b.code}</p>}
        </div>
        <DropdownMenu items={actions} />
      </div>
      <StatusBadges b={b} selected={selected} />
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-lg border px-3 py-2">
          <dt className="text-[11px] text-content-faint">{tr('br.manager')}</dt>
          <dd className="truncate font-medium text-content">
            {b.manager ? `${b.manager.firstName} ${b.manager.lastName}` : <span className="text-content-faint">{tr('br.noManager')}</span>}
          </dd>
        </div>
        <div className="rounded-lg border px-3 py-2">
          <dt className="text-[11px] text-content-faint">{tr('br.staff')}</dt>
          <dd className="font-medium text-content">{tr('br.staffCount', { count: b.staffCount })}</dd>
        </div>
        {showRevenue && b.revenue !== null && (
          <div className="col-span-2 rounded-lg border px-3 py-2">
            <dt className="text-[11px] text-content-faint">{tr('br.kpi.revenue')} · {periodLabel}</dt>
            <dd className="font-display text-lg font-bold text-content">
              {formatCurrency(b.revenue, currency)}
              <span className="ml-2 text-xs font-normal text-content-muted">{tr('br.salesCount', { count: b.salesCount ?? 0 })}</span>
            </dd>
          </div>
        )}
      </dl>
      <Alerts b={b} onComplete={onComplete} />
      <Button variant="outline" className="mt-auto w-full" onClick={onOpen}>
        <Eye className="h-4 w-4" /> {tr('br.view')}
      </Button>
    </article>
  );
}

function BranchTable({
  rows, activeBranchId, currency, showRevenue, actions, onOpen,
}: {
  rows: BranchRow[]; activeBranchId: string | null; currency: string; showRevenue: boolean; actions: (b: BranchRow) => DropdownItem[]; onOpen: (b: BranchRow) => void;
}) {
  const total = rows.reduce((s, b) => s + (b.revenue ?? 0), 0);
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="border-b text-left text-xs uppercase tracking-wide text-content-faint">
            <th className="table-cell font-semibold">{tr('br.col.branch')}</th>
            <th className="table-cell font-semibold">{tr('br.col.status')}</th>
            <th className="table-cell font-semibold">{tr('br.manager')}</th>
            <th className="table-cell text-right font-semibold">{tr('br.staff')}</th>
            {showRevenue && <th className="table-cell text-right font-semibold">{tr('br.kpi.revenue')}</th>}
            {showRevenue && <th className="table-cell text-right font-semibold">{tr('br.col.share')}</th>}
            <th className="table-cell font-semibold">{tr('br.col.alerts')}</th>
            <th className="table-cell" />
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => (
            <tr key={b.id} className={clsx('border-b last:border-0 hover:bg-surface-2/50', b.id === activeBranchId && 'bg-primary-soft/30')}>
              <td className="table-cell">
                <button type="button" onClick={() => onOpen(b)} className="flex items-center gap-3 text-left">
                  <BranchLogo b={b} />
                  <span className="min-w-0">
                    <span className="block font-semibold text-content hover:text-primary">{b.name}</span>
                    <span className="block text-xs text-content-muted">{[b.code, b.city].filter(Boolean).join(' · ') || '—'}</span>
                  </span>
                </button>
              </td>
              <td className="table-cell"><StatusBadges b={b} selected={b.id === activeBranchId} /></td>
              <td className="table-cell text-content-muted">{b.manager ? `${b.manager.firstName} ${b.manager.lastName}` : <span className="text-content-faint">{tr('br.noManager')}</span>}</td>
              <td className="table-cell text-right">{b.staffCount}</td>
              {showRevenue && <td className="table-cell text-right font-semibold text-content">{formatCurrency(b.revenue ?? 0, currency)}</td>}
              {showRevenue && (
                <td className="table-cell text-right text-content-muted">{total > 0 ? `${Math.round(((b.revenue ?? 0) / total) * 100)} %` : '—'}</td>
              )}
              <td className="table-cell text-xs">
                <div className="flex flex-wrap gap-1">
                  {b.status === 'SETUP' && <Badge tone="warning">{tr('br.alert.setupShort')}</Badge>}
                  {b.lowStock > 0 && <Badge tone="danger">{tr('br.alert.lowStockShort', { count: b.lowStock })}</Badge>}
                  {b.pendingIn > 0 && <Badge tone="info">{tr('br.alert.toReceiveShort', { count: b.pendingIn })}</Badge>}
                  {b.status !== 'SETUP' && !b.lowStock && !b.pendingIn && <span className="text-content-faint">—</span>}
                </div>
              </td>
              <td className="table-cell text-right"><DropdownMenu items={actions(b)} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
