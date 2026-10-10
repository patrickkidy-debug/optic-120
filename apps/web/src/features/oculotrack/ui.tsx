import { useEffect, useRef, useState } from 'react';
import {
  TRACK_STAGES,
  TRACK_STAGE_LOCATION,
  TRACK_STAGE_TONE,
  trackStageRank,
  type TrackStage,
  type TrackTone,
} from '@oculo/shared-types';
import {
  AlertTriangle,
  Building2,
  Camera,
  Check,
  CheckCircle2,
  CircleDot,
  Factory,
  FileText,
  Loader2,
  MapPin,
  Package,
  QrCode,
  Store,
  Truck,
  User,
  Wrench,
  X,
} from 'lucide-react';
import QRCode from 'qrcode';
import { tr } from '../../lib/tr';
import { formatDateTime } from '../../lib/format';
import type { TrackEvent } from './api';

/* --------------------------------- Couleurs -------------------------------- */

export const TONE_CLASS: Record<TrackTone, string> = {
  done: 'bg-emerald-500/12 text-emerald-600 ring-emerald-500/30 dark:text-emerald-300',
  progress: 'bg-sky-500/12 text-sky-600 ring-sky-500/30 dark:text-sky-300',
  waiting: 'bg-amber-500/14 text-amber-700 ring-amber-500/30 dark:text-amber-300',
  issue: 'bg-red-500/12 text-red-600 ring-red-500/30 dark:text-red-300',
  cancelled: 'bg-zinc-500/15 text-zinc-600 ring-zinc-500/30 dark:text-zinc-300',
};
export const TONE_DOT: Record<TrackTone, string> = {
  done: 'bg-emerald-500',
  progress: 'bg-sky-500',
  waiting: 'bg-amber-500',
  issue: 'bg-red-500',
  cancelled: 'bg-zinc-500',
};

export const stageLabel = (s?: string | null) => (s ? tr(`ot.stage.${s}`) : '—');

export function StageBadge({ stage, issue, className = '' }: { stage: TrackStage | null | undefined; issue?: boolean; className?: string }) {
  const tone: TrackTone = issue ? 'issue' : stage ? TRACK_STAGE_TONE[stage] : 'waiting';
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${TONE_CLASS[tone]} ${className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${TONE_DOT[tone]}`} />
      {stageLabel(stage)}
    </span>
  );
}

const PKG_TONE: Record<string, TrackTone> = { PREPARING: 'waiting', HANDED_TO_CARRIER: 'progress', IN_TRANSIT: 'progress', RECEIVED: 'done', CANCELLED: 'cancelled' };
export function PackageBadge({ status, late }: { status: string; late?: number }) {
  const tone: TrackTone = late ? 'issue' : PKG_TONE[status] ?? 'waiting';
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${TONE_CLASS[tone]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${TONE_DOT[tone]}`} />
      {late ? tr('ot.lateDays', { n: late }) : tr(`ot.pkg.${status}`)}
    </span>
  );
}

/** Progression 0-1 d'une commande dans les 17 étapes. */
export function stageProgress(stage?: TrackStage | null) {
  if (!stage || stage === 'CANCELLED') return 0;
  return (trackStageRank(stage) + 1) / (TRACK_STAGES.length - 1);
}

/* ------------------------- Où est la monture ? ------------------------- */

const JOURNEY = [
  { key: 'STORE', icon: Store },
  { key: 'TO_LAB', icon: Truck },
  { key: 'LAB', icon: Factory },
  { key: 'TO_STORE', icon: Truck },
  { key: 'BACK', icon: CheckCircle2 },
] as const;

/**
 * Parcours physique de la monture : Magasin → Transport → Laboratoire →
 * Transport retour → Retour magasin, avec la position actuelle.
 */
export function Journey({ stage, from, to }: { stage: TrackStage | null | undefined; from?: string | null; to?: string | null }) {
  const s = (stage ?? 'CREATED') as TrackStage;
  const loc = TRACK_STAGE_LOCATION[s];
  const rank = trackStageRank(s);
  const back = rank >= trackStageRank('ARRIVED_AT_STORE');
  const current = back ? 4 : loc === 'STORE' ? 0 : loc === 'TO_LAB' ? 1 : loc === 'LAB' ? 2 : loc === 'TO_STORE' ? 3 : 4;
  const labels = [from || tr('ot.loc.store'), tr('ot.loc.transit'), to || tr('ot.loc.lab'), tr('ot.loc.return'), tr('ot.loc.back')];
  return (
    <div className="flex items-start">
      {JOURNEY.map((j, i) => {
        const Icon = j.icon;
        const done = i < current || (i === 4 && s === 'COMPLETED');
        const here = i === current && s !== 'CANCELLED';
        return (
          <div key={j.key} className="flex min-w-0 flex-1 flex-col items-center">
            <div className="flex w-full items-center">
              <span className={`h-0.5 flex-1 ${i === 0 ? 'invisible' : i <= current ? 'bg-primary' : 'bg-line'}`} />
              <span
                className={`relative grid h-9 w-9 shrink-0 place-items-center rounded-full ${
                  here ? 'bg-primary text-white shadow-[0_0_0_5px_rgba(124,58,237,.18)]' : done ? 'bg-primary/15 text-primary' : 'bg-surface-2 text-content-faint'
                }`}
              >
                <Icon className="h-4 w-4" />
                {here && <span className="absolute -inset-1 animate-ping rounded-full bg-primary/20" />}
              </span>
              <span className={`h-0.5 flex-1 ${i === 4 ? 'invisible' : i < current ? 'bg-primary' : 'bg-line'}`} />
            </div>
            <span className={`mt-1.5 line-clamp-2 px-0.5 text-center text-[10px] leading-tight ${here ? 'font-bold text-primary' : 'text-content-muted'}`}>{labels[i]}</span>
          </div>
        );
      })}
    </div>
  );
}

