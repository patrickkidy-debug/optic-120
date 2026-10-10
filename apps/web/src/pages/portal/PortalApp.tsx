import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, NavLink, Outlet, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Boxes,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  CloudOff,
  Eraser,
  FileText,
  Home,
  Loader2,
  LogOut,
  MapPin,
  Package,
  PackageCheck,
  RotateCcw,
  ScanLine,
  Send,
  Timer,
  Truck,
  Wrench,
} from 'lucide-react';
import { LENS_TREATMENTS, LAB_SETTABLE_STAGES, trackStageRank, type TrackAnomalyType, type TrackStage } from '@oculo/shared-types';
import {
  flushQueue,
  portal,
  portalError,
  refreshPortal,
  sendAction,
  usePendingCount,
  usePortal,
  type PortalPackageDetail,
} from '../../features/oculotrack/portal';
import { trackFileToDataUrl } from '../../features/oculotrack/file';
import { PackageBadge, PhotoButton, QrScanner, StageBadge, Timeline } from '../../features/oculotrack/ui';
import { AnomalyForm, ChecksList } from '../optique/oculotrack/modals';
import { Logo } from '../../components/Logo';
import { formatDate, formatDateTime } from '../../lib/format';
import { tr } from '../../lib/tr';

/* ------------------------------------------------------------------ */
/* Session                                                             */
/* ------------------------------------------------------------------ */

function useBootPortal() {
  const status = usePortal((s) => s.status);
  useEffect(() => {
    if (status === 'loading') void refreshPortal().then((ok) => { if (!ok) usePortal.getState().clear(); });
  }, [status]);
  return status;
}

