import { useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { Camera, Crosshair, CreditCard, FlipHorizontal2, Ruler, ScanLine, Sparkles, Upload, Wand2 } from 'lucide-react';
import clsx from 'clsx';
import { shapeStats, type Pt2 } from '@oculo/shared-types';
import { Button } from '../../components/ui';
import { pixelsToRadiiMm, photoPreview, pullContour, toGrayImage, traceContour, type GrayImage } from '../../features/oculolab/scan';
import { tr } from '../../lib/tr';

const L = (k: string, o?: Record<string, unknown>) => tr(`oculolab.photo.${k}`, o);

/** Carte bancaire / carte d'identité ISO 7810 ID-1 : 85,60 mm de long. */
const CARD_MM = 85.6;

type CalMode = 'CARD' | 'RULER' | 'ENGRAVED';
type Phase = 'calibrate' | 'seed' | 'adjust';

export interface PhotoTraceResult {
  radii: number[];
  confidence: number;
  photoUrl: string;
}

/** Charge une photo en la réduisant (2000 px max) : affichage fluide, même sur téléphone. */
function loadPhoto(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read'));
    reader.onload = () => {
      const raw = new Image();
      raw.onerror = () => reject(new Error('image'));
      raw.onload = () => {
        const f = Math.max(1, Math.max(raw.naturalWidth, raw.naturalHeight) / 2000);
        const c = document.createElement('canvas');
        c.width = Math.round(raw.naturalWidth / f);
        c.height = Math.round(raw.naturalHeight / f);
        c.getContext('2d')!.drawImage(raw, 0, 0, c.width, c.height);
        const img = new Image();
        img.onload = () => resolve(img);
        img.src = c.toDataURL('image/jpeg', 0.9);
      };
      raw.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function PhotoTracer({ onDone }: { onDone: (r: PhotoTraceResult) => void }) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [error, setError] = useState('');
  const [phase, setPhase] = useState<Phase>('calibrate');
  const [calMode, setCalMode] = useState<CalMode>('CARD');
  const [rulerMm, setRulerMm] = useState(50);
  const [engravedA, setEngravedA] = useState(52);
  const [p1, setP1] = useState<Pt2>({ x: 0, y: 0 });
  const [p2, setP2] = useState<Pt2>({ x: 0, y: 0 });
  const [seed, setSeed] = useState<Pt2 | null>(null);
  const [background, setBackground] = useState<'light' | 'dark'>('light');
  const [eye, setEye] = useState<'R' | 'L'>('R');
  const [flipped, setFlipped] = useState(false);
  const [radiiPx, setRadiiPx] = useState<number[] | null>(null);
  const [confidence, setConfidence] = useState(0);
  const drag = useRef<'p1' | 'p2' | 'contour' | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const w = img?.naturalWidth ?? 1, h = img?.naturalHeight ?? 1;
  const gray = useMemo<GrayImage | null>(() => (img ? toGrayImage(img, w, h, 1000) : null), [img, w, h]);
  const handle = Math.max(w, h) / 70;

  /** Pixels par mm de la photo (null tant que le calibre gravé n'est pas appliqué au contour). */
  const pxPerMm = useMemo(() => {
    const d = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    if (calMode === 'CARD') return d > 10 ? d / CARD_MM : null;
    if (calMode === 'RULER') return d > 10 && rulerMm > 0 ? d / rulerMm : null;
    if (radiiPx && engravedA > 0) return shapeStats(radiiPx).a / engravedA;
    return null;
  }, [calMode, p1, p2, rulerMm, engravedA, radiiPx]);

  async function pick(file: File | undefined) {
    if (!file) return;
    setError('');
    try {
      const im = await loadPhoto(file);
      setImg(im);
      setP1({ x: im.naturalWidth * 0.12, y: im.naturalHeight * 0.88 });
      setP2({ x: im.naturalWidth * 0.48, y: im.naturalHeight * 0.88 });
      setSeed(null);
      setRadiiPx(null);
      setPhase('calibrate');
    } catch {
      setError(L('loadError'));
    }
  }

  /** Capture du pointeur : le glissé continue même si le doigt sort de la photo. */
  function capture(pointerId: number) {
    try {
      svgRef.current?.setPointerCapture(pointerId);
    } catch {
      // Pointeur déjà relâché ou non capturable : le glissé fonctionne sans.
    }
  }

  function toImage(e: RPointerEvent): Pt2 {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * w, y: ((e.clientY - r.top) / r.height) * h };
  }

  function detect(at: Pt2) {
    if (!gray) return;
    const f = gray.factor;
    // Rayon cherché : de 6 à 45 mm si l'échelle est connue, sinon une part de la photo.
    const scale = pxPerMm && calMode !== 'ENGRAVED' ? pxPerMm / f : null;
    const minR = scale ? 6 * scale : Math.min(gray.w, gray.h) * 0.03;
    const maxR = scale ? 45 * scale : Math.min(gray.w, gray.h) * 0.48;
    const res = traceContour(gray, { x: at.x / f, y: at.y / f }, { minR, maxR, background });
    setRadiiPx(res.radii.map((r) => r * f));
    setConfidence(res.confidence);
    setPhase('adjust');
  }

  function onPointerDown(e: RPointerEvent<SVGSVGElement>) {
    const p = toImage(e);
    if (phase === 'calibrate' && calMode !== 'ENGRAVED') {
      const d1 = Math.hypot(p.x - p1.x, p.y - p1.y), d2 = Math.hypot(p.x - p2.x, p.y - p2.y);
      if (Math.min(d1, d2) < handle * 3) {
        drag.current = d1 < d2 ? 'p1' : 'p2';
        capture(e.pointerId);
      }
      return;
    }
    if (phase === 'seed') {
      setSeed(p);
      detect(p);
      return;
    }
    if (phase === 'adjust' && seed && radiiPx) {
      drag.current = 'contour';
      capture(e.pointerId);
      pull(p);
    }
  }

  function pull(p: Pt2) {
    if (!seed || !radiiPx) return;
    const ang = (Math.atan2(-(p.y - seed.y), p.x - seed.x) * 180) / Math.PI;
    setRadiiPx(pullContour(radiiPx, (ang + 360) % 360, Math.hypot(p.x - seed.x, p.y - seed.y)));
  }

  function onPointerMove(e: RPointerEvent<SVGSVGElement>) {
    if (!drag.current) return;
    const p = toImage(e);
    if (drag.current === 'p1') setP1(p);
    else if (drag.current === 'p2') setP2(p);
    else pull(p);
  }

  function finish() {
    if (!img || !radiiPx || !pxPerMm) return;
    onDone({
      radii: pixelsToRadiiMm(radiiPx, pxPerMm, (eye === 'L') !== flipped),
      confidence,
      photoUrl: photoPreview(img, w, h),
    });
  }

  if (!img) {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { icon: CreditCard, title: L('tip1Title'), text: L('tip1') },
            { icon: Camera, title: L('tip2Title'), text: L('tip2') },
            { icon: Sparkles, title: L('tip3Title'), text: L('tip3') },
          ].map((t) => (
            <div key={t.title} className="rounded-xl border bg-surface-2 p-3">
              <t.icon className="h-5 w-5 text-primary" />
              <p className="mt-2 text-sm font-semibold text-content">{t.title}</p>
              <p className="mt-1 text-xs text-content-muted">{t.text}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="btn-primary h-11 cursor-pointer rounded-xl px-4 text-sm">
            <Camera className="h-4 w-4" /> {L('takePhoto')}
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} />
          </label>
          <label className="btn-outline h-11 cursor-pointer rounded-xl px-4 text-sm">
            <Upload className="h-4 w-4" /> {L('importPhoto')}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} />
          </label>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    );
  }

  const contourPath =
    seed && radiiPx
      ? radiiPx
          .map((r, i) => {
            const t = (i * Math.PI) / 180;
            return `${i ? 'L' : 'M'}${(seed.x + r * Math.cos(t)).toFixed(1)},${(seed.y - r * Math.sin(t)).toFixed(1)}`;
          })
          .join(' ') + 'Z'
      : null;

  const steps: { key: Phase; label: string }[] = [
    { key: 'calibrate', label: L('stepCalibrate') },
    { key: 'seed', label: L('stepSeed') },
    { key: 'adjust', label: L('stepAdjust') },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <div>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {steps.map((s, i) => (
            <span
              key={s.key}
              className={clsx(
                'rounded-full px-3 py-1 text-xs font-semibold',
                phase === s.key ? 'bg-brand text-white' : 'bg-surface-2 text-content-muted',
              )}
            >
              {i + 1}. {s.label}
            </span>
          ))}
        </div>
        <div className="relative overflow-hidden rounded-2xl border bg-black">
          <img src={img.src} alt="" className="block w-full select-none" draggable={false} />
          <svg
            ref={svgRef}
            viewBox={`0 0 ${w} ${h}`}
            className={clsx('absolute inset-0 h-full w-full touch-none', phase === 'seed' ? 'cursor-crosshair' : 'cursor-pointer')}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={() => (drag.current = null)}
            onPointerCancel={() => (drag.current = null)}
          >
            {phase === 'calibrate' && calMode !== 'ENGRAVED' && (
              <g>
                <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#f97316" strokeWidth={handle / 4} />
                {[p1, p2].map((p, i) => (
                  <g key={i}>
                    <circle cx={p.x} cy={p.y} r={handle} fill="rgba(249,115,22,0.25)" stroke="#f97316" strokeWidth={handle / 5} />
                    <circle cx={p.x} cy={p.y} r={handle / 5} fill="#f97316" />
                  </g>
                ))}
              </g>
            )}
            {contourPath && <path d={contourPath} fill="rgba(236,72,153,0.15)" stroke="#ec4899" strokeWidth={handle / 4} />}
            {seed && (
              <g stroke="#22c55e" strokeWidth={handle / 4}>
                <line x1={seed.x - handle} y1={seed.y} x2={seed.x + handle} y2={seed.y} />
                <line x1={seed.x} y1={seed.y - handle} x2={seed.x} y2={seed.y + handle} />
              </g>
            )}
          </svg>
        </div>
      </div>

      <div className="space-y-3">
        {phase === 'calibrate' && (
          <>
            <p className="text-sm text-content-muted">{L('calibrateHelp')}</p>
            <div className="grid gap-1.5">
              {(
                [
                  ['CARD', CreditCard, L('calCard')],
                  ['RULER', Ruler, L('calRuler')],
                  ['ENGRAVED', ScanLine, L('calEngraved')],
                ] as const
              ).map(([m, Icon, label]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setCalMode(m)}
                  className={clsx(
                    'flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition',
                    calMode === m ? 'border-primary bg-primary-soft font-semibold text-content' : 'text-content-muted hover:text-content',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" /> {label}
                </button>
              ))}
            </div>
            {calMode === 'CARD' && <p className="text-xs text-content-faint">{L('calCardHint')}</p>}
            {calMode === 'RULER' && (
              <label className="block text-sm">
                <span className="text-content-muted">{L('rulerLength')}</span>
                <input type="number" min={5} step={0.5} className="input mt-1" value={rulerMm} onChange={(e) => setRulerMm(Number(e.target.value))} />
              </label>
            )}
            {calMode === 'ENGRAVED' && (
              <label className="block text-sm">
                <span className="text-content-muted">{L('engravedA')}</span>
                <input type="number" min={30} max={80} step={0.5} className="input mt-1" value={engravedA} onChange={(e) => setEngravedA(Number(e.target.value))} />
                <span className="mt-1 block text-xs text-content-faint">{L('engravedHint')}</span>
              </label>
            )}
            {pxPerMm && calMode !== 'ENGRAVED' && (
              <p className="text-xs text-content-faint">{L('scale', { v: pxPerMm.toFixed(1) })}</p>
            )}
            <Button className="w-full" onClick={() => setPhase('seed')} disabled={calMode !== 'ENGRAVED' && !pxPerMm}>
              <Crosshair className="h-4 w-4" /> {L('next')}
            </Button>
          </>
        )}

        {phase === 'seed' && (
          <>
            <p className="text-sm text-content-muted">{L('seedHelp')}</p>
            <div className="grid grid-cols-2 gap-1.5">
              {(['light', 'dark'] as const).map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setBackground(b)}
                  className={clsx('rounded-xl border px-3 py-2 text-sm', background === b ? 'border-primary bg-primary-soft font-semibold' : 'text-content-muted')}
                >
                  {L(b === 'light' ? 'bgLight' : 'bgDark')}
                </button>
              ))}
            </div>
            <Button variant="ghost" className="w-full" onClick={() => setPhase('calibrate')}>{L('back')}</Button>
          </>
        )}

        {phase === 'adjust' && (
          <>
            <div className="rounded-xl border bg-surface-2 p-3 text-sm">
              <p className="font-semibold text-content">{L('detected')}</p>
              <p className={clsx('text-xs', confidence >= 75 ? 'text-success' : confidence >= 60 ? 'text-warning' : 'text-danger')}>
                {L('confidence', { n: confidence })}
              </p>
              {pxPerMm && radiiPx && (
                <p className="mt-1 text-xs text-content-muted">
                  A {(shapeStats(radiiPx).a / pxPerMm).toFixed(1)} × B {(shapeStats(radiiPx).b / pxPerMm).toFixed(1)} mm
                </p>
              )}
            </div>
            <p className="text-xs text-content-muted">{L('adjustHelp')}</p>
            <div className="grid grid-cols-2 gap-1.5">
              {(['R', 'L'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setEye(s)}
                  className={clsx('rounded-xl border px-3 py-2 text-sm', eye === s ? 'border-primary bg-primary-soft font-semibold' : 'text-content-muted')}
                >
                  {L(s === 'R' ? 'eyeR' : 'eyeL')}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setFlipped((f) => !f)}
              className={clsx('flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-sm', flipped ? 'border-primary bg-primary-soft font-semibold' : 'text-content-muted')}
            >
              <FlipHorizontal2 className="h-4 w-4" /> {L('flipped')}
            </button>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => seed && detect(seed)}>
                <Wand2 className="h-4 w-4" /> {L('redetect')}
              </Button>
              <Button variant="ghost" onClick={() => { setRadiiPx(null); setSeed(null); setPhase('seed'); }}>
                {L('newCenter')}
              </Button>
            </div>
            <Button className="w-full" onClick={finish} disabled={!pxPerMm}>
              {L('useShape')}
            </Button>
          </>
        )}
        <label className="block cursor-pointer text-center text-xs text-content-faint underline">
          {L('otherPhoto')}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} />
        </label>
      </div>
    </div>
  );
}