/* --------------------------------- Timeline --------------------------------- */

const ACTOR_ICON = { STAFF: Store, SUPPLIER: Factory, CARRIER: Truck, SYSTEM: CircleDot } as const;

function eventIcon(e: TrackEvent) {
  if (e.type.startsWith('ANOMALY')) return AlertTriangle;
  if (e.type === 'LATE_DETECTED') return AlertTriangle;
  if (e.type.startsWith('PACKAGE') || e.type.startsWith('CARRIER')) return e.type.includes('RECEIVED') ? Package : Truck;
  if (e.stage === 'MOUNTING' || e.stage === 'MOUNTED') return Wrench;
  if (e.type === 'ATTACHMENT_ADDED') return FileText;
  return Check;
}

/** Libellé d'un événement : étape atteinte ou type d'action. */
export function eventLabel(e: TrackEvent) {
  if (e.type === 'STAGE_CHANGED' || e.type === 'ORDER_TRACKING_STARTED') return stageLabel(e.stage);
  return tr(`ot.ev.${e.type}`, { defaultValue: e.type });
}

/**
 * Historique de traçabilité : chaque action, son auteur, son heure et ses
 * preuves (GPS, appareil, contrôles). Rien n'y est jamais effacé.
 */
export function Timeline({ events, pending }: { events: TrackEvent[]; pending?: TrackStage[] }) {
  return (
    <ol className="relative space-y-0">
      {events.map((e, i) => {
        const Icon = eventIcon(e);
        const ActorIcon = ACTOR_ICON[e.actorType] ?? User;
        const bad = e.type.startsWith('ANOMALY_REPORTED') || e.type === 'LATE_DETECTED';
        const gps = (e.meta as { gps?: { lat: number; lng: number } } | null)?.gps;
        return (
          <li key={e.id} className="relative flex gap-3 pb-4">
            {i < events.length - 1 + (pending?.length ? 1 : 0) && <span className="absolute left-[15px] top-8 h-[calc(100%-1.5rem)] w-px bg-line" />}
            <span className={`z-[1] grid h-8 w-8 shrink-0 place-items-center rounded-full ${bad ? 'bg-red-500/15 text-red-500' : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'}`}>
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-sm font-semibold text-content">{eventLabel(e)}</p>
              <p className="text-xs text-content-faint">{formatDateTime(e.occurredAt)}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-content-muted">
                <span className="inline-flex items-center gap-1"><ActorIcon className="h-3 w-3" /> {e.actorName}</span>
                {e.message && <span className="text-content">· {e.message}</span>}
                {gps && (
                  <a className="inline-flex items-center gap-0.5 text-primary hover:underline" href={`https://maps.google.com/?q=${gps.lat},${gps.lng}`} target="_blank" rel="noreferrer">
                    <MapPin className="h-3 w-3" /> GPS
                  </a>
                )}
              </p>
            </div>
          </li>
        );
      })}
      {pending?.map((s, i) => (
        <li key={s} className="relative flex gap-3 pb-4 opacity-60">
          {i < pending.length - 1 && <span className="absolute left-[15px] top-8 h-[calc(100%-1.5rem)] w-px bg-line" />}
          <span className="z-[1] grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-dashed border-line bg-surface" />
          <p className="pt-1.5 text-sm text-content-muted">{stageLabel(s)}</p>
        </li>
      ))}
    </ol>
  );
}

/* ------------------------------ QR code ------------------------------ */

export function QrImage({ value, size = 180, className = '' }: { value: string; size?: number; className?: string }) {
  const [svg, setSvg] = useState('');
  useEffect(() => {
    QRCode.toString(value, { type: 'svg', errorCorrectionLevel: 'M', margin: 1, width: size }).then(setSvg).catch(() => setSvg(''));
  }, [value, size]);
  return <div className={`rounded-xl bg-white p-2 [&_svg]:h-auto [&_svg]:w-full ${className}`} style={{ width: size }} dangerouslySetInnerHTML={{ __html: svg }} />;
}