function Splash() {
  return (
    <div className="grid min-h-screen place-items-center bg-bg">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

function AuthCard({ children, title, subtitle }: { children: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-4">
      <div className="w-full max-w-sm space-y-5">
        <div className="flex items-center justify-center gap-2">
          <Logo />
        </div>
        <div className="card space-y-4 p-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-primary">OculoTrack · {tr('pt.portal')}</p>
            <h1 className="font-display text-xl font-bold text-content">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-content-muted">{subtitle}</p>}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

export function PortalLogin() {
  const status = useBootPortal();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [params] = useSearchParams();
  if (status === 'loading') return <Splash />;
  if (status === 'ready') return <Navigate to={params.get('next') ?? '/portail/app'} replace />;
  return (
    <AuthCard title={tr('pt.loginTitle')} subtitle={tr('pt.loginHint')}>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          try {
            const r = await portal.login(email, password);
            usePortal.getState().set(r.accessToken, r.account);
          } catch (err) {
            setError(portalError(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <input className="input h-12" type="email" autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="input h-12" type="password" autoComplete="current-password" placeholder={tr('pt.password')} value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="text-sm text-danger">{error}</p>}
        <button className="btn-primary h-12 w-full rounded-xl text-base" disabled={busy}>{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : tr('pt.login')}</button>
      </form>
    </AuthCard>
  );
}

export function PortalInvite() {
  const { token = '' } = useParams();
  const nav = useNavigate();
  const { data, error, isLoading } = useQuery({ queryKey: ['pt-invite', token], queryFn: () => portal.invite(token), retry: false });
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  if (isLoading) return <Splash />;
  if (error || !data) return <AuthCard title={tr('pt.inviteInvalid')}><Link to="/portail" className="btn-primary flex h-11 items-center justify-center rounded-xl">{tr('pt.login')}</Link></AuthCard>;
  return (
    <AuthCard title={tr('pt.welcome', { name: data.name })} subtitle={tr('pt.setPassword', { email: data.email })}>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setErr('');
          try {
            const r = await portal.acceptInvite(token, password);
            usePortal.getState().set(r.accessToken, r.account);
            nav('/portail/app', { replace: true });
          } catch (x) {
            setErr(portalError(x));
          } finally {
            setBusy(false);
          }
        }}
      >
        <input className="input h-12" type="password" autoComplete="new-password" minLength={8} placeholder={tr('pt.newPassword')} value={password} onChange={(e) => setPassword(e.target.value)} />
        {err && <p className="text-sm text-danger">{err}</p>}
        <button className="btn-primary h-12 w-full rounded-xl" disabled={busy || password.length < 8}>{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : tr('pt.activate')}</button>
      </form>
    </AuthCard>
  );
}

/* ------------------------------------------------------------------ */
/* Habillage                                                           */
/* ------------------------------------------------------------------ */

export function PortalShell() {
  const status = useBootPortal();
  const account = usePortal((s) => s.account);
  const pending = usePendingCount((s) => s.count);
  const qc = useQueryClient();
  useEffect(() => {
    const go = () => { void flushQueue().then((n) => { if (n) void qc.invalidateQueries(); }); };
    go();
    window.addEventListener('online', go);
    const t = setInterval(go, 30_000);
    return () => { window.removeEventListener('online', go); clearInterval(t); };
  }, [qc]);
  if (status === 'loading') return <Splash />;
  if (status !== 'ready' || !account) return <Navigate to={`/portail?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  const carrier = account.kind === 'CARRIER';
  const tabs = [
    { to: '/portail/app', icon: Home, label: tr('pt.home'), end: true },
    { to: '/portail/app/commandes', icon: Boxes, label: carrier ? tr('pt.packages') : tr('pt.orders'), hide: carrier },
    { to: '/portail/app/scan', icon: ScanLine, label: tr('pt.scan'), big: true },
    { to: '/portail/app/colis', icon: Package, label: tr('pt.packages') },
  ].filter((t) => !t.hide);
  return (
    <div className="min-h-screen bg-bg pb-24">
      <header className="sticky top-0 z-20 border-b bg-surface/95 backdrop-blur" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-white">{carrier ? <Truck className="h-5 w-5" /> : <Wrench className="h-5 w-5" />}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-content">{account.scopes[0]?.supplierName ?? account.name}</p>
            <p className="truncate text-[11px] text-content-muted">OculoTrack · {account.name} · {tr('pt.stores', { n: account.scopes.length })}</p>
          </div>
          <button
            type="button"
            className="btn-ghost h-9 w-9 rounded-lg p-0"
            aria-label={tr('pt.logout')}
            onClick={async () => { await portal.logout().catch(() => undefined); usePortal.getState().clear(); }}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
        {pending > 0 && (
          <p className="flex items-center justify-center gap-2 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
            <CloudOff className="h-3.5 w-3.5" /> {tr('pt.pending', { n: pending })}
          </p>
        )}
      </header>
      <main className="mx-auto max-w-3xl space-y-4 p-4">
        <Outlet />
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t bg-surface/95 backdrop-blur" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="mx-auto flex max-w-3xl items-end justify-around px-2 pt-1.5">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) => `flex flex-1 flex-col items-center gap-0.5 pb-1.5 text-[11px] font-medium ${isActive ? 'text-primary' : 'text-content-muted'}`}
            >
              {t.big ? (
                <span className="-mt-6 grid h-14 w-14 place-items-center rounded-2xl bg-primary text-white shadow-card-lg"><t.icon className="h-6 w-6" /></span>
              ) : (
                <t.icon className="h-5 w-5" />
              )}
              {t.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Accueil                                                             */
/* ------------------------------------------------------------------ */

export function PortalHome() {
  const account = usePortal((s) => s.account)!;
  const { data } = useQuery({ queryKey: ['pt', 'dash'], queryFn: portal.dashboard, refetchInterval: 60_000 });
  const c = data?.counts ?? {};
  const cards = account.kind === 'CARRIER'
    ? [
        { key: 'toPickup', icon: Package, tone: 'bg-amber-500/14 text-amber-600', to: '/portail/app/colis?filter=pickup' },
        { key: 'inTransit', icon: Truck, tone: 'bg-sky-500/12 text-sky-600', to: '/portail/app/colis?filter=transit' },
        { key: 'delivered', icon: CheckCircle2, tone: 'bg-emerald-500/12 text-emerald-600', to: '/portail/app/colis' },
      ]
    : [
        { key: 'toReceive', icon: PackageCheck, tone: 'bg-sky-500/12 text-sky-600', to: '/portail/app/colis?filter=incoming' },
        { key: 'processing', icon: Wrench, tone: 'bg-violet-500/12 text-violet-600', to: '/portail/app/commandes?filter=processing' },
        { key: 'waiting', icon: Timer, tone: 'bg-amber-500/14 text-amber-600', to: '/portail/app/commandes?filter=waiting' },
        { key: 'ready', icon: RotateCcw, tone: 'bg-emerald-500/12 text-emerald-600', to: '/portail/app/retour' },
        { key: 'done', icon: CheckCircle2, tone: 'bg-emerald-500/12 text-emerald-600', to: '/portail/app/commandes?filter=done' },
        { key: 'anomalies', icon: AlertTriangle, tone: 'bg-red-500/12 text-red-600', to: '/portail/app/commandes' },
      ];
  return (
    <>
      <Link to="/portail/app/scan" className="flex items-center gap-4 rounded-3xl bg-gradient-to-br from-primary to-accent p-5 text-white shadow-card-lg">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/20"><ScanLine className="h-7 w-7" /></span>
        <span className="min-w-0">
          <span className="block font-display text-lg font-bold">{tr('pt.scanCta')}</span>
          <span className="block text-sm text-white/85">{tr(account.kind === 'CARRIER' ? 'pt.scanCtaCarrier' : 'pt.scanCtaHint')}</span>
        </span>
      </Link>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {cards.map((x) => (
          <Link key={x.key} to={x.to} className={`card p-4 transition hover:-translate-y-0.5 ${x.key === 'anomalies' && (c.anomalies ?? 0) > 0 ? 'ring-1 ring-red-500/40' : ''}`}>
            <span className={`grid h-9 w-9 place-items-center rounded-xl ${x.tone}`}><x.icon className="h-4.5 w-4.5" /></span>
            <p className="mt-3 font-display text-3xl font-bold text-content">{data ? c[x.key] ?? 0 : '…'}</p>
            <p className="text-sm text-content-muted">{tr(`pt.k.${x.key}`)}</p>
          </Link>
        ))}
      </div>
      {account.kind === 'SUPPLIER' && (c.ready ?? 0) > 0 && (
        <Link to="/portail/app/retour" className="btn-primary flex h-12 items-center justify-center gap-2 rounded-xl">
          <Send className="h-4 w-4" /> {tr('pt.shipBack', { n: c.ready })}
        </Link>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Listes                                                              */
/* ------------------------------------------------------------------ */

const FILTERS = ['incoming', 'processing', 'waiting', 'ready', 'done'] as const;

export function PortalOrders() {
  const [params, setParams] = useSearchParams();
  const filter = params.get('filter') ?? '';
  const [q, setQ] = useState('');
  const { data, isLoading } = useQuery({ queryKey: ['pt', 'orders', filter, q], queryFn: () => portal.orders(filter || undefined, q || undefined) });
  return (
    <>
      <h1 className="font-display text-xl font-bold text-content">{tr('pt.orders')}</h1>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {['', ...FILTERS].map((f) => (
          <button key={f} type="button" onClick={() => setParams(f ? { filter: f } : {})} className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${filter === f ? 'bg-primary text-white' : 'bg-surface-2 text-content-muted'}`}>
            {tr(`pt.f.${f || 'all'}`)}
          </button>
        ))}
      </div>
      <input className="input h-11" placeholder={tr('pt.searchOrders')} value={q} onChange={(e) => setQ(e.target.value)} />
      {isLoading ? <Loader2 className="mx-auto h-6 w-6 animate-spin text-content-faint" /> : !data?.length ? (
        <p className="card p-6 text-center text-sm text-content-muted">{tr('pt.noOrders')}</p>
      ) : (
        <ul className="space-y-2">
          {data.map((o) => (
            <li key={o.id}>
              <Link to={`/portail/app/commande/${o.id}`} className="card flex items-center gap-3 p-3.5">
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-sm font-bold text-content">{o.trackCode} {o.openAnomalies > 0 && <span className="text-red-500">⚠</span>}</p>
                  <p className="truncate text-xs text-content-muted">{o.store} · {o.client ?? '—'} · {o.frameRef ?? o.description}</p>
                  {o.expectedAt && <p className="text-[11px] text-content-faint">{tr('pt.dueBy', { date: formatDate(o.expectedAt) })}</p>}
                </div>
                <StageBadge stage={o.trackStage} issue={o.openAnomalies > 0} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export function PortalPackages() {
  const [params] = useSearchParams();
  const filter = params.get('filter') ?? undefined;
  const { data, isLoading } = useQuery({ queryKey: ['pt', 'packages', filter], queryFn: () => portal.packages(filter) });
  return (
    <>
      <h1 className="font-display text-xl font-bold text-content">{tr('pt.packages')}</h1>
      {isLoading ? <Loader2 className="mx-auto h-6 w-6 animate-spin text-content-faint" /> : !data?.length ? (
        <p className="card p-6 text-center text-sm text-content-muted">{tr('pt.noPackages')}</p>
      ) : (
        <ul className="space-y-2">
          {data.map((p) => (
            <li key={p.id}>
              <Link to={`/portail/app/colis/${p.id}`} className="card flex items-center gap-3 p-3.5">
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${p.direction === 'RETURN' ? 'bg-emerald-500/12 text-emerald-600' : 'bg-sky-500/12 text-sky-600'}`}><Package className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-sm font-bold text-content">{p.number}</p>
                  <p className="flex items-center gap-1 truncate text-xs text-content-muted">{p.fromCity || p.store} <ArrowRight className="h-3 w-3" /> {p.toCity || '—'} · {tr('ot.ordersCount', { n: p._count.items })}</p>
                </div>
                <PackageBadge status={p.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Preuves : photo, signature, position                                */
/* ------------------------------------------------------------------ */

function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [has, setHas] = useState(false);
  const pos = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * ref.current!.width, y: ((e.clientY - r.top) / r.height) * ref.current!.height };
  };
  return (
    <div>
      <canvas
        ref={ref}
        width={600}
        height={200}
        className="h-28 w-full touch-none rounded-xl border bg-white"
        onPointerDown={(e) => { drawing.current = true; const p = pos(e); const c = ref.current!.getContext('2d')!; c.lineWidth = 3; c.lineCap = 'round'; c.strokeStyle = '#111'; c.beginPath(); c.moveTo(p.x, p.y); }}
        onPointerMove={(e) => { if (!drawing.current) return; const p = pos(e); const c = ref.current!.getContext('2d')!; c.lineTo(p.x, p.y); c.stroke(); }}
        onPointerUp={() => { drawing.current = false; setHas(true); onChange(ref.current!.toDataURL('image/png')); }}
      />
      {has && (
        <button type="button" className="mt-1 text-xs text-content-muted" onClick={() => { ref.current!.getContext('2d')!.clearRect(0, 0, 600, 200); setHas(false); onChange(null); }}>
          <Eraser className="mr-1 inline h-3.5 w-3.5" />{tr('pt.clearSignature')}
        </button>
      )}
    </div>
  );
}

function getPosition(): Promise<{ lat: number; lng: number; accuracy: number } | undefined> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(undefined);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy) }),
      () => resolve(undefined),
      { timeout: 8000, maximumAge: 60_000 },
    );
  });
}

function useProof() {
  const [photo, setPhoto] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [gps, setGps] = useState(false);
  const build = async () => ({
    ...(photo ? { photo } : {}),
    ...(signature ? { signature } : {}),
    ...(gps ? { gps: await getPosition() } : {}),
  });
  const ui = (opts: { signature?: boolean } = {}) => (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <PhotoButton label={photo ? tr('ot.photoOk') : tr('ot.photoOptional')} onPhoto={async (f) => setPhoto(await trackFileToDataUrl(f))} />
        {photo && <img src={photo} alt="" className="h-12 w-12 rounded-lg object-cover" />}
      </div>
      {opts.signature && (
        <div>
          <p className="mb-1 text-xs font-medium text-content-muted">{tr('pt.signature')}</p>
          <SignaturePad onChange={setSignature} />
        </div>
      )}
      <label className="flex items-center gap-2 text-sm text-content-muted">
        <input type="checkbox" checked={gps} onChange={(e) => setGps(e.target.checked)} />
        <MapPin className="h-4 w-4" /> {tr('pt.shareGps')}
      </label>
    </div>
  );
  return { build, ui };
}

/* ------------------------------------------------------------------ */
/* Scan et colis                                                       */
/* ------------------------------------------------------------------ */

export function PortalScan() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [error, setError] = useState('');
  const onResult = useCallback(
    async (token: string) => {
      try {
        const d = await portal.scan(token);
        nav(`/portail/app/colis/${d.package.id}?scanned=1`, { replace: true });
      } catch (e) {
        setError(portalError(e));
      }
    },
    [nav],
  );
  useEffect(() => {
    const t = params.get('token');
    if (t) void onResult(t);
  }, [params, onResult]);
  if (error) {
    return (
      <div className="card space-y-4 p-6 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-red-500" />
        <p className="font-semibold text-content">{error}</p>
        <button type="button" className="btn-primary h-11 w-full rounded-xl" onClick={() => setError('')}>{tr('pt.scanAgain')}</button>
      </div>
    );
  }
  return <QrScanner title={tr('pt.scanTitle')} onResult={onResult} onClose={() => nav('/portail/app')} />;
}

type Checks = { received: boolean; reference: boolean; quantity: boolean; condition: boolean };

export function PortalPackage() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const account = usePortal((s) => s.account)!;
  const qc = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['pt', 'package', id], queryFn: () => portal.package(id) });
  const [checks, setChecks] = useState<Record<string, Checks>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [anomaly, setAnomaly] = useState(false);
  const [checkpoint, setCheckpoint] = useState('');
  const proof = useProof();
  useEffect(() => {
    if (data) setChecks(Object.fromEntries(data.package.items.map((i) => [i.lensOrderId, { received: true, reference: true, quantity: true, condition: true }])));
  }, [data]);

  if (isLoading) return <Loader2 className="mx-auto h-6 w-6 animate-spin text-content-faint" />;
  if (error || !data) return <p className="card p-6 text-center text-sm text-danger">{portalError(error)}</p>;
  const p = data.package;
  const supplier = account.kind === 'SUPPLIER';
  const canReceive = supplier && p.direction === 'OUTBOUND' && ['HANDED_TO_CARRIER', 'IN_TRANSIT', 'PREPARING'].includes(p.status);
  const canPickup = !supplier && ['PREPARING', 'HANDED_TO_CARRIER'].includes(p.status);
  const inTransit = !supplier && p.status === 'IN_TRANSIT';

  async function act(path: string, body: Record<string, unknown>, label: string) {
    setBusy(true);
    try {
      const r = await sendAction(path, { ...(await proof.build()), ...body }, label);
      setDone(r.queued ? tr('pt.savedOffline') : tr('pt.saved'));
      qc.invalidateQueries({ queryKey: ['pt'] });
      if (!r.queued) void refetch();
    } catch (e) {
      alert(portalError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Link to="/portail/app/colis" className="inline-flex items-center gap-1 text-sm text-content-muted"><ArrowLeft className="h-4 w-4" /> {tr('pt.packages')}</Link>
      <section className="card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xl font-bold text-content">{p.number}</span>
          <PackageBadge status={p.status} />
        </div>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-content-muted">
          {p.store} · {p.fromCity || '—'} <ArrowRight className="h-3.5 w-3.5" /> {p.toCity || '—'}
        </p>
        {(p.carrierName || p.externalTracking) && <p className="text-xs text-content-faint">{p.carrierName} {p.externalTracking ? `· ${p.externalTracking}` : ''}</p>}
        {p.expectedAt && <p className="text-xs text-content-faint">{tr('ot.expected', { date: formatDate(p.expectedAt) })}</p>}
      </section>

      {done && (
        <p className="flex items-center gap-2 rounded-2xl bg-emerald-500/12 p-4 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-5 w-5" /> {done}
        </p>
      )}

      {canReceive && !done && (
        <section className="card space-y-4 p-4">
          <div>
            <p className="font-display text-lg font-bold text-content">{params.get('scanned') ? tr('pt.confirmQuestion') : tr('pt.receiveTitle')}</p>
            <p className="text-sm text-content-muted">{tr('pt.receiveHint', { n: p.items.length })}</p>
          </div>
          <ChecksList items={p.items.map((i) => ({ id: i.lensOrderId, code: i.lensOrder.trackCode, sub: i.lensOrder.frameRef ?? i.lensOrder.frameProduct?.name }))} checks={checks} setChecks={setChecks} />
          {proof.ui({ signature: true })}
          <button type="button" disabled={busy} onClick={() => act(`/packages/${p.id}/receive`, { checks }, `${tr('pt.reception')} ${p.number}`)} className="btn-primary flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-bold">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ClipboardCheck className="h-5 w-5" />} {tr('pt.confirmReception')}
          </button>
          <button type="button" onClick={() => setAnomaly(true)} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-red-500/50 text-sm font-bold text-red-600">
            <AlertTriangle className="h-4 w-4" /> {tr('pt.reportProblem')}
          </button>
        </section>
      )}

      {canPickup && !done && (
        <section className="card space-y-3 p-4">
          <p className="font-display text-lg font-bold text-content">{tr('pt.pickupTitle')}</p>
          {proof.ui()}
          <button type="button" disabled={busy} onClick={() => act(`/packages/${p.id}/pickup`, {}, `${tr('pt.pickup')} ${p.number}`)} className="btn-primary flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-bold">
            <Truck className="h-5 w-5" /> {tr('pt.confirmPickup')}
          </button>
        </section>
      )}

      {inTransit && !done && (
        <section className="card space-y-3 p-4">
          <p className="font-display text-lg font-bold text-content">{tr('pt.inTransitTitle')}</p>
          <div className="flex gap-2">
            <input className="input h-11 min-w-0 flex-1" placeholder={tr('pt.checkpointPh')} value={checkpoint} onChange={(e) => setCheckpoint(e.target.value)} />
            <button type="button" disabled={busy || checkpoint.trim().length < 2} className="btn-outline h-11 rounded-xl px-3 text-sm" onClick={() => act(`/packages/${p.id}/checkpoint`, { message: checkpoint.trim() }, checkpoint)}>
              <MapPin className="h-4 w-4" /> {tr('pt.addCheckpoint')}
            </button>
          </div>
          {proof.ui({ signature: true })}
          <button type="button" disabled={busy} onClick={() => act(`/packages/${p.id}/deliver`, {}, `${tr('pt.delivered')} ${p.number}`)} className="btn-primary flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-bold">
            <PackageCheck className="h-5 w-5" /> {p.direction === 'RETURN' ? tr('pt.deliveredStore') : tr('pt.deliveredLab')}
          </button>
        </section>
      )}

      <section className="card p-4">
        <p className="mb-2 text-sm font-bold text-content">{tr('ot.content')}</p>
        <ul className="divide-y">
          {p.items.map((i) => (
            <li key={i.lensOrderId} className="flex items-center gap-2 py-2.5">
              {supplier ? (
                <Link to={`/portail/app/commande/${i.lensOrderId}`} className="font-mono text-sm font-bold text-primary">{i.lensOrder.trackCode}</Link>
              ) : (
                <span className="font-mono text-sm font-bold text-content">{i.lensOrder.trackCode}</span>
              )}
              <span className="min-w-0 flex-1 truncate text-xs text-content-muted">{i.lensOrder.frameRef ?? i.lensOrder.description}</span>
              <StageBadge stage={i.lensOrder.trackStage} />
            </li>
          ))}
        </ul>
      </section>

      <section className="card p-4">
        <p className="mb-3 text-sm font-bold text-content">{tr('ot.timeline')}</p>
        <Timeline events={data.events} />
      </section>

      {anomaly && (
        <BottomSheet title={tr('pt.reportProblem')} onClose={() => setAnomaly(false)}>
          <AnomalyForm
            busy={busy}
            onSubmit={async (v) => {
              await act('/anomalies', { ...v, packageId: p.id }, tr('ot.reportAnomaly'));
              setAnomaly(false);
            }}
          />
        </BottomSheet>
      )}
    </>
  );
}

function BottomSheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-surface p-5 sm:rounded-3xl" style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }} onClick={(e) => e.stopPropagation()}>
        <p className="mb-4 font-display text-lg font-bold text-content">{title}</p>
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Commande (laboratoire)                                              */
/* ------------------------------------------------------------------ */

const fmtRx = (v: unknown) => (v == null || v === '' ? '—' : typeof v === 'number' ? (v > 0 ? `+${v.toFixed(2)}` : v.toFixed(2)) : String(v));

export function PortalOrder() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['pt', 'order', id], queryFn: () => portal.order(id) });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [anomaly, setAnomaly] = useState(false);
  const [preview, setPreview] = useState<{ data: string; mime: string } | null>(null);

  if (isLoading) return <Loader2 className="mx-auto h-6 w-6 animate-spin text-content-faint" />;
  if (error || !data) return <p className="card p-6 text-center text-sm text-danger">{portalError(error)}</p>;
  const o = data.order;
  const st = o.trackStage;
  const rank = trackStageRank(st);
  const canWork = rank >= trackStageRank('RECEIVED_BY_LAB') && rank < trackStageRank('RETURN_HANDED');
  const rx = o.lensConfig?.prescription;
  const og = rx?.sameForBoth ? rx.od : rx?.og;
  const m = data.measurement;

  async function stage(s: TrackStage, photo?: string) {
    setBusy(true);
    try {
      const r = await sendAction('/orders/stage', { lensOrderIds: [id], stage: s, ...(photo ? { photo } : {}) }, `${o.trackCode} → ${tr(`ot.stage.${s}`)}`);
      setMsg(r.queued ? tr('pt.savedOffline') : tr('pt.saved'));
      qc.invalidateQueries({ queryKey: ['pt'] });
      if (!r.queued) void refetch();
    } catch (e) {
      alert(portalError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Link to="/portail/app/commandes" className="inline-flex items-center gap-1 text-sm text-content-muted"><ArrowLeft className="h-4 w-4" /> {tr('pt.orders')}</Link>
      <section className="card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xl font-bold text-content">{o.trackCode}</span>
          <StageBadge stage={st} issue={o.openAnomalies > 0} />
        </div>
        <p className="mt-1 text-sm text-content-muted">{o.store} · {tr('pt.client')} {o.client ?? '—'} · {o.number}</p>
        {o.expectedAt && <p className="text-xs text-content-faint">{tr('pt.dueBy', { date: formatDate(o.expectedAt) })}</p>}
      </section>

      {msg && <p className="flex items-center gap-2 rounded-2xl bg-emerald-500/12 p-3 text-sm font-semibold text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-4 w-4" /> {msg}</p>}

      {canWork && (
        <section className="card space-y-3 p-4">
          <p className="text-sm font-bold text-content">{tr('pt.updateStage')}</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {LAB_SETTABLE_STAGES.map((s) => {
              const current = s === st;
              const past = trackStageRank(s) < rank;
              return (
                <button
                  key={s}
                  type="button"
                  disabled={busy || current}
                  onClick={() => stage(s)}
                  className={`flex h-12 items-center gap-2 rounded-xl border px-3 text-left text-sm font-semibold transition ${current ? 'border-primary bg-primary text-white' : past ? 'text-content-faint' : 'hover:border-primary'}`}
                >
                  {current ? <CheckCircle2 className="h-4 w-4" /> : <span className={`h-2.5 w-2.5 rounded-full ${past ? 'bg-emerald-500' : 'bg-line'}`} />}
                  {tr(`ot.stage.${s}`)}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            <PhotoButton label={tr('pt.mountPhoto')} busy={busy} onPhoto={async (f) => stage(rank < trackStageRank('MOUNTED') ? 'MOUNTED' : st, await trackFileToDataUrl(f))} />
            <button type="button" onClick={() => setAnomaly(true)} className="flex h-10 items-center gap-2 rounded-xl border border-red-500/50 px-3 text-sm font-semibold text-red-600">
              <AlertTriangle className="h-4 w-4" /> {tr('ot.reportAnomaly')}
            </button>
          </div>
          {st === 'READY_FOR_RETURN' && (
            <Link to="/portail/app/retour" className="btn-primary flex h-12 items-center justify-center gap-2 rounded-xl"><Send className="h-4 w-4" /> {tr('pt.shipToStore')}</Link>
          )}
        </section>
      )}

      <section className="card p-4">
        <p className="mb-2 text-sm font-bold text-content">{tr('pt.job')}</p>
        <dl className="space-y-1 text-sm">
          {[
            [tr('ot.f.frame'), o.frameProduct ? `${o.frameProduct.brand ? `${o.frameProduct.brand} · ` : ''}${o.frameProduct.name}` : '—'],
            [tr('ot.f.frameRef'), o.frameRef || '—'],
            [tr('ot.f.lenses'), [o.lensConfig?.lensType, o.lensConfig?.index && `${tr('ot.f.index')} ${o.lensConfig.index}`, o.lensConfig?.material].filter(Boolean).join(' · ') || o.description],
            [tr('ot.f.treatments'), o.lensConfig?.treatments?.map((k) => LENS_TREATMENTS.find((t) => t.key === k)?.label ?? k).join(', ') || '—'],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3"><dt className="text-content-muted">{k}</dt><dd className="text-right font-medium text-content">{v}</dd></div>
          ))}
        </dl>
        {rx && (
          <table className="mt-3 w-full text-center text-sm">
            <thead><tr className="text-[11px] uppercase text-content-faint"><th /><th>Sph</th><th>Cyl</th><th>{tr('ot.f.axis')}</th><th>Add</th><th>{tr('ot.f.prism')}</th></tr></thead>
            <tbody className="font-mono">
              {([['OD', rx.od], ['OG', og]] as const).map(([eye, e]) => (
                <tr key={eye} className="border-t">
                  <td className="py-1.5 text-left font-sans font-bold">{eye}</td>
                  <td>{fmtRx(e?.sphere)}</td><td>{fmtRx(e?.cylinder)}</td><td>{e?.axis != null ? `${e.axis}°` : '—'}</td><td>{fmtRx(e?.addition)}</td><td>{e?.prism != null ? `${e.prism} ${e.prismBase ?? ''}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {(o.odLens || o.ogLens) && <p className="mt-2 text-xs text-content-muted">OD : {o.odLens ?? '—'} · OG : {o.ogLens ?? '—'}</p>}
        {m && (
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs sm:grid-cols-4">
            {([['EP', m.pdTotal], ['½ OD', m.odMonoPd], ['½ OG', m.ogMonoPd], ['H OD', m.odHeight], ['H OG', m.ogHeight], ['A', m.lensWidth], ['B', m.lensHeight], ['DBL', m.bridge], [tr('ot.f.vertex'), m.vertex], [tr('ot.f.panto'), m.pantoTilt], [tr('ot.f.wrap'), m.wrapAngle]] as const)
              .filter(([, v]) => v != null)
              .map(([k, v]) => (
                <div key={k} className="rounded-lg bg-surface-2/60 px-2 py-1.5"><p className="text-content-faint">{k}</p><p className="font-mono font-semibold text-content">{String(v).replace('.', ',')}</p></div>
              ))}
          </div>
        )}
        {o.notes && <p className="mt-3 rounded-lg bg-surface-2/60 p-2 text-xs text-content-muted">{o.notes}</p>}
      </section>

      {o.trackAttachments.length > 0 && (
        <section className="card p-4">
          <p className="mb-2 text-sm font-bold text-content">{tr('ot.sec.files')}</p>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {o.trackAttachments.map((a) => (
              <li key={a.id}>
                <button type="button" className="flex w-full items-center gap-2 rounded-xl border p-2.5 text-left" onClick={async () => { try { setPreview(await portal.attachment(a.id)); } catch (e) { alert(portalError(e)); } }}>
                  {a.mime.startsWith('image/') ? <Camera className="h-5 w-5 text-primary" /> : <FileText className="h-5 w-5 text-primary" />}
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-content">{tr(`ot.att.${a.kind}`)}</span><span className="block text-[11px] text-content-faint">{formatDateTime(a.createdAt)}</span></span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {o.trackAnomalies.length > 0 && (
        <section className="card p-4">
          <p className="mb-2 text-sm font-bold text-content">{tr('ot.tab.anomalies')}</p>
          <ul className="space-y-2">
            {o.trackAnomalies.map((a) => (
              <li key={a.id} className={`rounded-xl border p-3 text-sm ${a.status === 'OPEN' ? 'border-red-500/40 bg-red-500/5' : 'opacity-60'}`}>
                <p className="font-semibold text-content">{tr(`ot.an.${a.type}`)}</p>
                {a.comment && <p className="text-content-muted">{a.comment}</p>}
                <p className="text-xs text-content-faint">{a.reportedByName} · {formatDateTime(a.createdAt)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card p-4">
        <p className="mb-3 text-sm font-bold text-content">{tr('ot.timeline')}</p>
        <Timeline events={data.events} />
      </section>

      {anomaly && (
        <BottomSheet title={tr('ot.reportAnomaly')} onClose={() => setAnomaly(false)}>
          <AnomalyForm
            busy={busy}
            onSubmit={async (v: { type: TrackAnomalyType; comment: string; photo?: string }) => {
              setBusy(true);
              try {
                const r = await sendAction('/anomalies', { ...v, lensOrderId: id }, tr('ot.reportAnomaly'));
                setMsg(r.queued ? tr('pt.savedOffline') : tr('pt.anomalySent'));
                setAnomaly(false);
                void refetch();
              } catch (e) {
                alert(portalError(e));
              } finally {
                setBusy(false);
              }
            }}
          />
        </BottomSheet>
      )}
      {preview && (
        <div className="fixed inset-0 z-[80] flex flex-col bg-black/90" onClick={() => setPreview(null)}>
          {preview.mime === 'application/pdf' ? <iframe title="pdf" src={preview.data} className="m-3 min-h-0 flex-1 bg-white" /> : <img src={preview.data} alt="" className="m-auto max-h-full max-w-full object-contain p-3" />}
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Retour vers le magasin                                              */
/* ------------------------------------------------------------------ */

export function PortalReturn() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['pt', 'orders', 'ready'], queryFn: () => portal.orders('ready') });
  const stores = useMemo(() => [...new Set((data ?? []).map((o) => o.tenantId))], [data]);
  const [store, setStore] = useState('');
  useEffect(() => { if (!store && stores[0]) setStore(stores[0]); }, [stores, store]);
  const orders = (data ?? []).filter((o) => o.tenantId === store);
  const [sel, setSel] = useState<Set<string>>(new Set());
  useEffect(() => setSel(new Set(orders.map((o) => o.id))), [store, data]); // eslint-disable-line react-hooks/exhaustive-deps
  const [carrierName, setCarrierName] = useState('');
  const [externalTracking, setExternalTracking] = useState('');
  const [expectedAt, setExpectedAt] = useState(new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const proof = useProof();
  return (
    <>
      <h1 className="font-display text-xl font-bold text-content">{tr('pt.shipToStore')}</h1>
      {!data?.length ? (
        <p className="card p-6 text-center text-sm text-content-muted">{tr('pt.noneReady')}</p>
      ) : (
        <section className="card space-y-3 p-4">
          {stores.length > 1 && (
            <select className="input h-11" value={store} onChange={(e) => setStore(e.target.value)}>
              {stores.map((s) => <option key={s} value={s}>{data.find((o) => o.tenantId === s)?.store}</option>)}
            </select>
          )}
          <ul className="divide-y rounded-xl border">
            {orders.map((o) => (
              <li key={o.id}>
                <label className="flex items-center gap-3 px-3 py-2.5">
                  <input type="checkbox" checked={sel.has(o.id)} onChange={(e) => setSel((s) => { const n = new Set(s); e.target.checked ? n.add(o.id) : n.delete(o.id); return n; })} />
                  <span className="font-mono text-sm font-bold">{o.trackCode}</span>
                  <span className="truncate text-xs text-content-muted">{o.frameRef ?? o.description}</span>
                </label>
              </li>
            ))}
          </ul>
          <input className="input h-11" placeholder={tr('ot.f.carrier')} value={carrierName} onChange={(e) => setCarrierName(e.target.value)} />
          <input className="input h-11" placeholder={tr('ot.f.tracking')} value={externalTracking} onChange={(e) => setExternalTracking(e.target.value)} />
          <label className="block text-xs text-content-muted">{tr('pt.expectedStore')}<input className="input mt-1 h-11" type="date" value={expectedAt} onChange={(e) => setExpectedAt(e.target.value)} /></label>
          <input className="input h-11" placeholder={tr('ot.f.comment')} value={note} onChange={(e) => setNote(e.target.value)} />
          {proof.ui()}
          <button
            type="button"
            disabled={busy || sel.size === 0}
            className="btn-primary flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-bold"
            onClick={async () => {
              setBusy(true);
              try {
                const r = await sendAction('/returns', { lensOrderIds: [...sel], carrierName, externalTracking, expectedAt, note, ...(await proof.build()) }, tr('pt.shipToStore'));
                qc.invalidateQueries({ queryKey: ['pt'] });
                alert(r.queued ? tr('pt.savedOffline') : tr('pt.returnSent'));
                nav('/portail/app');
              } catch (e) {
                alert(portalError(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Truck className="h-5 w-5" />} {tr('pt.confirmShip', { n: sel.size })}
          </button>
        </section>
      )}
    </>
  );
}
