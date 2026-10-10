import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  Factory,
  KeyRound,
  Package,
  PackagePlus,
  Plus,
  RotateCcw,
  ScanLine,
  Search,
  Timer,
  Truck,
  Wrench,
  Store,
} from 'lucide-react';
import { ot, type TrackOrderRow, type TrackPackageRow } from '../../../features/oculotrack/api';
import { PackageBadge, QrScanner, StageBadge, eventLabel, stageProgress } from '../../../features/oculotrack/ui';
import { PageHeader, Button, EmptyState, PageLoader } from '../../../components/ui';
import { usePermission } from '../../../store/auth';
import { apiErrorMessage } from '../../../lib/api';
import { formatDate, formatDateTime } from '../../../lib/format';
import { tr } from '../../../lib/tr';
import { OrderPanel } from './OrderPanel';
import { PackagePanel } from './PackagePanel';
import { CreatePackageModal, InviteModal, StartTrackingModal } from './modals';
import { AccessesTab, AnomaliesTab } from './tabs';

type Tab = 'orders' | 'packages' | 'anomalies' | 'portal';

export function OculoTrackPage() {
  const canManage = usePermission('oculotrack.manage');
  const canPortal = usePermission('oculotrack.portal');
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>('orders');
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [modal, setModal] = useState<null | { kind: 'start'; orderId?: string } | { kind: 'package' } | { kind: 'invite'; supplierId?: string }>(null);
  const [scan, setScan] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  // Liens profonds : ?order=… / ?package=… (notifications) et ?start=… (depuis une commande de verres).
  const orderId = params.get('order');
  const packageId = params.get('package');
  useEffect(() => {
    const start = params.get('start');
    if (start && canManage) {
      setModal({ kind: 'start', orderId: start });
      params.delete('start');
      setParams(params, { replace: true });
    }
  }, [params, setParams, canManage]);
  const openOrder = (id: string) => setParams({ order: id });
  const openPackage = (id: string) => setParams({ package: id });
  const closePanel = () => setParams({});

  const dash = useQuery({ queryKey: ['ot', 'dashboard'], queryFn: ot.dashboard, refetchInterval: 60_000 });
  const orders = useQuery({ queryKey: ['ot', 'orders', debounced], queryFn: () => ot.orders({ q: debounced || undefined, done: debounced ? '1' : undefined }), enabled: tab === 'orders' });
  const packages = useQuery({ queryKey: ['ot', 'packages', debounced], queryFn: () => ot.packages({ q: debounced || undefined }), enabled: tab === 'packages' });

  async function onScan(token: string) {
    setScan(false);
    try {
      openPackage(await ot.resolveToken(token));
    } catch (e) {
      alert(apiErrorMessage(e));
    }
  }

  const k = dash.data?.kpis;
  const KPIS = [
    { key: 'inTransit', icon: Truck, tone: 'text-sky-500 bg-sky-500/12', value: k?.inTransit },
    { key: 'atSupplier', icon: Factory, tone: 'text-violet-500 bg-violet-500/12', value: k?.atSupplier },
    { key: 'mounting', icon: Wrench, tone: 'text-indigo-500 bg-indigo-500/12', value: k?.mounting },
    { key: 'readyToReturn', icon: RotateCcw, tone: 'text-amber-500 bg-amber-500/14', value: k?.readyToReturn },
    { key: 'late', icon: Timer, tone: 'text-red-500 bg-red-500/12', value: k?.late, alert: (k?.late ?? 0) > 0 },
    { key: 'anomalies', icon: AlertTriangle, tone: 'text-red-500 bg-red-500/12', value: k?.anomalies, alert: (k?.anomalies ?? 0) > 0 },
  ] as const;

  return (
    <div className="space-y-5">
      <PageHeader
        title="OculoTrack"
        subtitle={tr('ot.subtitle')}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setScan(true)}>
              <ScanLine className="h-4 w-4" /> {tr('ot.scan')}
            </Button>
            {canPortal && (
              <Button variant="outline" onClick={() => setModal({ kind: 'invite' })}>
                <KeyRound className="h-4 w-4" /> {tr('ot.inviteLab')}
              </Button>
            )}
            {canManage && (
              <>
                <Button variant="outline" onClick={() => setModal({ kind: 'start' })}>
                  <Plus className="h-4 w-4" /> {tr('ot.trackOrder')}
                </Button>
                <Button onClick={() => setModal({ kind: 'package' })}>
                  <PackagePlus className="h-4 w-4" /> {tr('ot.preparePackage')}
                </Button>
              </>
            )}
          </div>
        }
      />

      {/* Indicateurs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {KPIS.map((x) => {
          const Icon = x.icon;
          return (
            <div key={x.key} className={`card p-4 ${'alert' in x && x.alert ? 'ring-1 ring-red-500/40' : ''}`}>
              <span className={`grid h-9 w-9 place-items-center rounded-xl ${x.tone}`}>
                <Icon className="h-4.5 w-4.5" />
              </span>
              <p className="mt-3 font-display text-2xl font-bold text-content">{x.value ?? '—'}</p>
              <p className="text-xs text-content-muted">{tr(`ot.kpi.${x.key}`)}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Flux */}
        <div className="card p-4 xl:col-span-1">
          <p className="mb-3 text-sm font-bold text-content">{tr('ot.flows')}</p>
          {!dash.data?.flows.length ? (
            <p className="text-sm text-content-muted">{tr('ot.noFlows')}</p>
          ) : (
            <ul className="space-y-3">
              {dash.data.flows.map((f) => {
                const max = Math.max(...dash.data!.flows.map((x) => x.count));
                return (
                  <li key={`${f.from}-${f.to}`}>
                    <div className="flex items-center gap-2 text-sm font-medium text-content">
                      <span className="truncate">{f.from}</span>
                      <ArrowRight className={`h-4 w-4 shrink-0 ${f.direction === 'RETURN' ? 'text-emerald-500' : 'text-sky-500'}`} />
                      <span className="truncate">{f.to}</span>
                      <span className="ml-auto font-mono text-xs text-content-muted">{f.count}</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-2">
                      <div className={`h-full rounded-full ${f.direction === 'RETURN' ? 'bg-emerald-500' : 'bg-sky-500'}`} style={{ width: `${(f.count / max) * 100}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Retards */}
        <div className="card p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-bold text-content">
            <Timer className="h-4 w-4 text-red-500" /> {tr('ot.lateTitle')}
          </p>
          {!dash.data?.latePackages.length && !dash.data?.lateOrders.length ? (
            <p className="text-sm text-content-muted">{tr('ot.noLate')}</p>
          ) : (
            <ul className="space-y-2">
              {dash.data!.latePackages.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => openPackage(p.id)} className="flex w-full items-center gap-2 rounded-xl bg-red-500/8 p-2.5 text-left hover:bg-red-500/12">
                    <Package className="h-4 w-4 shrink-0 text-red-500" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-mono text-xs font-bold text-content">{p.number}</span>
                      <span className="block text-xs text-red-600 dark:text-red-300">{tr('ot.lateSince', { n: p.lateDays })}</span>
                    </span>
                    <span className="text-xs text-content-muted">{p.supplier?.name}</span>
                  </button>
                </li>
              ))}
              {dash.data!.lateOrders.map((o) => (
                <li key={o.id}>
                  <button type="button" onClick={() => openOrder(o.id)} className="flex w-full items-center gap-2 rounded-xl bg-amber-500/8 p-2.5 text-left hover:bg-amber-500/12">
                    <Boxes className="h-4 w-4 shrink-0 text-amber-500" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-mono text-xs font-bold text-content">{o.trackCode}</span>
                      <span className="block text-xs text-amber-700 dark:text-amber-300">{tr('ot.returnLate', { n: o.lateDays })}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Activité */}
        <div className="card p-4">
          <p className="mb-3 text-sm font-bold text-content">{tr('ot.activity')}</p>
          {!dash.data?.events.length ? (
            <p className="text-sm text-content-muted">{tr('ot.noActivity')}</p>
          ) : (
            <ul className="space-y-2">
              {dash.data.events.slice(0, 8).map((e) => (
                <li key={e.id} className="flex items-start gap-2 text-xs">
                  <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${e.type.startsWith('ANOMALY') || e.type === 'LATE_DETECTED' ? 'bg-red-500' : 'bg-emerald-500'}`} />
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left hover:underline"
                    onClick={() => (e.lensOrder ? openOrder(e.lensOrder.id) : e.package ? openPackage(e.package.id) : undefined)}
                  >
                    <span className="font-semibold text-content">{e.lensOrder?.trackCode ?? e.package?.number}</span>{' '}
                    <span className="text-content-muted">{eventLabel(e)} · {e.actorName}</span>
                  </button>
                  <span className="shrink-0 text-content-faint">{formatDateTime(e.occurredAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Onglets + recherche */}
      <div className="card">
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          {/* Onglets bien marqués : icône, fond et soulignement sur l'onglet actif. */}
          <div className="flex flex-wrap gap-1" role="tablist">
            {(['orders', 'packages', 'anomalies', ...(canPortal ? ['portal'] : [])] as Tab[]).map((t) => {
              const Icon = { orders: Boxes, packages: Package, anomalies: AlertTriangle, portal: KeyRound }[t];
              return (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold transition ${tab === t ? 'border-primary bg-primary-soft text-primary' : 'border-line text-content-muted hover:border-primary/50 hover:text-content'}`}
              >
                <Icon className="h-4 w-4" />
                {tr(`ot.tab.${t}`)}
                {t === 'anomalies' && (k?.anomalies ?? 0) > 0 && <span className="ml-1.5 rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">{k!.anomalies}</span>}
              </button>
              );
            })}
          </div>
          {(tab === 'orders' || tab === 'packages') && (
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-faint" />
              <input className="input pl-9" placeholder={tr('ot.search')} value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          )}
          {tab === 'portal' && (
            <Button className="ml-auto" onClick={() => setModal({ kind: 'invite' })}>
              <KeyRound className="h-4 w-4" /> {tr('ot.invite')}
            </Button>
          )}
        </div>

        {tab === 'orders' && <OrdersList rows={orders.data} loading={orders.isLoading} onOpen={openOrder} />}
        {tab === 'packages' && <PackagesList rows={packages.data} loading={packages.isLoading} onOpen={openPackage} />}
        {tab === 'anomalies' && <AnomaliesTab onOpenOrder={openOrder} onOpenPackage={openPackage} canManage={canManage} />}
        {tab === 'portal' && <AccessesTab />}
      </div>

      {orderId && <OrderPanel id={orderId} onClose={closePanel} onOpenPackage={openPackage} canManage={canManage} />}
      {packageId && !orderId && (
        <PackagePanel id={packageId} onClose={closePanel} onOpenOrder={openOrder} canManage={canManage} onInvite={canPortal ? (supplierId) => setModal({ kind: 'invite', supplierId }) : undefined} />
      )}
      {modal?.kind === 'start' && <StartTrackingModal orderId={modal.orderId} onClose={() => setModal(null)} onDone={(id) => { setModal(null); openOrder(id); }} />}
      {modal?.kind === 'package' && <CreatePackageModal onClose={() => setModal(null)} onDone={(id) => { setModal(null); openPackage(id); }} />}
      {modal?.kind === 'invite' && <InviteModal supplierId={modal.supplierId} onClose={() => setModal(null)} />}
      {scan && <QrScanner onResult={onScan} onClose={() => setScan(false)} />}
    </div>
  );
}

function OrdersList({ rows, loading, onOpen }: { rows?: TrackOrderRow[]; loading: boolean; onOpen: (id: string) => void }) {
  if (loading) return <PageLoader />;
  if (!rows?.length) return <EmptyState icon={Boxes} title={tr('ot.noOrders')} />;
  return (
    <ul className="divide-y">
      {rows.map((o) => (
        <li key={o.id}>
          <button type="button" onClick={() => onOpen(o.id)} className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-surface-2/50 sm:flex-nowrap">
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${o.location === 'LAB' ? 'bg-violet-500/12 text-violet-500' : o.location === 'STORE' ? 'bg-primary-soft text-primary' : 'bg-sky-500/12 text-sky-500'}`}>
              {o.location === 'LAB' ? <Factory className="h-5 w-5" /> : o.location === 'STORE' || o.location === 'DONE' ? <Store className="h-5 w-5" /> : <Truck className="h-5 w-5" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-x-2">
                <span className="font-mono text-sm font-bold text-content">{o.trackCode}</span>
                <span className="text-xs text-content-faint">{o.number}</span>
                {o.openAnomalies > 0 && <span className="rounded-full bg-red-500/12 px-1.5 text-[10px] font-bold text-red-600">⚠ {o.openAnomalies}</span>}
              </span>
              <span className="block truncate text-sm text-content-muted">
                {o.customer ? `${o.customer.firstName} ${o.customer.lastName}` : '—'} · {o.supplierName ?? '—'}
                {o.frameRef ? ` · ${o.frameRef}` : ''}
              </span>
              <span className="mt-1.5 block h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-surface-2">
                <span className="block h-full rounded-full bg-primary" style={{ width: `${stageProgress(o.trackStage) * 100}%` }} />
              </span>
            </span>
            <span className="flex flex-col items-end gap-1">
              <StageBadge stage={o.trackStage} issue={o.openAnomalies > 0} />
              {o.lateDays > 0 ? (
                <span className="text-[11px] font-semibold text-red-500">{tr('ot.returnLate', { n: o.lateDays })}</span>
              ) : o.expectedAt ? (
                <span className="text-[11px] text-content-faint">{tr('ot.returnBy', { date: formatDate(o.expectedAt) })}</span>
              ) : null}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function PackagesList({ rows, loading, onOpen }: { rows?: TrackPackageRow[]; loading: boolean; onOpen: (id: string) => void }) {
  const sorted = useMemo(() => rows ?? [], [rows]);
  if (loading) return <PageLoader />;
  if (!sorted.length) return <EmptyState icon={Package} title={tr('ot.noPackages')} />;
  return (
    <ul className="divide-y">
      {sorted.map((p) => (
        <li key={p.id}>
          <button type="button" onClick={() => onOpen(p.id)} className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-surface-2/50 sm:flex-nowrap">
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${p.direction === 'RETURN' ? 'bg-emerald-500/12 text-emerald-600' : 'bg-sky-500/12 text-sky-600'}`}>
              <Package className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-x-2">
                <span className="font-mono text-sm font-bold text-content">{p.number}</span>
                <span className="text-xs text-content-faint">{tr(`ot.dir.${p.direction}`)} · {tr('ot.ordersCount', { n: p._count.items })}</span>
              </span>
              <span className="flex items-center gap-1.5 truncate text-sm text-content-muted">
                {p.fromCity || tr('ot.loc.store')} <ArrowRight className="h-3.5 w-3.5" /> {p.toCity || p.supplier?.name || '—'}
                {p.carrierName ? ` · ${p.carrierName}` : ''}
                {p.externalTracking ? ` · ${p.externalTracking}` : ''}
              </span>
            </span>
            <span className="flex flex-col items-end gap-1">
              <PackageBadge status={p.status} late={p.lateDays} />
              {p.expectedAt && <span className="text-[11px] text-content-faint">{tr('ot.expected', { date: formatDate(p.expectedAt) })}</span>}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
