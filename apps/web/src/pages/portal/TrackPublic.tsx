import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { CheckCircle2, Factory, Loader2, Package, ShieldCheck, Store, Truck, Wrench } from 'lucide-react';
import { trackStageRank, type TrackStage } from '@oculo/shared-types';
import { API_URL } from '../../lib/api';
import { useAuthStore } from '../../store/auth';
import { ot } from '../../features/oculotrack/api';
import { refreshPortal } from '../../features/oculotrack/portal';
import { StageBadge, PackageBadge } from '../../features/oculotrack/ui';
import { Logo } from '../../components/Logo';
import { formatDate, formatDateTime } from '../../lib/format';
import { tr } from '../../lib/tr';

interface PublicOrder {
  kind: 'order';
  code: string;
  stage: TrackStage;
  store: string;
  lab: string;
  expectedAt: string | null;
  updatedAt: string;
  steps: { stage: TrackStage; occurredAt: string }[];
}
interface PublicPackage {
  kind: 'package';
  code: string;
  status: string;
  direction: string;
  store: string;
  items: number;
  expectedAt: string | null;
  updatedAt: string;
}

/** Étapes simplifiées montrées au client final. */
const MILESTONES: { at: TrackStage; icon: typeof Store; key: string }[] = [
  { at: 'CREATED', icon: Store, key: 'created' },
  { at: 'HANDED_TO_CARRIER', icon: Truck, key: 'sent' },
  { at: 'RECEIVED_BY_LAB', icon: Factory, key: 'atLab' },
  { at: 'MOUNTING', icon: Wrench, key: 'mounting' },
  { at: 'RETURN_HANDED', icon: Truck, key: 'returning' },
  { at: 'ARRIVED_AT_STORE', icon: CheckCircle2, key: 'ready' },
];

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg px-4 py-8">
      <div className="mx-auto max-w-md space-y-5">
        <div className="flex justify-center"><Logo /></div>
        {children}
        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-content-faint">
          <ShieldCheck className="h-3.5 w-3.5" /> {tr('pub.privacy')}
        </p>
      </div>
    </div>
  );
}

export function TrackPublicPage() {
  const { token = '' } = useParams();
  const [data, setData] = useState<PublicOrder | PublicPackage | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    axios.get(`${API_URL}/public/track/${encodeURIComponent(token)}`).then((r) => setData(r.data)).catch(() => setError(true));
  }, [token]);
  if (error) return <Shell><p className="card p-6 text-center text-sm text-content-muted">{tr('pub.invalid')}</p></Shell>;
  if (!data) return <Shell><Loader2 className="mx-auto h-7 w-7 animate-spin text-primary" /></Shell>;
  return <Shell><PublicCard data={data} /></Shell>;
}

function PublicCard({ data }: { data: PublicOrder | PublicPackage }) {
  if (data.kind === 'package') {
    return (
      <div className="card space-y-3 p-6 text-center">
        <Package className="mx-auto h-10 w-10 text-primary" />
        <p className="font-mono text-xl font-bold text-content">{data.code}</p>
        <PackageBadge status={data.status} />
        <p className="text-sm text-content-muted">{data.store} · {tr('ot.ordersCount', { n: data.items })}</p>
        <p className="text-xs text-content-faint">{tr('pub.updated', { date: formatDateTime(data.updatedAt) })}</p>
      </div>
    );
  }
  const rank = trackStageRank(data.stage);
  const timeOf = (s: TrackStage) => data.steps.find((x) => trackStageRank(x.stage) >= trackStageRank(s))?.occurredAt;
  return (
    <div className="card space-y-5 p-6">
      <div className="text-center">
        <p className="text-xs font-bold uppercase tracking-wider text-content-faint">{data.store}</p>
        <p className="mt-1 font-mono text-2xl font-bold text-content">{data.code}</p>
        <div className="mt-2"><StageBadge stage={data.stage} /></div>
        <p className="mt-2 text-sm text-content-muted">{data.lab}</p>
        <p className="text-xs text-content-faint">{tr('pub.updated', { date: formatDateTime(data.updatedAt) })}</p>
        {data.expectedAt && rank < trackStageRank('ARRIVED_AT_STORE') && <p className="mt-1 text-xs font-semibold text-primary">{tr('pub.expected', { date: formatDate(data.expectedAt) })}</p>}
      </div>
      <ol className="space-y-3">
        {MILESTONES.map((m) => {
          const done = rank >= trackStageRank(m.at) && data.stage !== 'CANCELLED';
          const t = done ? timeOf(m.at) : undefined;
          return (
            <li key={m.key} className="flex items-center gap-3">
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${done ? 'bg-emerald-500/15 text-emerald-600' : 'bg-surface-2 text-content-faint'}`}><m.icon className="h-4 w-4" /></span>
              <span className="min-w-0 flex-1">
                <span className={`block text-sm font-semibold ${done ? 'text-content' : 'text-content-faint'}`}>{tr(`pub.m.${m.key}`)}</span>
                {t && <span className="block text-xs text-content-faint">{formatDateTime(t)}</span>}
              </span>
              {done && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/**
 * Point d'arrivée du QR collé sur un colis. Selon qui scanne :
 * laboratoire / transporteur connecté → portail ; magasin connecté → fiche
 * colis ; sinon → statut public minimal + connexion.
 */
export function ScanLanding() {
  const { token = '' } = useParams();
  const nav = useNavigate();
  const staff = useAuthStore((s) => s.status);
  const [mode, setMode] = useState<'loading' | 'public'>('loading');
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (await refreshPortal()) {
        if (!cancelled) nav(`/portail/app/scan?token=${encodeURIComponent(token)}`, { replace: true });
        return;
      }
      if (staff === 'authenticated') {
        try {
          const id = await ot.resolveToken(token);
          if (!cancelled) nav(`/optique/oculotrack?package=${id}`, { replace: true });
          return;
        } catch {
          /* colis d'un autre établissement : statut public */
        }
      }
      if (!cancelled) setMode('public');
    })();
    return () => { cancelled = true; };
  }, [token, staff, nav]);
  if (mode === 'loading') return <Shell><Loader2 className="mx-auto h-7 w-7 animate-spin text-primary" /></Shell>;
  return (
    <Shell>
      <TrackPublicInline token={token} />
      <div className="grid grid-cols-1 gap-2">
        <Link to={`/portail?next=${encodeURIComponent(`/portail/app/scan?token=${token}`)}`} className="btn-primary flex h-12 items-center justify-center gap-2 rounded-xl">
          <Factory className="h-4 w-4" /> {tr('pub.iAmLab')}
        </Link>
        <Link to="/login" className="btn-outline flex h-12 items-center justify-center gap-2 rounded-xl">
          <Store className="h-4 w-4" /> {tr('pub.iAmStore')}
        </Link>
      </div>
    </Shell>
  );
}

function TrackPublicInline({ token }: { token: string }) {
  const [data, setData] = useState<PublicOrder | PublicPackage | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    axios.get(`${API_URL}/public/track/${encodeURIComponent(token)}`).then((r) => setData(r.data)).catch(() => setError(true));
  }, [token]);
  if (error) return <p className="card p-6 text-center text-sm text-content-muted">{tr('pub.invalid')}</p>;
  if (!data) return <Loader2 className="mx-auto h-7 w-7 animate-spin text-primary" />;
  return <PublicCard data={data} />;
}
