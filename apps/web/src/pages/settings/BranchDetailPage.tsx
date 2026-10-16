import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import {
  ArrowLeft, Pencil, Crosshair, Wallet, Receipt, FileText, Banknote, PackageX, ArrowRightLeft, Users, Star, Archive,
  RotateCcw, MapPin, Phone, Mail, MessageCircle, Clock, Hash, Globe, ExternalLink, Lock, Boxes, Truck, ShieldCheck, Info, UserCog, Power,
} from 'lucide-react';
import { SUPPORTED_COUNTRIES, WEEK_DAYS, type BranchPeriod } from '@oculo/shared-types';
import { Badge, Button, EmptyState, PageLoader } from '../../components/ui';
import { useToast } from '../../components/Toast';
import { useAuthStore } from '../../store/auth';
import { useUIStore } from '../../store/ui';
import { apiErrorMessage } from '../../lib/api';
import { formatCurrency, formatDate, formatDateTime } from '../../lib/format';
import { tr } from '../../lib/tr';
import { getBranchDetail, restoreBranch, setMainBranch, updateBranch, type BranchDetail } from '../../features/branches/api';
import { BranchFormPanel } from '../../features/branches/BranchFormPanel';
import { ArchiveBranchDialog, BranchTeamModal } from '../../features/branches/BranchDialogs';
import { switchBranch } from '../../features/branches/context';
import { PendingTransfersModal, TransferStockModal } from '../optique/StockOperations';
import { BranchLogo, StatusBadges } from './BranchesPage';

const TABS = ['overview', 'info', 'team', 'stock', 'activity', 'settings'] as const;
type Tab = (typeof TABS)[number];

export function BranchDetailPage() {
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const tab: Tab = TABS.includes(params.get('tab') as Tab) ? (params.get('tab') as Tab) : 'overview';
  const setTab = (t: Tab) => setParams((p) => { p.set('tab', t); return p; }, { replace: true });
  const [period, setPeriod] = useState<BranchPeriod>('month');
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const activeBranchId = useUIStore((s) => s.activeBranchId);
  const [editing, setEditing] = useState(false);
  const [team, setTeam] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['branch', id, period],
    queryFn: () => getBranchDetail(id, period),
    enabled: Boolean(id),
  });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['branch'] });
    qc.invalidateQueries({ queryKey: ['branch-overview'] });
    qc.invalidateQueries({ queryKey: ['branches'] });
    qc.invalidateQueries({ queryKey: ['users'] });
  };

  if (isLoading) return <PageLoader />;
  if (isError || !data) {
    const status = (error as { response?: { status?: number } } | null)?.response?.status;
    return (
      <div className="space-y-4">
        <BackLink />
        <EmptyState
          icon={status === 403 ? Lock : Info}
          title={status === 403 ? tr('br.detail.forbidden') : status === 404 ? tr('br.detail.notFound') : tr('br.detail.error')}
          hint={status === 403 || status === 404 ? undefined : apiErrorMessage(error)}
          action={status && status < 500 ? undefined : <Button variant="outline" onClick={() => refetch()}>{tr('br.retry')}</Button>}
        />
      </div>
    );
  }

  const b = data.branch;
  const archived = b.status === 'ARCHIVED';
  const isActiveCtx = b.id === activeBranchId;
  const location = [b.address, b.city, SUPPORTED_COUNTRIES.find((c) => c.code === b.countryCode)?.name].filter(Boolean).join(', ');

  return (
    <div className="space-y-5">
      <BackLink />

      {/* En-tête */}
      <div className="card flex flex-wrap items-start gap-4 p-5">
        <BranchLogo b={b} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-bold text-content">{b.name}</h1>
          <p className="mt-0.5 flex items-center gap-1 text-sm text-content-muted">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            {location || <span className="italic text-content-faint">{tr('br.noLocation')}</span>}
            {b.code && <span className="ml-2 font-mono text-xs text-content-faint">{b.code}</span>}
          </p>
          <div className="mt-2"><StatusBadges b={b} selected={isActiveCtx} /></div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!archived && b.isActive && !isActiveCtx && (
            <Button variant="outline" onClick={() => switchBranch(b.id, qc)}>
              <Crosshair className="h-4 w-4" /> {tr('br.workHere')}
            </Button>
          )}
          {!archived && data.permissions.update && (
            <Button onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /> {tr('br.edit')}</Button>
          )}
        </div>
      </div>

      {archived && (
        <div className="flex items-center gap-2 rounded-xl border border-dashed px-4 py-3 text-sm text-content-muted">
          <Archive className="h-4 w-4" /> {tr('br.detail.archivedOn', { date: formatDate(b.archivedAt!) })}
        </div>
      )}

      {/* Onglets */}
      <Tabs tab={tab} onChange={setTab} show={{ team: data.permissions.team, stock: data.permissions.stock }} />

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'overview' && <Overview data={data} period={period} setPeriod={setPeriod} onTab={setTab} />}
        {tab === 'info' && <InfoTab data={data} onEdit={!archived && data.permissions.update ? () => setEditing(true) : undefined} />}
        {tab === 'team' && <TeamTab data={data} onManage={!archived && data.permissions.teamEdit ? () => setTeam(true) : undefined} />}
        {tab === 'stock' && <StockTab data={data} onChanged={refresh} />}
        {tab === 'activity' && <ActivityTab data={data} period={period} setPeriod={setPeriod} />}
        {tab === 'settings' && <SettingsTab data={data} onChanged={refresh} onArchive={() => setArchiving(true)} />}
      </div>

      {editing && (
        <BranchFormPanel
          branch={{ ...b, staffCount: 0, lowStock: 0, pendingIn: 0, pendingOut: 0, revenue: null, salesCount: null }}
          tenantCountry={data.tenantCountryCode ?? 'SN'}
          currency={data.currency}
          canAssignTeam={data.permissions.teamEdit}
          selfId={user?.id ?? ''}
          selfAllBranches={Boolean(user?.allBranches)}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); refresh(); }}
        />
      )}
      {team && <BranchTeamModal branch={b} onClose={() => setTeam(false)} onSaved={() => { setTeam(false); refresh(); }} />}
      {archiving && <ArchiveBranchDialog branch={b} onClose={() => setArchiving(false)} onDone={() => { setArchiving(false); refresh(); }} />}
    </div>
  );
}

