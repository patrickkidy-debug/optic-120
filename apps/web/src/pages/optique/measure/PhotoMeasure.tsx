import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, ImagePlus, RotateCcw, SkipForward, Undo2, Video, X, CheckCircle2, Info } from 'lucide-react';
import { ID1_CARD_WIDTH_MM } from '@oculo/shared-types';
import { computeMeasures, type MeasureValues, type PointKey, type Pt } from '../../../features/optique/measurements';
import { NumberInput } from '../../../components/NumberInput';
import { Button } from '../../../components/ui';
import { tr } from '../../../lib/tr';

type RefMode = 'card' | 'frame';

interface Step {
  key: PointKey;
  required: boolean;
  color: string;
}

/** Ordre de pose des repères. Les facultatifs peuvent être passés. */
const STEPS: Step[] = [
  { key: 'refL', required: true, color: '#f59e0b' },
  { key: 'refR', required: true, color: '#f59e0b' },
  { key: 'pupilR', required: true, color: '#22c55e' },
  { key: 'pupilL', required: true, color: '#22c55e' },
  { key: 'nose', required: false, color: '#3b82f6' },
  { key: 'bottomR', required: false, color: '#ec4899' },
  { key: 'bottomL', required: false, color: '#ec4899' },
  { key: 'topR', required: false, color: '#a855f7' },
  { key: 'nasalR', required: false, color: '#06b6d4' },
  { key: 'templeR', required: false, color: '#06b6d4' },
  { key: 'nasalL', required: false, color: '#06b6d4' },
];

const LOUPE = 132; // px
const ZOOM = 3;

/**
 * Mesure sur photo : le client porte la monture, une carte au format bancaire
 * est posée à plat sur le haut de la monture (ou on connaît la largeur totale
 * de la monture). On pose les repères au doigt ou à la souris, une loupe
 * permet de viser précisément, et chaque repère se déplace après coup.
 */
