import { useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { Camera, ChevronDown, CreditCard, FlipHorizontal2, Glasses, Ruler, ScanLine, Sparkles, Upload, Wand2 } from 'lucide-react';
import clsx from 'clsx';
import { shapeStats, type Pt2 } from '@oculo/shared-types';
import { Button } from '../../components/ui';
import { autoTrace, pixelsToRadiiMm, photoPreview, pullContour, toGrayImage, type GrayImage } from '../../features/oculolab/scan';
import { tr } from '../../lib/tr';

const L = (k: string, o?: Record<string, unknown>) => tr(`oculolab.photo.${k}`, o);

/** Carte bancaire / carte d'identité ISO 7810 ID-1 : 85,60 mm de long. */
const CARD_MM = 85.6;

/**
 * Échelle de la photo :
 *  - ENGRAVED (par défaut) : rien à poser, la forme est mise au calibre A gravé ;
 *  - CARD / RULER : mesure exacte, avec un objet de taille connue sur la photo.
 */
type ScaleMode = 'ENGRAVED' | 'CARD' | 'RULER';
/** Ce qui est photographié : le verre / gabarit lui-même, ou le cercle d'une monture vide. */
type Subject = 'LENS' | 'FRAME';

export interface PhotoTraceResult {
  radii: number[];
  confidence: number;
  photoUrl: string;
  /** Pont saisi avec le calibre gravé (null si non saisi). */
  dbl: number | null;
  /** Contour mesuré sur le bord intérieur d'un cercle : il faut ajouter le drageoir. */
  innerRim: boolean;
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
  const [gray, setGray] = useState<GrayImage | null>(null);
  const [error, setError] = useState('');
  const [scaleMode, setScaleMode] = useState<ScaleMode>('ENGRAVED');
  const [showExact, setShowExact] = useState(false);
  const [subject, setSubject] = useState<Subject>('LENS');
  const [engravedA, setEngravedA] = useState<number | ''>('');
  const [engravedDbl, setEngravedDbl] = useState<number | ''>('');
  const [rulerMm, setRulerMm] = useState(50);
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
  const handle = Math.max(w, h) / 70;
  const exact = scaleMode !== 'ENGRAVED';

  /** Pixels par mm de la photo. */
  const pxPerMm = useMemo(() => {
    const d = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    if (scaleMode === 'CARD') return d > 10 ? d / CARD_MM : null;
    if (scaleMode === 'RULER') return d > 10 && rulerMm > 0 ? d / rulerMm : null;
    if (radiiPx && engravedA && engravedA >= 25) return shapeStats(radiiPx).a / engravedA;
    return null;
  }, [scaleMode, p1, p2, rulerMm, engravedA, radiiPx]);

  /** Détection sur l'image de travail ; `at` en px de la photo (centre de la photo sinon). */
  function detect(g: GrayImage, at?: Pt2, bg?: 'light' | 'dark') {
    const f = g.factor;
    const res = autoTrace(g, { start: at ? { x: at.x / f, y: at.y / f } : undefined, background: bg });
    setSeed({ x: res.seed.x * f, y: res.seed.y * f });
    setRadiiPx(res.radii.map((r) => r * f));
    setConfidence(res.confidence);
    setBackground(res.background);
  }

  async function pick(file: File | undefined) {
    if (!file) return;
    setError('');
    try {
      const im = await loadPhoto(file);
      const g = toGrayImage(im, im.naturalWidth, im.naturalHeight, 1000);
      setImg(im);
      setGray(g);
      setP1({ x: im.naturalWidth * 0.12, y: im.naturalHeight * 0.9 });
      setP2({ x: im.naturalWidth * 0.48, y: im.naturalHeight * 0.9 });
      // Détection immédiate : aucun clic avant de voir le contour.
      detect(g);
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

  function polar(p: Pt2, s: Pt2) {
    const ang = ((Math.atan2(-(p.y - s.y), p.x - s.x) * 180) / Math.PI + 360) % 360;
    return { ang, dist: Math.hypot(p.x - s.x, p.y - s.y) };
  }

  function onPointerDown(e: RPointerEvent<SVGSVGElement>) {
    const p = toImage(e);
    if (exact) {
      const d1 = Math.hypot(p.x - p1.x, p.y - p1.y), d2 = Math.hypot(p.x - p2.x, p.y - p2.y);
      if (Math.min(d1, d2) < handle * 3) {
        drag.current = d1 < d2 ? 'p1' : 'p2';
        capture(e.pointerId);
        return;
      }
    }
    if (!gray) return;
    if (!seed || !radiiPx) {
      detect(gray, p);
      return;
    }
    const { ang, dist } = polar(p, seed);
    const edge = radiiPx[Math.round(ang) % radiiPx.length]!;
    // Toucher loin du trait (au cœur du verre, ou bien hors de lui) : nouvelle
    // détection depuis ce point. Près du trait : on le fait glisser.
    if (dist < edge * 0.55 || dist > edge * 1.6) {
      detect(gray, p, background);
      return;
    }
    drag.current = 'contour';
    capture(e.pointerId);
    pull(p);
  }

  function pull(p: Pt2) {
    if (!seed || !radiiPx) return;
    const { ang, dist } = polar(p, seed);
    setRadiiPx(pullContour(radiiPx, ang, dist));
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
      dbl: !exact && engravedDbl && engravedDbl >= 8 ? engravedDbl : null,
      // Le calibre gravé est déjà la cote du verre : pas de drageoir à ajouter.
      innerRim: exact && subject === 'FRAME',
    });
  }

  if (!img) {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { icon: Glasses, title: L('tip1Title'), text: L('tip1') },
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
  const st = pxPerMm && radiiPx ? shapeStats(radiiPx) : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div>
        <div className="relative overflow-hidden rounded-2xl border bg-black">
          <img src={img.src} alt="" className="block w-full select-none" draggable={false} />
          <svg
            ref={svgRef}
            viewBox={`0 0 ${w} ${h}`}
            className="absolute inset-0 h-full w-full cursor-pointer touch-none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={() => (drag.current = null)}
            onPointerCancel={() => (drag.current = null)}
          >
            {contourPath && <path d={contourPath} fill="rgba(236,72,153,0.15)" stroke="#ec4899" strokeWidth={handle / 4} />}
            {seed && (
              <g stroke="#22c55e" strokeWidth={handle / 4}>
                <line x1={seed.x - handle} y1={seed.y} x2={seed.x + handle} y2={seed.y} />
                <line x1={seed.x} y1={seed.y - handle} x2={seed.x} y2={seed.y + handle} />
              </g>
            )}
            {exact && (
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
          </svg>
        </div>
        <p className="mt-2 text-xs text-content-muted">{L('adjustHelp')}</p>
      </div>

      <div className="space-y-3">
        <div className="rounded-xl border bg-surface-2 p-3 text-sm">
          <p className="font-semibold text-content">{L('detected')}</p>
          <p className={clsx('text-xs', confidence >= 75 ? 'text-success' : confidence >= 60 ? 'text-warning' : 'text-danger')}>
            {L('confidence', { n: confidence })}
          </p>
          {confidence < 60 && <p className="mt-1 text-xs text-content-muted">{L('lowHint')}</p>}
          {st && pxPerMm && (
            <p className="mt-1 text-xs text-content-muted">
              A {(st.a / pxPerMm).toFixed(1)} × B {(st.b / pxPerMm).toFixed(1)} mm
            </p>
          )}
        </div>

        {!exact && (
          <div className="rounded-xl border p-3">
            <p className="text-sm font-semibold text-content">{L('engravedTitle')}</p>
            <p className="mb-2 text-xs text-content-muted">{L('engravedHint')}</p>
            <div className="flex items-end gap-2">
              <label className="block w-24 text-xs">
                <span className="text-content-faint">{L('engravedA')}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={25}
                  max={80}
                  step={0.5}
                  placeholder="52"
                  className="input mt-1 h-11 text-center font-semibold"
                  value={engravedA}
                  onChange={(e) => setEngravedA(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </label>
              <span className="pb-2.5 text-lg text-content-faint">□</span>
              <label className="block w-24 text-xs">
                <span className="text-content-faint">{L('engravedDbl')}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={8}
                  max={35}
                  step={0.5}
                  placeholder="18"
                  className="input mt-1 h-11 text-center font-semibold"
                  value={engravedDbl}
                  onChange={(e) => setEngravedDbl(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </label>
            </div>
          </div>
        )}

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

        <Button className="w-full" onClick={finish} disabled={!pxPerMm || !radiiPx}>
          {L('useShape')}
        </Button>

        <button
          type="button"
          onClick={() => setShowExact((v) => !v)}
          className="flex w-full items-center justify-between rounded-xl px-1 py-1 text-xs font-semibold text-content-muted hover:text-content"
        >
          {L('more')}
          <ChevronDown className={clsx('h-4 w-4 transition', showExact && 'rotate-180')} />
        </button>
        {showExact && (
          <div className="space-y-3 rounded-xl border bg-surface-2 p-3">
            <div>
              <p className="mb-1.5 text-xs font-semibold text-content">{L('scaleTitle')}</p>
              <div className="grid gap-1.5">
                {(
                  [
                    ['ENGRAVED', ScanLine, L('calEngraved')],
                    ['CARD', CreditCard, L('calCard')],
                    ['RULER', Ruler, L('calRuler')],
                  ] as const
                ).map(([m, Icon, label]) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setScaleMode(m)}
                    className={clsx(
                      'flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition',
                      scaleMode === m ? 'border-primary bg-primary-soft font-semibold text-content' : 'text-content-muted hover:text-content',
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" /> {label}
                  </button>
                ))}
              </div>
              {scaleMode === 'CARD' && <p className="mt-1.5 text-xs text-content-faint">{L('calCardHint')}</p>}
              {scaleMode === 'RULER' && (
                <label className="mt-1.5 block text-xs">
                  <span className="text-content-muted">{L('rulerLength')}</span>
                  <input type="number" min={5} step={0.5} className="input mt-1" value={rulerMm} onChange={(e) => setRulerMm(Number(e.target.value))} />
                </label>
              )}
              {exact && pxPerMm && <p className="mt-1 text-xs text-content-faint">{L('scale', { v: pxPerMm.toFixed(1) })}</p>}
            </div>
            {exact && (
              <div>
                <p className="mb-1.5 text-xs font-semibold text-content">{L('subjectTitle')}</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {(['LENS', 'FRAME'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSubject(s)}
                      className={clsx('rounded-xl border px-2 py-2 text-xs', subject === s ? 'border-primary bg-primary-soft font-semibold' : 'text-content-muted')}
                    >
                      {L(s === 'LENS' ? 'subjectLens' : 'subjectFrame')}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={() => setFlipped((f) => !f)}
              className={clsx('flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-xs', flipped ? 'border-primary bg-primary-soft font-semibold' : 'text-content-muted')}
            >
              <FlipHorizontal2 className="h-4 w-4" /> {L('flipped')}
            </button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => gray && detect(gray, seed ?? undefined, background === 'light' ? 'dark' : 'light')}
            >
              <Wand2 className="h-4 w-4" /> {L(background === 'light' ? 'tryDark' : 'tryLight')}
            </Button>
          </div>
        )}
        <label className="block cursor-pointer text-center text-xs text-content-faint underline">
          {L('otherPhoto')}
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} />
        </label>
      </div>
    </div>
  );
}