function BackLink() {
  return (
    <Link to="/parametres/magasins" className="inline-flex items-center gap-1.5 text-sm font-medium text-content-muted hover:text-primary">
      <ArrowLeft className="h-4 w-4" /> {tr('br.detail.back')}
    </Link>
  );
}

function Tabs({ tab, onChange, show }: { tab: Tab; onChange: (t: Tab) => void; show: { team: boolean; stock: boolean } }) {
  const visible = TABS.filter((t) => (t === 'team' ? show.team : t === 'stock' ? show.stock : true));
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  // Navigation au clavier : flèches gauche / droite, Début / Fin.
  const onKey = (e: React.KeyboardEvent) => {
    const i = visible.indexOf(tab);
    const next = e.key === 'ArrowRight' ? visible[(i + 1) % visible.length] : e.key === 'ArrowLeft' ? visible[(i - 1 + visible.length) % visible.length] : e.key === 'Home' ? visible[0] : e.key === 'End' ? visible[visible.length - 1] : null;
    if (!next) return;
    e.preventDefault();
    onChange(next);
    refs.current[next]?.focus();
  };
  return (
    <div role="tablist" aria-label={tr('br.detail.tabs')} onKeyDown={onKey} className="flex gap-1 overflow-x-auto border-b">
      {visible.map((t) => (
        <button
          key={t}
          ref={(el) => (refs.current[t] = el)}
          id={`tab-${t}`}
          role="tab"
          aria-selected={tab === t}
          aria-controls={`panel-${t}`}
          tabIndex={tab === t ? 0 : -1}
          onClick={() => onChange(t)}
          className={clsx('-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold transition', tab === t ? 'border-primary text-primary' : 'border-transparent text-content-muted hover:text-content')}
        >
          {tr(`br.tab.${t}`)}
        </button>
      ))}
    </div>
  );
}

function PeriodPicker({ period, setPeriod }: { period: BranchPeriod; setPeriod: (p: BranchPeriod) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-xl bg-surface-2 p-1" role="group" aria-label={tr('br.period.label')}>
      {(['today', 'month', '30d'] as const).map((p) => (
        <button key={p} type="button" onClick={() => setPeriod(p)} aria-pressed={period === p} className={clsx('rounded-lg px-3 py-1.5 text-xs font-semibold', period === p ? 'bg-surface text-primary shadow-card' : 'text-content-muted')}>
          {tr(`br.period.${p}`)}
        </button>
      ))}
    </div>
  );
}