export function PhotoMeasure({ onUse }: { onUse: (v: MeasureValues, method: 'PHOTO_CARD' | 'PHOTO_FRAME') => void }) {
  const [src, setSrc] = useState<string | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [points, setPoints] = useState<Partial<Record<PointKey, Pt>>>({});
  const [skipped, setSkipped] = useState<Set<PointKey>>(new Set());
  const [mode, setMode] = useState<RefMode>('card');
  const [frameWidth, setFrameWidth] = useState(138);
  const [drag, setDrag] = useState<PointKey | null>(null);
  const [loupe, setLoupe] = useState<{ p: Pt; side: 'left' | 'right' } | null>(null);
  const [camera, setCamera] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const takeRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => { if (src) URL.revokeObjectURL(src); }, [src]);

  const current = STEPS.find((s) => !points[s.key] && !skipped.has(s.key)) ?? null;
  const refMm = mode === 'card' ? ID1_CARD_WIDTH_MM : frameWidth;
  const values = useMemo(() => computeMeasures(points, refMm), [points, refMm]);
  const ready = values.pdTotal != null;

  function loadFile(f?: File | null) {
    if (!f) return;
    reset();
    setSrc(URL.createObjectURL(f));
  }
  function reset() {
    setPoints({});
    setSkipped(new Set());
    setSize(null);
  }

  function toImage(e: { clientX: number; clientY: number }): Pt | null {
    const box = boxRef.current;
    if (!box || !size) return null;
    const r = box.getBoundingClientRect();
    return {
      x: Math.min(size.w, Math.max(0, ((e.clientX - r.left) / r.width) * size.w)),
      y: Math.min(size.h, Math.max(0, ((e.clientY - r.top) / r.height) * size.h)),
    };
  }
  /** Repère existant le plus proche du doigt (rayon de 22 px à l'écran). */
  function hit(e: { clientX: number; clientY: number }): PointKey | null {
    const box = boxRef.current;
    if (!box || !size) return null;
    const r = box.getBoundingClientRect();
    const k = r.width / size.w;
    let best: PointKey | null = null;
    let dmin = 22;
    for (const [key, p] of Object.entries(points) as [PointKey, Pt][]) {
      const d = Math.hypot(r.left + p.x * k - e.clientX, r.top + p.y * k - e.clientY);
      if (d < dmin) { dmin = d; best = key; }
    }
    return best;
  }
  function showLoupe(p: Pt, e: { clientX: number }) {
    const r = boxRef.current!.getBoundingClientRect();
    // Loupe du côté opposé au doigt pour ne jamais être masquée.
    setLoupe({ p, side: e.clientX - r.left < r.width / 2 ? 'right' : 'left' });
  }

  function onDown(e: React.PointerEvent) {
    const p = toImage(e);
    if (!p) return;
    const k = hit(e) ?? current?.key ?? null;
    if (!k) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setDrag(k);
    setPoints((prev) => ({ ...prev, [k]: p }));
    showLoupe(p, e);
  }
  function onMove(e: React.PointerEvent) {
    if (!drag) return;
    const p = toImage(e);
    if (!p) return;
    setPoints((prev) => ({ ...prev, [drag]: p }));
    showLoupe(p, e);
  }
  function onUp() {
    setDrag(null);
    setLoupe(null);
  }
  function undo() {
    const placed = STEPS.filter((s) => points[s.key]);
    const last = placed[placed.length - 1];
    if (!last) return;
    setPoints((prev) => {
      const n = { ...prev };
      delete n[last.key];
      return n;
    });
  }

  const k = size ? Math.max(size.w, size.h) / 260 : 4; // taille des repères en pixels image

  if (!src) {
    return (
      <div className="space-y-4">
        <Guide mode={mode} setMode={setMode} frameWidth={frameWidth} setFrameWidth={setFrameWidth} />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Button className="h-12" onClick={() => takeRef.current?.click()}>
            <Camera className="h-5 w-5" /> {tr('measure.takePhoto')}
          </Button>
          <Button variant="outline" className="h-12" onClick={() => setCamera(true)}>
            <Video className="h-5 w-5" /> {tr('measure.liveCamera')}
          </Button>
          <Button variant="outline" className="h-12" onClick={() => importRef.current?.click()}>
            <ImagePlus className="h-5 w-5" /> {tr('measure.importPhoto')}
          </Button>
        </div>
        <input ref={takeRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => loadFile(e.target.files?.[0])} />
        <input ref={importRef} type="file" accept="image/*" className="hidden" onChange={(e) => loadFile(e.target.files?.[0])} />
        {camera && <LiveCamera onClose={() => setCamera(false)} onShot={(blob) => { setCamera(false); loadFile(new File([blob], 'mesure.jpg', { type: 'image/jpeg' })); }} />}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div ref={areaRef} className="min-w-0 scroll-mt-20 space-y-2">
        {/* Consigne du repère à poser. Hauteur FIXE (2 lignes de texte + une
            ligne de boutons) : la consigne change à chaque repère, l'image ne
            doit jamais bouger sous le doigt. */}
        <div className="rounded-xl border bg-surface-2/60 px-3 py-2">
          <div className="flex h-10 items-center gap-2">
            {current ? (
              <>
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: current.color }} />
                <p className="line-clamp-2 min-w-0 flex-1 text-xs font-medium text-content sm:text-sm">
                  <span className="text-content-faint">{STEPS.indexOf(current) + 1}/{STEPS.length} · </span>
                  {tr(`measure.step.${current.key}${current.key.startsWith('ref') ? (mode === 'card' ? 'Card' : 'Frame') : ''}`)}
                </p>
              </>
            ) : (
              <p className="line-clamp-2 flex-1 text-xs font-medium text-success sm:text-sm">
                <CheckCircle2 className="mr-1 inline h-4 w-4" /> {tr('measure.allPlaced')}
              </p>
            )}
          </div>
          <div className="mt-1 flex h-8 items-center justify-end gap-1">
            {current && !current.required && (
              <button type="button" className="btn-ghost h-8 rounded-lg px-2 text-xs" onClick={() => setSkipped((s) => new Set(s).add(current.key))}>
                <SkipForward className="h-3.5 w-3.5" /> {tr('measure.skip')}
              </button>
            )}
            <button type="button" className="btn-ghost h-8 rounded-lg px-2 text-xs" onClick={undo} disabled={!Object.keys(points).length}>
              <Undo2 className="h-3.5 w-3.5" /> {tr('measure.undo')}
            </button>
            <button type="button" className="btn-ghost h-8 rounded-lg px-2 text-xs" onClick={() => { setSrc(null); reset(); }}>
              <RotateCcw className="h-3.5 w-3.5" /> {tr('measure.newPhoto')}
            </button>
          </div>
        </div>

        <div className="relative mx-auto w-fit max-w-full select-none">
          <div
            ref={boxRef}
            className="relative cursor-crosshair overflow-hidden rounded-xl bg-black"
            style={{ touchAction: 'none' }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          >
            <img
              src={src}
              alt=""
              draggable={false}
              // Photo entière visible sous la consigne, quelle que soit la hauteur d'écran.
              className="block max-h-[calc(100dvh-13rem)] min-h-[240px] w-auto max-w-full"
              onLoad={(e) => {
                setSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight });
                areaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
            />
            {size && (
              <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${size.w} ${size.h}`} preserveAspectRatio="none">
                {points.refL && points.refR && <line x1={points.refL.x} y1={points.refL.y} x2={points.refR.x} y2={points.refR.y} stroke="#f59e0b" strokeWidth={k / 2} strokeDasharray={`${k * 2} ${k}`} />}
                {points.pupilR && points.pupilL && <line x1={points.pupilR.x} y1={points.pupilR.y} x2={points.pupilL.x} y2={points.pupilL.y} stroke="#22c55e" strokeWidth={k / 2} />}
                {STEPS.map((s) => {
                  const p = points[s.key];
                  if (!p) return null;
                  return (
                    <g key={s.key}>
                      <circle cx={p.x} cy={p.y} r={k * 2.4} fill="none" stroke="#fff" strokeWidth={k * 0.9} />
                      <circle cx={p.x} cy={p.y} r={k * 2.4} fill="none" stroke={s.color} strokeWidth={k * 0.5} />
                      <line x1={p.x - k * 3.5} y1={p.y} x2={p.x + k * 3.5} y2={p.y} stroke={s.color} strokeWidth={k * 0.3} />
                      <line x1={p.x} y1={p.y - k * 3.5} x2={p.x} y2={p.y + k * 3.5} stroke={s.color} strokeWidth={k * 0.3} />
                    </g>
                  );
                })}
              </svg>
            )}
          </div>
          {loupe && size && (
            <div
              className="pointer-events-none absolute top-2 z-10 overflow-hidden rounded-full border-4 border-white shadow-card-lg"
              style={{
                width: LOUPE,
                height: LOUPE,
                [loupe.side]: 8,
                backgroundImage: `url(${src})`,
                backgroundRepeat: 'no-repeat',
                ...(() => {
                  const r = boxRef.current!.getBoundingClientRect();
                  const sw = r.width * ZOOM;
                  const sh = r.height * ZOOM;
                  return {
                    backgroundSize: `${sw}px ${sh}px`,
                    backgroundPosition: `${LOUPE / 2 - (loupe.p.x / size.w) * sw}px ${LOUPE / 2 - (loupe.p.y / size.h) * sh}px`,
                  };
                })(),
              }}
            >
              <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-red-500/80" />
              <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-red-500/80" />
            </div>
          )}
        </div>
        <p className="text-center text-xs text-content-faint">{tr('measure.dragHint')}</p>
      </div>

      <div className="space-y-3">
        <Guide mode={mode} setMode={setMode} frameWidth={frameWidth} setFrameWidth={setFrameWidth} compact />
        <div className="rounded-xl border p-3">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-content-faint">{tr('measure.results')}</p>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
            {([
              ['pdTotal', 'measure.f.pdTotal'],
              ['odMonoPd', 'measure.f.odMonoPd'],
              ['ogMonoPd', 'measure.f.ogMonoPd'],
              ['odHeight', 'measure.f.odHeight'],
              ['ogHeight', 'measure.f.ogHeight'],
              ['lensWidth', 'measure.f.lensWidth'],
              ['lensHeight', 'measure.f.lensHeight'],
              ['bridge', 'measure.f.bridge'],
            ] as const).map(([key, label]) => (
              <div key={key} className="min-w-0">
                <dt className="truncate text-[11px] text-content-faint">{tr(label)}</dt>
                <dd className="font-mono font-semibold text-content">{values[key] != null ? `${values[key]} mm` : '—'}</dd>
              </div>
            ))}
          </dl>
          <Button className="mt-3 w-full" disabled={!ready} onClick={() => onUse(values, mode === 'card' ? 'PHOTO_CARD' : 'PHOTO_FRAME')}>
            <CheckCircle2 className="h-4 w-4" /> {tr('measure.useValues')}
          </Button>
        </div>
        <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-content-faint">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {tr('measure.accuracy')}
        </p>
      </div>
    </div>
  );
}

function Guide({
  mode,
  setMode,
  frameWidth,
  setFrameWidth,
  compact,
}: {
  mode: RefMode;
  setMode: (m: RefMode) => void;
  frameWidth: number;
  setFrameWidth: (n: number) => void;
  compact?: boolean;
}) {
  return (
    <div className="rounded-xl border p-3">
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-content-faint">{tr('measure.reference')}</p>
      <div className="inline-flex w-full rounded-lg bg-surface-2 p-1">
        {(['card', 'frame'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition ${mode === m ? 'bg-surface text-content shadow-sm' : 'text-content-muted'}`}
          >
            {tr(m === 'card' ? 'measure.refCard' : 'measure.refFrame')}
          </button>
        ))}
      </div>
      {mode === 'frame' && (
        <label className="mt-2 flex items-center gap-2 text-xs text-content-muted">
          {tr('measure.frameWidth')}
          <NumberInput className="input h-8 w-20 text-right text-sm" value={frameWidth} decimals={1} min={0} max={200} onChange={setFrameWidth} />
          mm
        </label>
      )}
      {!compact && (
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-content-muted">
          <li>{tr(mode === 'card' ? 'measure.howCard1' : 'measure.howFrame1')}</li>
          <li>{tr('measure.how2')}</li>
          <li>{tr('measure.how3')}</li>
          <li>{tr('measure.how4')}</li>
        </ol>
      )}
    </div>
  );
}