export async function qrDataUrl(value: string, size = 360) {
  return QRCode.toDataURL(value, { errorCorrectionLevel: 'M', margin: 1, width: size });
}

/* ------------------------------ Scanner QR ------------------------------ */

/** Extrait le jeton d'un QR OculoTrack (URL « …/s/<jeton> » ou jeton seul). */
export function tokenFromQr(text: string): string | null {
  const m = /\/s\/([A-Za-z0-9_-]{20,64})/.exec(text) ?? /^([A-Za-z0-9_-]{20,64})$/.exec(text.trim());
  return m ? m[1]! : null;
}

/**
 * Scanner plein écran : BarcodeDetector natif quand le navigateur l'a (Chrome
 * Android), sinon décodage jsQR sur les images de la caméra (iPhone, Safari).
 * Saisie manuelle du numéro en dernier recours.
 */
export function QrScanner({ onResult, onClose, title }: { onResult: (token: string) => void; onClose: () => void; title?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');
  const [manual, setManual] = useState('');
  useEffect(() => {
    let stream: MediaStream | null = null;
    let stop = false;
    let raf = 0;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        const v = videoRef.current!;
        v.srcObject = stream;
        await v.play();
        const Detector = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => { detect: (s: CanvasImageSource) => Promise<{ rawValue: string }[]> } }).BarcodeDetector;
        const detector = Detector ? new Detector({ formats: ['qr_code'] }) : null;
        const jsQR = detector ? null : (await import('jsqr')).default;
        const c = document.createElement('canvas');
        const ctx = c.getContext('2d', { willReadFrequently: true })!;
        let last = 0;
        const tick = async (t: number) => {
          if (stop) return;
          raf = requestAnimationFrame(tick);
          if (t - last < 180 || !v.videoWidth) return;
          last = t;
          let text: string | null = null;
          if (detector) {
            const r = await detector.detect(v).catch(() => []);
            text = r[0]?.rawValue ?? null;
          } else if (jsQR) {
            const k = Math.min(1, 720 / v.videoWidth);
            c.width = Math.round(v.videoWidth * k);
            c.height = Math.round(v.videoHeight * k);
            ctx.drawImage(v, 0, 0, c.width, c.height);
            const img = ctx.getImageData(0, 0, c.width, c.height);
            text = jsQR(img.data, img.width, img.height)?.data ?? null;
          }
          const token = text ? tokenFromQr(text) : null;
          if (token) {
            stop = true;
            navigator.vibrate?.(60);
            onResult(token);
          }
        };
        raf = requestAnimationFrame(tick);
      } catch {
        setError(tr('ot.scanCameraError'));
      }
    })();
    return () => {
      stop = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onResult]);

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black text-white">
      <div className="flex items-center gap-3 p-3" style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}>
        <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-white/10" aria-label={tr('ot.close')}>
          <X className="h-5 w-5" />
        </button>
        <p className="font-semibold">{title ?? tr('ot.scanTitle')}</p>
      </div>
      <div className="relative min-h-0 flex-1">
        {error ? (
          <p className="p-6 text-center text-sm text-white/80">{error}</p>
        ) : (
          <>
            <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="relative h-64 w-64 max-w-[75vw] rounded-3xl border-2 border-white/80 shadow-[0_0_0_100vmax_rgba(0,0,0,.45)]">
                <span className="absolute inset-x-6 top-1/2 h-0.5 animate-pulse bg-emerald-400" />
              </div>
            </div>
            <p className="absolute inset-x-0 bottom-6 text-center text-sm text-white/85">
              <QrCode className="mr-1 inline h-4 w-4" /> {tr('ot.scanHint')}
            </p>
          </>
        )}
      </div>
      <form
        className="flex gap-2 p-3"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
        onSubmit={(e) => {
          e.preventDefault();
          const t = tokenFromQr(manual);
          if (t) onResult(t);
        }}
      >
        <input className="h-11 min-w-0 flex-1 rounded-xl border border-white/20 bg-white/10 px-3 text-sm text-white placeholder:text-white/50" placeholder={tr('ot.scanManual')} value={manual} onChange={(e) => setManual(e.target.value)} />
        <button type="submit" className="rounded-xl bg-white px-4 text-sm font-semibold text-black">OK</button>
      </form>
    </div>
  );
}

/* ------------------------------ Photo rapide ------------------------------ */

/** Bouton « Prendre une photo » (appareil photo du téléphone) qui rend une data URL réduite. */
export function PhotoButton({ onPhoto, label, busy, className = '' }: { onPhoto: (file: File) => void; label: string; busy?: boolean; className?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" onClick={() => ref.current?.click()} className={`btn-outline h-10 rounded-xl px-3 text-sm ${className}`} disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />} {label}
      </button>
      <input ref={ref} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onPhoto(f); e.target.value = ''; }} />
    </>
  );
}

export const ActorIcons = { Store, Factory, Truck, Building2 };