function Metric({ icon: Icon, label, value, hint, tone = 'primary', to }: { icon: typeof Wallet; label: string; value: React.ReactNode; hint?: string; tone?: 'primary' | 'danger' | 'warning' | 'success'; to?: () => void }) {
  const tones = { primary: 'bg-primary-soft text-primary', danger: 'bg-[color:var(--danger)]/15 text-danger', warning: 'bg-[color:var(--warning)]/15 text-warning', success: 'bg-[color:var(--success)]/15 text-success' };
  const body = (
    <>
      <span className={clsx('grid h-9 w-9 shrink-0 place-items-center rounded-lg', tones[tone])}><Icon className="h-4 w-4" /></span>
      <div className="min-w-0 text-left">
        <p className="text-xs font-medium text-content-muted">{label}</p>
        <p className="font-display text-lg font-bold leading-tight text-content">{value}</p>
        {hint && <p className="truncate text-[11px] text-content-faint">{hint}</p>}
      </div>
    </>
  );
  return to ? (
    <button type="button" onClick={to} className="card flex items-start gap-3 p-3.5 text-left transition hover:shadow-card-lg focus-visible:ring-2 focus-visible:ring-primary">{body}</button>
  ) : (
    <div className="card flex items-start gap-3 p-3.5">{body}</div>
  );
}

/** Ouvre un module filtré sur CE magasin : le contexte actif bascule explicitement. */
function useOpenIn(branchId: string) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  return (path: string) => {
    if (switchBranch(branchId, qc)) navigate(path);
  };
}