/** Caméra en direct (webcam d'ordinateur ou de tablette), avec repères de cadrage. */
function LiveCamera({ onClose, onShot }: { onClose: () => void; onShot: (b: Blob) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');
  const [facing, setFacing] = useState<'user' | 'environment'>('user');

  useEffect(() => {
    let stream: MediaStream | null = null;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch {
        setError(tr('measure.cameraError'));
      }
    })();
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, [facing]);

  function shoot() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext('2d')!.drawImage(v, 0, 0);
    c.toBlob((b) => b && onShot(b), 'image/jpeg', 0.92);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between p-3 text-white">
        <span className="text-sm font-medium">{tr('measure.liveCamera')}</span>
        <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-white/10" aria-label={tr('ui.ui.fermer')}>
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="relative min-h-0 flex-1">
        {error ? (
          <p className="p-6 text-center text-sm text-white">{error}</p>
        ) : (
          <>
            <video ref={videoRef} playsInline muted className="h-full w-full object-contain" />
            {/* Repères : yeux sur la ligne, visage dans l'ovale, de face. */}
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="h-[70%] aspect-[3/4] rounded-[50%] border-2 border-dashed border-white/60" />
              <div className="absolute left-[15%] right-[15%] top-[45%] border-t border-white/50" />
            </div>
          </>
        )}
      </div>
      <div className="flex items-center justify-center gap-6 p-5" style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}>
        <button type="button" onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))} className="rounded-full bg-white/10 px-4 py-2 text-xs text-white">
          {tr('measure.switchCamera')}
        </button>
        <button type="button" onClick={shoot} disabled={!!error} className="h-16 w-16 rounded-full border-4 border-white bg-white/30 disabled:opacity-40" aria-label={tr('measure.capture')} />
        <span className="w-[84px]" />
      </div>
    </div>
  );
}