function Overview({ data, period, setPeriod, onTab }: { data: BranchDetail; period: BranchPeriod; setPeriod: (p: BranchPeriod) => void; onTab: (t: Tab) => void }) {
  const a = data.activity;
  const s = data.stock;
  const p = data.permissions;
  const openIn = useOpenIn(data.branch.id);
  const archived = data.branch.status === 'ARCHIVED';
  const pendingIn = s?.transfers.filter((t) => t.status === 'PENDING' && t.toBranchId === data.branch.id).length ?? 0;
  const since = tr(`br.period.${period}Since`, { date: formatDate(data.from) });
  return (
    <div className="space-y-4">
      {(p.revenue || p.sales) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-content-muted">{since}</p>
          {p.revenue && <PeriodPicker period={period} setPeriod={setPeriod} />}
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {p.revenue && a.revenue !== null && (
          <Metric icon={Wallet} label={tr('br.kpi.revenue')} value={formatCurrency(a.revenue, data.currency)} hint={tr('br.salesCount', { count: a.salesCount ?? 0 })} to={archived ? undefined : () => openIn('/optique/ventes')} />
        )}
        {p.revenue && a.collected !== null && <Metric icon={Banknote} label={tr('br.detail.collected')} value={formatCurrency(a.collected, data.currency)} tone="success" hint={tr('br.detail.collectedHint')} />}
        {p.sales && a.receivables !== null && (
          <Metric icon={Receipt} label={tr('br.detail.receivables')} value={formatCurrency(a.receivables, data.currency)} tone={a.receivables > 0 ? 'warning' : 'success'} hint={tr('br.detail.allTime')} to={archived ? undefined : () => openIn('/gestion/creances')} />
        )}
        {p.sales && a.openQuotes !== null && <Metric icon={FileText} label={tr('br.detail.openQuotes')} value={a.openQuotes} to={archived ? undefined : () => openIn('/optique/devis')} />}
        {s && (
          <Metric icon={PackageX} label={tr('br.detail.lowStock')} value={s.lowStockCount ?? 0} tone={(s.lowStockCount ?? 0) > 0 ? 'danger' : 'success'} to={() => onTab('stock')} />
        )}
        {s && <Metric icon={Truck} label={tr('br.detail.toReceive')} value={pendingIn} hint={s.inTransitIn ? tr('br.detail.unitsInTransit', { n: s.inTransitIn }) : undefined} to={() => onTab('stock')} />}
        <Metric
          icon={Power}
          label={tr('br.detail.register')}
          value={a.registerOpenSince ? tr('br.detail.registerOpen') : tr('br.detail.registerClosed')}
          hint={a.registerOpenSince ? tr('br.detail.since', { date: formatDateTime(a.registerOpenSince) }) : undefined}
          tone={a.registerOpenSince ? 'success' : 'primary'}
        />
        {p.team && <Metric icon={Users} label={tr('br.staff')} value={data.team?.filter((u) => u.isActive).length ?? 0} hint={data.branch.manager ? tr('br.detail.managedBy', { name: `${data.branch.manager.firstName} ${data.branch.manager.lastName}` }) : tr('br.noManager')} to={() => onTab('team')} />}
      </div>

      <div className="card flex gap-3 p-4 text-sm text-content-muted">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div>
          <p>{tr('br.detail.lensOrdersShared')}</p>
          <Link to="/optique/commandes-verres" className="mt-1 inline-flex items-center gap-1 font-semibold text-primary hover:underline">
            {tr('br.detail.openLensOrders')} <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {data.branch.missing.length > 0 && !archived && (
        <div className="card flex flex-wrap items-center gap-3 border-[color:var(--warning)]/40 p-4">
          <ShieldCheck className="h-5 w-5 text-warning" />
          <p className="flex-1 text-sm text-content">{tr('br.alert.setup', { fields: data.branch.missing.map((m) => tr(`br.missing.${m}`)).join(', ') })}</p>
          <Button variant="outline" onClick={() => onTab('info')}>{tr('br.alert.complete')}</Button>
        </div>
      )}
    </div>
  );
}

function Row({ icon: Icon, label, value, empty }: { icon: typeof Hash; label: string; value?: React.ReactNode; empty?: string }) {
  return (
    <div className="flex items-start gap-3 border-b py-2.5 last:border-0">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-content-faint" />
      <dt className="w-36 shrink-0 text-sm text-content-muted">{label}</dt>
      <dd className="min-w-0 flex-1 break-words text-sm text-content">{value || <span className="italic text-content-faint">{empty ?? tr('br.info.empty')}</span>}</dd>
    </div>
  );
}

function InfoTab({ data, onEdit }: { data: BranchDetail; onEdit?: () => void }) {
  const b = data.branch;
  const hours = b.openingHours;
  const waDigits = b.whatsapp?.replace(/[^\d]/g, '');
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <section className="card p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-bold text-content">{tr('br.form.contact')}</h2>
          {onEdit && <Button variant="ghost" className="h-8 px-2 text-xs" onClick={onEdit}><Pencil className="h-3.5 w-3.5" /> {tr('br.edit')}</Button>}
        </div>
        <dl>
          <Row icon={Hash} label={tr('br.form.code')} value={b.code && <span className="font-mono">{b.code}</span>} />
          <Row icon={Globe} label={tr('br.form.country')} value={SUPPORTED_COUNTRIES.find((c) => c.code === b.countryCode)?.name} />
          <Row icon={MapPin} label={tr('br.form.city')} value={b.city} empty={tr('br.info.toComplete')} />
          <Row icon={MapPin} label={tr('br.form.address')} value={b.address} empty={tr('br.info.toComplete')} />
          <Row icon={Phone} label={tr('br.form.phone')} value={b.phone && <a href={`tel:${b.phone.replace(/\s/g, '')}`} className="text-primary hover:underline">{b.phone}</a>} empty={tr('br.info.toComplete')} />
          <Row icon={MessageCircle} label={tr('br.form.whatsapp')} value={b.whatsapp && <a href={`https://wa.me/${waDigits}`} target="_blank" rel="noreferrer" className="text-primary hover:underline">{b.whatsapp}</a>} />
          <Row icon={Mail} label={tr('br.form.email')} value={b.email && <a href={`mailto:${b.email}`} className="text-primary hover:underline">{b.email}</a>} />
          <Row icon={Users} label={tr('br.manager')} value={b.manager && `${b.manager.firstName} ${b.manager.lastName}`} empty={tr('br.info.toComplete')} />
        </dl>
      </section>
      <section className="card p-4">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-content"><Clock className="h-4 w-4 text-primary" /> {tr('br.form.hours')}</h2>
        {hours ? (
          <dl>
            {WEEK_DAYS.map((d) => (
              <div key={d} className="flex justify-between border-b py-2 text-sm last:border-0">
                <dt className="text-content-muted">{tr(`br.day.${d}`)}</dt>
                <dd className="font-medium text-content">{hours[d] ? `${hours[d]!.open} – ${hours[d]!.close}` : <span className="text-content-faint">{tr('br.form.closed')}</span>}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-content-faint">{tr('br.form.hoursNone')}</p>
        )}
        <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-xs text-content-muted">{tr('br.form.orgSettings', { currency: data.currency })}</p>
        <p className="mt-2 text-xs text-content-faint">{tr('br.info.created', { date: formatDate(b.createdAt) })}</p>
      </section>
    </div>
  );
}

function TeamTab({ data, onManage }: { data: BranchDetail; onManage?: () => void }) {
  const team = data.team ?? [];
  return (
    <div className="space-y-4">
      <section className="card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-content">{tr('br.team.assigned', { count: team.length })}</h2>
          <div className="flex gap-2">
            <Link to="/parametres/utilisateurs" className="btn-ghost h-9 rounded-xl px-3 text-sm">{tr('br.team.usersPage')}</Link>
            {onManage && <Button onClick={onManage}><UserCog className="h-4 w-4" /> {tr('br.manageTeam')}</Button>}
          </div>
        </div>
        {team.length === 0 ? (
          <p className="py-6 text-center text-sm text-content-muted">{tr('br.team.empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-content-faint">
                  <th className="table-cell font-semibold">{tr('br.team.member')}</th>
                  <th className="table-cell font-semibold">{tr('br.team.role')}</th>
                  <th className="table-cell font-semibold">{tr('br.team.access')}</th>
                  <th className="table-cell font-semibold">{tr('br.team.lastLogin')}</th>
                </tr>
              </thead>
              <tbody>
                {team.map((u) => (
                  <tr key={u.id} className={clsx('border-b last:border-0', !u.isActive && 'opacity-60')}>
                    <td className="table-cell">
                      <span className="font-medium text-content">{u.firstName} {u.lastName}</span>
                      {data.branch.managerId === u.id && <span className="ml-2"><Badge tone="info">{tr('br.team.isManager')}</Badge></span>}
                      {!u.isActive && <span className="ml-2"><Badge>{tr('br.team.inactive')}</Badge></span>}
                      <span className="block text-xs text-content-muted">{u.email}</span>
                    </td>
                    <td className="table-cell text-content-muted">{u.role.name}</td>
                    <td className="table-cell text-content-muted">{u.role.allBranches ? tr('br.team.allAccess') : tr('br.team.nBranches', { count: u.branchCount })}</td>
                    <td className="table-cell text-content-muted">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {data.allBranchUsers && data.allBranchUsers.length > 0 && (
        <section className="card p-4">
          <h2 className="mb-1 text-sm font-bold text-content">{tr('br.team.allBranchUsers')}</h2>
          <p className="mb-3 text-xs text-content-muted">{tr('br.team.allBranchHint')}</p>
          <div className="flex flex-wrap gap-2">
            {data.allBranchUsers.map((u) => (
              <span key={u.id} className="rounded-lg border px-2.5 py-1 text-xs"><b className="text-content">{u.firstName} {u.lastName}</b> <span className="text-content-muted">· {u.role.name}</span></span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function StockTab({ data, onChanged }: { data: BranchDetail; onChanged: () => void }) {
  const s = data.stock!;
  const [transfer, setTransfer] = useState(false);
  const [receive, setReceive] = useState(false);
  const archived = data.branch.status === 'ARCHIVED';
  const pendingIn = s.transfers.filter((t) => t.status === 'PENDING' && t.toBranchId === data.branch.id).length;
  const openIn = useOpenIn(data.branch.id);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric icon={Boxes} label={tr('br.stock.available')} value={s.units} hint={tr('br.stock.refs', { count: s.refs })} />
        <Metric icon={Truck} label={tr('br.stock.inTransit')} value={s.inTransitIn} hint={tr('br.stock.inTransitHint')} />
        <Metric icon={PackageX} label={tr('br.detail.lowStock')} value={s.lowStockCount ?? 0} tone={(s.lowStockCount ?? 0) > 0 ? 'danger' : 'success'} />
        <Metric icon={ArrowRightLeft} label={tr('br.detail.toReceive')} value={pendingIn} />
      </div>
      {!archived && (
        <div className="flex flex-wrap gap-2">
          {data.permissions.transfer && <Button onClick={() => setTransfer(true)}><ArrowRightLeft className="h-4 w-4" /> {tr('br.stock.newTransfer')}</Button>}
          {data.permissions.transfer && pendingIn > 0 && <Button variant="outline" onClick={() => setReceive(true)}><Truck className="h-4 w-4" /> {tr('br.stock.receive', { count: pendingIn })}</Button>}
          <Button variant="ghost" onClick={() => openIn('/optique/stock')}><ExternalLink className="h-4 w-4" /> {tr('br.stock.openStock')}</Button>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="card p-4">
          <h2 className="mb-2 text-sm font-bold text-content">{tr('br.stock.lowTitle')}</h2>
          {!s.lowStock || s.lowStock.length === 0 ? (
            <p className="py-4 text-center text-sm text-content-muted">{tr('br.stock.noLow')}</p>
          ) : (
            <ul className="divide-y">
              {s.lowStock.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span className="min-w-0"><span className="block truncate text-content">{p.name}</span><span className="font-mono text-[11px] text-content-faint">{p.sku}</span></span>
                  <span className="shrink-0 text-right"><b className={p.quantity <= 0 ? 'text-danger' : 'text-warning'}>{p.quantity}</b><span className="text-xs text-content-faint"> / {tr('br.stock.min', { n: p.minAlert })}</span></span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card p-4">
          <h2 className="mb-2 text-sm font-bold text-content">{tr('br.stock.history')}</h2>
          {s.transfers.length === 0 ? (
            <p className="py-4 text-center text-sm text-content-muted">{tr('br.stock.noTransfers')}</p>
          ) : (
            <ul className="divide-y">
              {s.transfers.map((t) => {
                const out = t.fromBranchId === data.branch.id;
                return (
                  <li key={t.id} className="py-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs text-content">{t.number}</span>
                      <Badge tone={t.status === 'PENDING' ? 'warning' : t.status === 'CONFIRMED' ? 'success' : 'neutral'}>{tr(`br.transfer.${t.status}`)}</Badge>
                    </div>
                    <p className="text-content">
                      {out ? tr('br.stock.sentTo', { name: t.toBranch.name }) : tr('br.stock.receivedFrom', { name: t.fromBranch.name })} · {tr('br.stock.units', { count: t.units })}
                    </p>
                    <p className="text-xs text-content-faint">
                      {formatDateTime(t.createdAt)}{t.createdBy ? ` · ${t.createdBy.firstName} ${t.createdBy.lastName}` : ''}
                      {t.confirmedAt ? ` — ${tr('br.stock.confirmedBy', { date: formatDateTime(t.confirmedAt), name: t.confirmedBy ? `${t.confirmedBy.firstName} ${t.confirmedBy.lastName}` : '—' })}` : ''}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
      {transfer && <TransferStockModal branchId={data.branch.id} onClose={() => { setTransfer(false); onChanged(); }} />}
      {receive && <PendingTransfersModal branchId={data.branch.id} onClose={() => { setReceive(false); onChanged(); }} />}
    </div>
  );
}

function ActivityTab({ data, period, setPeriod }: { data: BranchDetail; period: BranchPeriod; setPeriod: (p: BranchPeriod) => void }) {
  const a = data.activity;
  const p = data.permissions;
  const openIn = useOpenIn(data.branch.id);
  if (!p.revenue && !p.sales) return <EmptyState icon={Lock} title={tr('br.detail.noActivityAccess')} />;
  const basket = a.revenue !== null && a.salesCount ? Math.round(a.revenue / a.salesCount) : null;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-content-muted">{tr(`br.period.${period}Since`, { date: formatDate(data.from) })}</p>
        {p.revenue && <PeriodPicker period={period} setPeriod={setPeriod} />}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {p.revenue && <Metric icon={Wallet} label={tr('br.kpi.revenue')} value={formatCurrency(a.revenue ?? 0, data.currency)} hint={tr('br.detail.revenueHint')} />}
        {p.revenue && <Metric icon={Banknote} label={tr('br.detail.collected')} value={formatCurrency(a.collected ?? 0, data.currency)} tone="success" />}
        {p.revenue && <Metric icon={Receipt} label={tr('br.detail.sales')} value={a.salesCount ?? 0} hint={basket !== null ? tr('br.detail.basket', { amount: formatCurrency(basket, data.currency) }) : undefined} />}
        {p.sales && <Metric icon={Receipt} label={tr('br.detail.receivables')} value={formatCurrency(a.receivables ?? 0, data.currency)} tone={(a.receivables ?? 0) > 0 ? 'warning' : 'success'} hint={tr('br.detail.allTime')} />}
      </div>
      {data.branch.status !== 'ARCHIVED' && (
        <div className="flex flex-wrap gap-2">
          {p.sales && <Button variant="outline" onClick={() => openIn('/optique/ventes')}><ExternalLink className="h-4 w-4" /> {tr('br.detail.openSales')}</Button>}
          {p.sales && <Button variant="outline" onClick={() => openIn('/gestion/creances')}><ExternalLink className="h-4 w-4" /> {tr('br.detail.openReceivables')}</Button>}
          {p.revenue && <Button variant="ghost" onClick={() => openIn('/dashboard')}><ExternalLink className="h-4 w-4" /> {tr('br.detail.openDashboard')}</Button>}
        </div>
      )}
      <p className="text-xs text-content-faint">{tr('br.detail.switchNote')}</p>
    </div>
  );
}

function SettingsTab({ data, onChanged, onArchive }: { data: BranchDetail; onChanged: () => void; onArchive: () => void }) {
  const toast = useToast();
  const b = data.branch;
  const p = data.permissions;
  const archived = b.status === 'ARCHIVED';
  const activeMut = useMutation({
    mutationFn: () => updateBranch(b.id, { isActive: !b.isActive }),
    onSuccess: () => { toast.success(b.isActive ? tr('br.settings.deactivated') : tr('br.settings.activated')); onChanged(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const mainMut = useMutation({
    mutationFn: () => setMainBranch(b.id),
    onSuccess: () => { toast.success(tr('br.mainSet', { name: b.name })); onChanged(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const restoreMut = useMutation({
    mutationFn: () => restoreBranch(b.id),
    onSuccess: () => { toast.success(tr('br.restored', { name: b.name })); onChanged(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  if (!p.update) return <EmptyState icon={Lock} title={tr('br.settings.noAccess')} />;
  return (
    <div className="space-y-3">
      {!archived && (
        <SettingRow
          icon={Power}
          title={tr('br.settings.activeTitle')}
          text={b.isMain && b.isActive ? tr('br.settings.mainCannotDeactivate') : tr('br.settings.activeText')}
          action={<Button variant="outline" onClick={() => activeMut.mutate()} loading={activeMut.isPending} disabled={b.isMain && b.isActive}>{b.isActive ? tr('br.settings.deactivate') : tr('br.settings.activate')}</Button>}
        />
      )}
      {!archived && (
        <SettingRow
          icon={Star}
          title={tr('br.settings.mainTitle')}
          text={b.isMain ? tr('br.settings.isMain') : p.setMain ? tr('br.settings.mainText') : tr('br.settings.mainRestricted')}
          action={!b.isMain && p.setMain ? <Button variant="outline" onClick={() => mainMut.mutate()} loading={mainMut.isPending} disabled={!b.isActive}>{tr('br.makeMain')}</Button> : undefined}
        />
      )}
      {archived ? (
        <SettingRow icon={RotateCcw} title={tr('br.settings.restoreTitle')} text={tr('br.settings.restoreText')} action={<Button onClick={() => restoreMut.mutate()} loading={restoreMut.isPending}>{tr('br.restore')}</Button>} />
      ) : (
        <SettingRow
          icon={Archive}
          title={tr('br.archive.action')}
          text={b.isMain ? tr('br.archive.isMain') : tr('br.settings.archiveText')}
          danger
          action={!b.isMain ? <Button variant="danger" onClick={onArchive}>{tr('br.archive.action')}</Button> : undefined}
        />
      )}
      <p className="flex items-center gap-2 text-xs text-content-faint">
        <ShieldCheck className="h-3.5 w-3.5" /> {tr('br.settings.audited')}{' '}
        <Link to="/parametres/journal" className="font-semibold text-primary hover:underline">{tr('br.settings.openAudit')}</Link>
      </p>
    </div>
  );
}

function SettingRow({ icon: Icon, title, text, action, danger }: { icon: typeof Star; title: string; text: string; action?: React.ReactNode; danger?: boolean }) {
  return (
    <div className={clsx('card flex flex-wrap items-center gap-4 p-4', danger && 'border-[color:var(--danger)]/30')}>
      <span className={clsx('grid h-10 w-10 shrink-0 place-items-center rounded-xl', danger ? 'bg-[color:var(--danger)]/10 text-danger' : 'bg-primary-soft text-primary')}><Icon className="h-5 w-5" /></span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-content">{title}</p>
        <p className="text-sm text-content-muted">{text}</p>
      </div>
      {action}
    </div>
  );
}
