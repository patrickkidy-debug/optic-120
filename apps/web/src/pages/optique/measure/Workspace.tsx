import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CreditCard,
  Crosshair,
  Loader2,
  Maximize2,
  Minus,
  Plus,
  Ruler,
  Save,
  ScanFace,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { ID1_CARD_WIDTH_MM, type MeasurementCalibration } from '@oculo/shared-types';
import { detectImage } from '../../../features/optique/measure/landmarker';
import {
  allKeys,
  analyzeFace,
  axes,

  computeValues,
  defaultRims,
  FACE_KEYS,
  IRIS_MM,
  lensBox,
  refKeys,
  reliability,
  RIM_KEYS,
  scaleOf,
  type Calibration,
  type CaptureContext,
  type MarkerKey,
  type Markers,
  type Pt,
  type ValueKey,
  type Values,
} from '../../../features/optique/measure/geometry';
import { brightness, detectCard, detectRims, sharpness, toGray } from '../../../features/optique/measure/vision';
import { createMeasurement, updateMeasurement, type Measurement } from '../../../features/optique/measurements';
import { NumberInput } from '../../../components/NumberInput';
import { apiErrorMessage } from '../../../lib/api';
import { displayLocale } from '../../../lib/format';
import { tr } from '../../../lib/tr';

/** Contenu enregistré dans `markers` (version 1). */
export interface SavedMarkers {
  v: 1;
  w: number;
  h: number;
  points: Markers;
  auto: Markers;
  verified: MarkerKey[];
  calibration: Calibration;
  ctx: CaptureContext;
}

export interface WorkspaceExisting {
  id: string;
  photoUrl: string;
  saved: SavedMarkers;
  params: { vertex: number | null; pantoTilt: number | null; wrapAngle: number | null; nearPd: number | null };
  frameLabel: string | null;
  notes: string | null;
}

/** Ordre du mode « Vérifier les repères ». */
const REVIEW_ORDER: MarkerKey[] = ['pupilR', 'pupilL', 'bridge', 'rBottom', 'lBottom', 'rTop', 'lTop', 'rNasal', 'lNasal', 'rTemple', 'lTemple'];

const COLORS = {
  pupil: '#22c55e',
  bridge: '#3b82f6',
  rim: '#06b6d4',
  ref: '#f59e0b',
  verified: '#a855f7',
  weak: '#f97316',
};

const nf = () => new Intl.NumberFormat(displayLocale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function markerColor(k: MarkerKey) {
  if (k === 'pupilR' || k === 'pupilL') return COLORS.pupil;
  if (k === 'bridge') return COLORS.bridge;
  if ((RIM_KEYS as readonly string[]).includes(k)) return COLORS.rim;
  return COLORS.ref;
}

export function Workspace({
  photo,
  existing,
  customerId,
  customerName,
  onClose,
  onSaved,
}: {
  photo: HTMLCanvasElement | null;
  existing?: WorkspaceExisting | null;
  customerId: string | null;
  customerName?: string | null;
  onClose: () => void;
  onSaved: (m: Measurement) => void;
}) {
  const [src, setSrc] = useState<string>(() => existing?.photoUrl ?? photo!.toDataURL('image/jpeg', 0.86));
  const [size, setSize] = useState<{ w: number; h: number }>(() =>
    existing ? { w: existing.saved.w, h: existing.saved.h } : { w: photo!.width, h: photo!.height },
  );
  const [phase, setPhase] = useState<'analyzing' | 'calibrate' | 'measure'>(existing ? 'measure' : 'analyzing');
  const [markers, setMarkers] = useState<Markers>(existing?.saved.points ?? {});
  const [auto, setAuto] = useState<Markers>(existing?.saved.auto ?? {});
  const [verified, setVerified] = useState<Set<MarkerKey>>(new Set(existing?.saved.verified ?? []));
  const [cal, setCal] = useState<Calibration>(existing?.saved.calibration ?? { mode: 'CARD', mm: ID1_CARD_WIDTH_MM });
  const [ctx, setCtx] = useState<CaptureContext>(
    existing?.saved.ctx ?? { face: null, refConf: 0, rimConf: {}, brightness: 128, sharpness: 50 },
  );
  const [frameMm, setFrameMm] = useState(existing?.saved.calibration.mode === 'FRAME' ? existing.saved.calibration.mm : 0);
  const [refMm, setRefMm] = useState(existing?.saved.calibration.mode === 'REFERENCE' ? existing.saved.calibration.mm : 0);
  const [engineOff, setEngineOff] = useState(false);
  const [params, setParams] = useState(existing?.params ?? { vertex: null, pantoTilt: null, wrapAngle: null, nearPd: null });
  const [frameLabel, setFrameLabel] = useState(existing?.frameLabel ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [panelOpen, setPanelOpen] = useState(false);
  const [review, setReview] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  /* ---------- Analyse automatique d'une nouvelle photo ---------- */
  useEffect(() => {
    if (existing || !photo) return;
    let cancelled = false;
    (async () => {
      const w = photo.width;
      const h = photo.height;
      const g = toGray(photo, w, h, 900);
      let fp = null;
      try {
        fp = await detectImage(photo);
      } catch {
        setEngineOff(true);
      }
      if (cancelled) return;
      const m: Markers = {};
      const next: CaptureContext = { face: null, refConf: 0, rimConf: {}, brightness: 128, sharpness: 50 };
      if (fp) {
        const f = analyzeFace(fp);
        next.face = { rollDeg: f.rollDeg, yawDeg: f.yawDeg, pitchDeg: f.pitchDeg, gaze: f.gaze, eyeOpen: f.eyeOpen };
        m.pupilR = { x: f.pupilR.x, y: f.pupilR.y };
        m.pupilL = { x: f.pupilL.x, y: f.pupilL.y };
        m.bridge = { x: f.bridge.x, y: (f.pupilR.y + f.pupilL.y) / 2 };
        const rims = detectRims(g, f);
        const fallback = defaultRims(f);
        for (const k of RIM_KEYS) {
          const c = rims.conf[k] ?? 0;
          m[k] = c >= 0.3 && rims.points[k] ? rims.points[k] : fallback[k];
          next.rimConf[k] = c >= 0.3 ? c : 0;
        }
        const card = detectCard(g, f);
        const ax = axes(m)!;
        if (card && card.confidence >= 0.2) {
          [m.c1, m.c2, m.c3, m.c4] = card.corners;
          next.refConf = card.confidence;
        } else {
          // Carte non trouvée : gabarit à la taille attendue (d'après l'iris), à placer.
          const cw = (ID1_CARD_WIDTH_MM * f.irisPx) / IRIS_MM;
          const ch = cw / 1.586;
          const cx = ax.X(m.bridge);
          const top = Math.min(ax.Y(m.rTop!), ax.Y(m.lTop!)) - ch - 0.02 * f.pdPx;
          [m.c1, m.c2, m.c3, m.c4] = [ax.at(cx - cw / 2, top), ax.at(cx + cw / 2, top), ax.at(cx + cw / 2, top + ch), ax.at(cx - cw / 2, top + ch)];
        }
        // Référence « largeur de monture » : bords extérieurs, un peu au-delà des cercles.
        m.ref1 = ax.at(ax.X(m.rTemple!) - 0.05 * f.pdPx, ax.Y(m.pupilR));
        m.ref2 = ax.at(ax.X(m.lTemple!) + 0.05 * f.pdPx, ax.Y(m.pupilL));
        const fb = f.faceBox;
        next.brightness = brightness(g, fb);
        next.sharpness = sharpness(g, {
          x0: f.pupilR.x - 0.3 * f.pdPx, x1: f.pupilL.x + 0.3 * f.pdPx,
          y0: f.pupilR.y - 0.25 * f.pdPx, y1: f.pupilR.y + 0.25 * f.pdPx,
        });
      } else {
        // Visage non détecté : repères génériques au centre, tous à placer.
        const D = w * 0.2;
        m.pupilR = { x: w / 2 - D / 2, y: h * 0.45 };
        m.pupilL = { x: w / 2 + D / 2, y: h * 0.45 };
        m.bridge = { x: w / 2, y: h * 0.45 };
        const ax = axes(m)!;
        Object.assign(m, {
          rTop: ax.at(ax.X(m.pupilR) , ax.Y(m.pupilR) - 0.27 * D), rBottom: ax.at(ax.X(m.pupilR), ax.Y(m.pupilR) + 0.32 * D),
          rNasal: ax.at(ax.X(m.pupilR) + 0.35 * D, ax.Y(m.pupilR)), rTemple: ax.at(ax.X(m.pupilR) - 0.42 * D, ax.Y(m.pupilR)),
          lTop: ax.at(ax.X(m.pupilL), ax.Y(m.pupilL) - 0.27 * D), lBottom: ax.at(ax.X(m.pupilL), ax.Y(m.pupilL) + 0.32 * D),
          lNasal: ax.at(ax.X(m.pupilL) - 0.35 * D, ax.Y(m.pupilL)), lTemple: ax.at(ax.X(m.pupilL) + 0.42 * D, ax.Y(m.pupilL)),
        });
        const cw = 1.36 * D;
        const top = h * 0.45 - 0.6 * D - cw / 1.586;
        [m.c1, m.c2, m.c3, m.c4] = [{ x: w / 2 - cw / 2, y: top }, { x: w / 2 + cw / 2, y: top }, { x: w / 2 + cw / 2, y: top + cw / 1.586 }, { x: w / 2 - cw / 2, y: top + cw / 1.586 }];
        m.ref1 = { x: w / 2 - 0.8 * D, y: h * 0.45 };
        m.ref2 = { x: w / 2 + 0.8 * D, y: h * 0.45 };
      }
      setMarkers(m);
      setAuto(structuredClone(m));
      setCtx(next);
      setCal({ mode: 'CARD', mm: ID1_CARD_WIDTH_MM });
      setPhase('calibrate');
    })();
    return () => {
      cancelled = true;
    };
  }, [existing, photo]);

  /* ---------- Calculs ---------- */
  const scale = useMemo(() => scaleOf(markers, cal), [markers, cal]);
  const autoScale = useMemo(() => scaleOf(auto, cal), [auto, cal]);
  const values = useMemo(() => computeValues(markers, scale), [markers, scale]);
  const autoValues = useMemo(() => computeValues(auto, autoScale), [auto, autoScale]);
  const corrected = useMemo(() => {
    const s = new Set<MarkerKey>(verified);
    for (const k of allKeys(cal.mode)) {
      const a = auto[k];
      const b = markers[k];
      if (a && b && Math.hypot(a.x - b.x, a.y - b.y) > 1.5) s.add(k);
    }
    return s;
  }, [markers, auto, verified, cal.mode]);
  const rel = useMemo(() => reliability(ctx, cal, markers, corrected), [ctx, cal, markers, corrected]);
  // Incertitude indicative sur l'écart pupillaire : ±1,5 px par repère + erreur relative de la référence.
  const precision = useMemo(() => {
    if (!scale || !values.pdTotal) return null;
    const refPx = cal.mode === 'CARD' ? ID1_CARD_WIDTH_MM / scale : cal.mm / scale;
    return Math.hypot(2.1 * scale, (values.pdTotal * 3) / Math.max(1, refPx));
  }, [scale, values.pdTotal, cal]);

  /* ---------- Vue : zoom / déplacement ---------- */
  const boxRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ W: 800, H: 600 });
  const [view, setView] = useState({ z: 1, cx: size.w / 2, cy: size.h / 2 });
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ W: el.clientWidth, H: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [phase]);
  const fit = Math.min(box.W / size.w, box.H / size.h) || 1;
  const unit = 1 / (fit * view.z); // pixels image par pixel écran
  const clampView = (v: { z: number; cx: number; cy: number }) => ({
    z: Math.max(1, Math.min(8, v.z)),
    cx: Math.max(0, Math.min(size.w, v.cx)),
    cy: Math.max(0, Math.min(size.h, v.cy)),
  });
  /** Cadre la vue sur des repères (monture + référence) : plus grand sur téléphone. */
  const frameOn = (keys: readonly MarkerKey[]) => {
    const pts = keys.map((k) => markers[k]).filter(Boolean) as Pt[];
    if (pts.length < 2 || !box.W) return;
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const bw = (Math.max(...xs) - Math.min(...xs)) * 1.35 + 40;
    const bh = (Math.max(...ys) - Math.min(...ys)) * 1.35 + 60;
    const z = Math.min(box.W / (bw * fit), box.H / (bh * fit));
    setView(clampView({ z: Math.min(4, z), cx: (Math.max(...xs) + Math.min(...xs)) / 2, cy: (Math.max(...ys) + Math.min(...ys)) / 2 + 10 }));
  };
  const framedPhase = useRef<string | null>(null);
  useEffect(() => {
    if (phase === 'analyzing' || framedPhase.current === phase || box.W < 50) return;
    framedPhase.current = phase;
    frameOn([...RIM_KEYS, ...refKeys(cal.mode), 'pupilR', 'pupilL']);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, box.W, box.H]);
  const focus = (k: MarkerKey) => {
    const p = markers[k];
    if (p) setView(clampView({ z: 3.2, cx: p.x, cy: p.y }));
  };

  /* ---------- Pointeurs : repères, déplacement, pincement ---------- */
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<
    | { kind: 'marker'; key: MarkerKey }
    | { kind: 'pan'; x: number; y: number; cx: number; cy: number }
    | { kind: 'pinch'; d: number; z: number }
    | null
  >(null);
  const [loupe, setLoupe] = useState<{ p: Pt; right: boolean } | null>(null);
  const [active, setActive] = useState<MarkerKey | null>(null);

  const toImage = (e: { clientX: number; clientY: number }): Pt => {
    const r = stageRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * size.w, y: ((e.clientY - r.top) / r.height) * size.h };
  };
  const visibleKeys = useMemo(
    () => (phase === 'calibrate' ? [...refKeys(cal.mode)] : [...FACE_KEYS, ...RIM_KEYS, ...refKeys(cal.mode)]),
    [phase, cal.mode],
  );
  const hit = (e: { clientX: number; clientY: number }): MarkerKey | null => {
    const p = toImage(e);
    let best: MarkerKey | null = null;
    let dmin = 26 * unit;
    for (const k of visibleKeys) {
      const q = markers[k];
      if (!q) continue;
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d < dmin) { dmin = d; best = k; }
    }
    return best;
  };

  function onDown(e: React.PointerEvent) {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = { kind: 'pinch', d: Math.hypot(a!.x - b!.x, a!.y - b!.y), z: view.z };
      setLoupe(null);
      return;
    }
    const k = hit(e);
    if (k) {
      gesture.current = { kind: 'marker', key: k };
      setActive(k);
      const r = boxRef.current!.getBoundingClientRect();
      setLoupe({ p: markers[k]!, right: e.clientX - r.left < r.width / 2 });
    } else {
      gesture.current = { kind: 'pan', x: e.clientX, y: e.clientY, cx: view.cx, cy: view.cy };
    }
  }
  function onMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (!g) return;
    if (g.kind === 'pinch' && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      setView((v) => clampView({ ...v, z: (g.z * d) / Math.max(1, g.d) }));
    } else if (g.kind === 'marker') {
      const p = toImage(e);
      p.x = Math.max(0, Math.min(size.w, p.x));
      p.y = Math.max(0, Math.min(size.h, p.y));
      setMarkers((m) => ({ ...m, [g.key]: p }));
      const r = boxRef.current!.getBoundingClientRect();
      setLoupe({ p, right: e.clientX - r.left < r.width / 2 });
    } else if (g.kind === 'pan') {
      setView((v) => clampView({ ...v, cx: g.cx - (e.clientX - g.x) * unit, cy: g.cy - (e.clientY - g.y) * unit }));
    }
  }
  function onUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) {
      gesture.current = null;
      setLoupe(null);
    }
  }
  function onWheel(e: React.WheelEvent) {
    const p = toImage(e);
    setView((v) => {
      const z = Math.max(1, Math.min(8, v.z * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
      // Zoom centré sous le curseur.
      return clampView({ z, cx: p.x - ((p.x - v.cx) * v.z) / z, cy: p.y - ((p.y - v.cy) * v.z) / z });
    });
  }

  /* ---------- Calibration ---------- */
  function chooseCal(mode: MeasurementCalibration) {
    setCal({ mode, mm: mode === 'CARD' ? ID1_CARD_WIDTH_MM : mode === 'FRAME' ? frameMm : refMm });
  }
  const calReady = cal.mode === 'CARD' ? scale != null : cal.mm > 0 && scale != null;

  /* ---------- Enregistrement ---------- */
  async function save() {
    if (!scale) return;
    setSaving(true);
    setError('');
    try {
      const saved: SavedMarkers = { v: 1, w: size.w, h: size.h, points: markers, auto, verified: [...verified], calibration: cal, ctx };
      const numbers = {
        pdTotal: values.pdTotal ?? null,
        odMonoPd: values.odMonoPd ?? null,
        ogMonoPd: values.ogMonoPd ?? null,
        odHeight: values.odHeight ?? null,
        ogHeight: values.ogHeight ?? null,
        lensWidth: values.lensWidth ?? null,
        lensHeight: values.lensHeight ?? null,
        bridge: values.bridge ?? null,
        frameWidth: cal.mode === 'FRAME' ? cal.mm : values.frameWidth ?? null,
        ed: values.ed ?? null,
        vertex: params.vertex,
        pantoTilt: params.pantoTilt,
        wrapAngle: params.wrapAngle,
        nearPd: params.nearPd,
      };
      const common = {
        ...numbers,
        method: cal.mode === 'CARD' ? ('PHOTO_CARD' as const) : cal.mode === 'FRAME' ? ('PHOTO_FRAME' as const) : ('PHOTO_REFERENCE' as const),
        calibration: cal.mode,
        confidence: rel.score,
        markers: saved as unknown as Record<string, unknown>,
        autoValues: autoValues as Record<string, number>,
        frameLabel,
        notes,
      };
      const m = existing
        ? await updateMeasurement(existing.id, common)
        : await createMeasurement({ ...common, customerId: customerId ?? '', photoUrl: src });
      onSaved(m);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  /* ---------- Rendu ---------- */
  const ax = axes(markers);
  const fmt = (n?: number | null) => (n == null ? '—' : nf().format(n));
  const stageStyle = {
    width: size.w * fit,
    height: size.h * fit,
    transform: `translate(${box.W / 2 - view.cx * fit * view.z}px, ${box.H / 2 - view.cy * fit * view.z}px) scale(${view.z})`,
    transformOrigin: '0 0',
  } as const;

  const reviewKey = review != null ? REVIEW_ORDER[review] ?? null : null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#0b0d12] text-white">
      {/* Barre supérieure */}
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2" style={{ paddingTop: 'calc(0.5rem + env(safe-area-inset-top))' }}>
        <button type="button" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 hover:bg-white/20" aria-label={tr('cz.back')}>
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{phase === 'calibrate' ? tr('cz.calibration') : tr('cz.analysis')}</p>
          <p className="truncate text-[11px] text-white/55">{customerName || tr('cz.noCustomer')}</p>
        </div>
        {phase === 'measure' && (
          <>
            <button
              type="button"
              onClick={() => { setReview(0); focus(REVIEW_ORDER[0]!); }}
              className={`hidden h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold sm:flex ${review != null ? 'bg-violet-500' : 'bg-white/10 hover:bg-white/20'}`}
            >
              <Crosshair className="h-4 w-4" /> {tr('cz.review')}
            </button>
            <button type="button" onClick={save} disabled={saving || !scale} className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {tr('cz.save')}
            </button>
          </>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Photo et repères */}
        <div
          ref={boxRef}
          className="relative min-h-0 flex-1 touch-none overflow-hidden"
          onPointerDown={phase === 'analyzing' ? undefined : onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onWheel={onWheel}
        >
          <div ref={stageRef} className="absolute left-0 top-0 select-none" style={stageStyle}>
            <img src={src} alt="" draggable={false} className="block h-full w-full" onLoad={(e) => !existing && setSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} />
            {phase !== 'analyzing' && ax && (
              <Overlay
                m={markers}
                cal={cal}
                values={values}
                unit={unit}
                size={size}
                phase={phase}
                visible={visibleKeys}
                active={active}
                review={reviewKey}
                verified={corrected}
                rimConf={ctx.rimConf}
                fmt={fmt}
              />
            )}
          </div>

          {phase === 'analyzing' && (
            <div className="absolute inset-0 grid place-items-center bg-black/50">
              <div className="flex flex-col items-center gap-3 text-center">
                <span className="relative grid h-16 w-16 place-items-center">
                  <span className="absolute inset-0 animate-ping rounded-full bg-primary/40" />
                  <ScanFace className="h-9 w-9" />
                </span>
                <p className="text-sm font-semibold">{tr('cz.analyzing')}</p>
                <p className="max-w-xs text-xs text-white/60">{tr('cz.analyzingHint')}</p>
              </div>
            </div>
          )}

          {loupe && view.z < 3 && (
            <div
              className="pointer-events-none absolute top-3 z-10 h-36 w-36 overflow-hidden rounded-full border-4 border-white bg-black shadow-2xl"
              style={{
                [loupe.right ? 'right' : 'left']: 12,
                backgroundImage: `url(${src})`,
                backgroundRepeat: 'no-repeat',
                backgroundSize: `${size.w * fit * view.z * 3}px ${size.h * fit * view.z * 3}px`,
                backgroundPosition: `${72 - loupe.p.x * fit * view.z * 3}px ${72 - loupe.p.y * fit * view.z * 3}px`,
              }}
            >
              <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-red-500" />
              <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-red-500" />
            </div>
          )}

          {/* Zoom */}
          {phase !== 'analyzing' && (
            <div className="absolute bottom-3 right-3 z-10 flex flex-col overflow-hidden rounded-xl bg-black/60 backdrop-blur">
              <button type="button" className="grid h-10 w-10 place-items-center hover:bg-white/10" onClick={() => setView((v) => clampView({ ...v, z: v.z * 1.4 }))} aria-label={tr('cz.zoomIn')}><Plus className="h-4 w-4" /></button>
              <button type="button" className="grid h-10 w-10 place-items-center hover:bg-white/10" onClick={() => setView((v) => clampView({ ...v, z: v.z / 1.4 }))} aria-label={tr('cz.zoomOut')}><Minus className="h-4 w-4" /></button>
              <button type="button" className="grid h-10 w-10 place-items-center hover:bg-white/10" onClick={() => setView({ z: 1, cx: size.w / 2, cy: size.h / 2 })} aria-label={tr('cz.zoomFit')}><Maximize2 className="h-4 w-4" /></button>
            </div>
          )}

          {/* Mode « Vérifier les repères » */}
          {review != null && reviewKey && (
            <div className="absolute inset-x-3 top-3 z-10 mx-auto flex max-w-xl items-center gap-2 rounded-2xl bg-violet-600/95 p-2 pl-3 shadow-2xl">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/70">
                  {tr('cz.review')} · {review + 1}/{REVIEW_ORDER.length}
                </p>
                <p className="truncate text-sm font-semibold">{tr(`cz.marker.${reviewKey}`)}</p>
              </div>
              <button type="button" disabled={review === 0} onClick={() => { const i = review - 1; setReview(i); focus(REVIEW_ORDER[i]!); }} className="grid h-9 w-9 place-items-center rounded-lg bg-white/15 disabled:opacity-40" aria-label={tr('cz.prev')}>
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setVerified((s) => new Set(s).add(reviewKey));
                  const i = review + 1;
                  if (i >= REVIEW_ORDER.length) { setReview(null); setView({ z: 1, cx: size.w / 2, cy: size.h / 2 }); }
                  else { setReview(i); focus(REVIEW_ORDER[i]!); }
                }}
                className="flex h-9 items-center gap-1 rounded-lg bg-white px-3 text-xs font-bold text-violet-700"
              >
                <Check className="h-4 w-4" /> {tr('cz.validate')}
              </button>
              <button type="button" onClick={() => { setReview(null); setView({ z: 1, cx: size.w / 2, cy: size.h / 2 }); }} className="grid h-9 w-9 place-items-center rounded-lg bg-white/15" aria-label={tr('cz.exitReview')}>
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Panneau : calibration puis mesures */}
        {phase === 'calibrate' && (
          <CalibrationPanel
            cal={cal}
            choose={chooseCal}
            cardConf={ctx.refConf}
            frameMm={frameMm}
            setFrameMm={(n) => { setFrameMm(n); if (cal.mode === 'FRAME') setCal({ mode: 'FRAME', mm: n }); }}
            refMm={refMm}
            setRefMm={(n) => { setRefMm(n); if (cal.mode === 'REFERENCE') setCal({ mode: 'REFERENCE', mm: n }); }}
            scale={scale}
            precision={precision}
            ready={calReady}
            engineOff={engineOff}
            faceFound={ctx.face != null}
            onDone={() => setPhase('measure')}
          />
        )}
        {phase === 'measure' && (
          <MeasurePanel
            open={panelOpen}
            setOpen={setPanelOpen}
            values={values}
            autoValues={autoValues}
            corrected={corrected.size > 0}
            rel={rel}
            fmt={fmt}
            cal={cal}
            precision={precision}
            params={params}
            setParams={setParams}
            frameLabel={frameLabel}
            setFrameLabel={setFrameLabel}
            notes={notes}
            setNotes={setNotes}
            onRecalibrate={() => { setReview(null); setPhase('calibrate'); }}
            onReview={() => { setReview(0); focus(REVIEW_ORDER[0]!); setPanelOpen(false); }}
            error={error}
          />
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Superposition : repères, boîtes, cotes                              */
/* ------------------------------------------------------------------ */

function Overlay({
  m,
  cal,
  values,
  unit,
  size,
  phase,
  visible,
  active,
  review,
  verified,
  rimConf,
  fmt,
}: {
  m: Markers;
  cal: Calibration;
  values: Values;
  unit: number;
  size: { w: number; h: number };
  phase: 'calibrate' | 'measure';
  visible: MarkerKey[];
  active: MarkerKey | null;
  review: MarkerKey | null;
  verified: Set<MarkerKey>;
  rimConf: CaptureContext['rimConf'];
  fmt: (n?: number | null) => string;
}) {
  const ax = axes(m)!;
  const u = unit;
  const R = lensBox(m, 'r');
  const Lb = lensBox(m, 'l');
  const poly = (b: NonNullable<typeof R>) =>
    [ax.at(b.x0, b.y0), ax.at(b.x1, b.y0), ax.at(b.x1, b.y1), ax.at(b.x0, b.y1)].map((p) => `${p.x},${p.y}`).join(' ');
  const label = (p: Pt, text: string, color = '#fff', anchor: 'start' | 'middle' | 'end' = 'middle') => (
    <text
      x={p.x}
      y={p.y}
      fill={color}
      fontSize={12 * u}
      fontWeight={700}
      textAnchor={anchor}
      dominantBaseline="middle"
      stroke="#000"
      strokeWidth={3.2 * u}
      paintOrder="stroke"
      style={{ fontFamily: 'inherit', fontVariantNumeric: 'tabular-nums' }}
    >
      {text}
    </text>
  );
  const line = (a: Pt, b: Pt, color: string, w = 1.5, dash?: string) => (
    <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={w * u} strokeDasharray={dash} />
  );
  const showMeasure = phase === 'measure';
  const refColor = COLORS.ref;

  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" viewBox={`0 0 ${size.w} ${size.h}`}>
      {/* Référence */}
      {cal.mode === 'CARD' && m.c1 && m.c2 && m.c3 && m.c4 && (
        <g>
          <polygon points={[m.c1, m.c2, m.c3, m.c4].map((p) => `${p.x},${p.y}`).join(' ')} fill={`${refColor}22`} stroke={refColor} strokeWidth={2 * u} />
          {label({ x: (m.c1.x + m.c2.x) / 2, y: (m.c1.y + m.c2.y) / 2 - 12 * u }, `${fmt(ID1_CARD_WIDTH_MM)} mm`, refColor)}
        </g>
      )}
      {cal.mode !== 'CARD' && m.ref1 && m.ref2 && (
        <g>
          {line(m.ref1, m.ref2, refColor, 2, `${6 * u} ${4 * u}`)}
          {cal.mm > 0 && label({ x: (m.ref1.x + m.ref2.x) / 2, y: (m.ref1.y + m.ref2.y) / 2 - 12 * u }, `${fmt(cal.mm)} mm`, refColor)}
        </g>
      )}

      {showMeasure && (
        <>
          {/* Ligne médiane et axe des pupilles */}
          {m.bridge && line(ax.at(ax.X(m.bridge), ax.Y(m.bridge) - 0.9 * size.h), ax.at(ax.X(m.bridge), ax.Y(m.bridge) + 0.9 * size.h), '#ffffff66', 1, `${8 * u} ${6 * u}`)}
          {m.pupilR && m.pupilL && line(
            ax.at(ax.X(m.pupilR) - 0.7 * size.w, ax.Y(m.pupilR)),
            ax.at(ax.X(m.pupilL) + 0.7 * size.w, ax.Y(m.pupilL)),
            '#22c55e88', 1,
          )}
          {/* Boîtes des verres, centres géométriques, décentrements */}
          {[R, Lb].map((b, i) => {
            if (!b) return null;
            const side = i === 0 ? 'r' : 'l';
            const pupil = i === 0 ? m.pupilR! : m.pupilL!;
            const c = ax.at((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2);
            const pY = ax.Y(pupil);
            const pX = ax.X(pupil);
            const h = i === 0 ? values.odHeight : values.ogHeight;
            const A = i === 0 ? values.odA : values.ogA;
            const B = i === 0 ? values.odB : values.ogB;
            const outerX = i === 0 ? b.x0 : b.x1;
            return (
              <g key={side}>
                <polygon points={poly(b)} fill="#06b6d414" stroke={COLORS.rim} strokeWidth={1.8 * u} />
                {line(ax.at((b.x0 + b.x1) / 2 - 6 * u, (b.y0 + b.y1) / 2), ax.at((b.x0 + b.x1) / 2 + 6 * u, (b.y0 + b.y1) / 2), '#fff', 1.2)}
                {line(ax.at((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2 - 6 * u), ax.at((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2 + 6 * u), '#fff', 1.2)}
                {line(c, pupil, '#fb923c', 1.4, `${3 * u} ${3 * u}`)}
                {/* Hauteur : pupille → bas de boîte */}
                {line(ax.at(pX, pY), ax.at(pX, b.y1), '#f472b6', 1.6)}
                {h != null && label(ax.at(pX + (i === 0 ? -8 : 8) * u, (pY + b.y1) / 2), `H ${fmt(h)}`, '#f9a8d4', i === 0 ? 'end' : 'start')}
                {/* Sous la boîte : écart mono de l'œil, puis A ; B sur le côté extérieur */}
                {label(ax.at((b.x0 + b.x1) / 2, b.y1 + 15 * u), `${i === 0 ? 'OD' : 'OG'} · PD ${fmt(i === 0 ? values.odMonoPd : values.ogMonoPd)}`, '#86efac')}
                {A != null && label(ax.at((b.x0 + b.x1) / 2, b.y1 + 31 * u), `A ${fmt(A)}`, '#67e8f9')}
                {B != null && label(ax.at(outerX + (i === 0 ? -8 : 8) * u, (b.y0 + b.y1) / 2), `B ${fmt(B)}`, '#67e8f9', i === 0 ? 'end' : 'start')}
              </g>
            );
          })}
          {/* Largeur monture et pont */}
          {R && Lb && (
            <g>
              {/* Cote de largeur sous la monture (au-dessus se trouve la carte de référence) */}
              {line(ax.at(R.x0, Math.max(R.y1, Lb.y1) + 46 * u), ax.at(Lb.x1, Math.max(R.y1, Lb.y1) + 46 * u), '#e5e7eb', 1.2)}
              {line(ax.at(R.x0, Math.max(R.y1, Lb.y1) + 40 * u), ax.at(R.x0, Math.max(R.y1, Lb.y1) + 52 * u), '#e5e7eb', 1.2)}
              {line(ax.at(Lb.x1, Math.max(R.y1, Lb.y1) + 40 * u), ax.at(Lb.x1, Math.max(R.y1, Lb.y1) + 52 * u), '#e5e7eb', 1.2)}
              {label(ax.at((R.x0 + Lb.x1) / 2, Math.max(R.y1, Lb.y1) + 60 * u), `${fmt(cal.mode === 'FRAME' ? cal.mm : values.frameWidth)} mm`, '#e5e7eb')}
              {values.bridge != null && label(ax.at((R.x1 + Lb.x0) / 2, (R.y1 + Lb.y1) / 2 + 2 * u), `DBL ${fmt(values.bridge)}`, '#93c5fd')}
            </g>
          )}
        </>
      )}

      {/* Repères déplaçables */}
      {visible.map((k) => {
        const p = m[k];
        if (!p) return null;
        const isPupil = k === 'pupilR' || k === 'pupilL';
        const isRim = (RIM_KEYS as readonly string[]).includes(k);
        const weak = isRim && !verified.has(k) && (rimConf[k as keyof typeof rimConf] ?? 0) < 0.5;
        const col = verified.has(k) ? COLORS.verified : weak ? COLORS.weak : markerColor(k);
        const r = (k === active || k === review ? 11 : 8) * u;
        return (
          <g key={k}>
            {k === review && <circle cx={p.x} cy={p.y} r={22 * u} fill="none" stroke="#fff" strokeWidth={2 * u} strokeDasharray={`${4 * u} ${3 * u}`} />}
            <circle cx={p.x} cy={p.y} r={r} fill={isPupil ? 'none' : `${col}55`} stroke="#000" strokeWidth={3.4 * u} />
            <circle cx={p.x} cy={p.y} r={r} fill={isPupil ? 'none' : `${col}55`} stroke={col} strokeWidth={2 * u} />
            {line({ x: p.x - r * 1.5, y: p.y }, { x: p.x + r * 1.5, y: p.y }, col, 1.2)}
            {line({ x: p.x, y: p.y - r * 1.5 }, { x: p.x, y: p.y + r * 1.5 }, col, 1.2)}
          </g>
        );
      })}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Panneau de calibration                                              */
/* ------------------------------------------------------------------ */

function CalibrationPanel({
  cal,
  choose,
  cardConf,
  frameMm,
  setFrameMm,
  refMm,
  setRefMm,
  scale,
  precision,
  ready,
  engineOff,
  faceFound,
  onDone,
}: {
  cal: Calibration;
  choose: (m: MeasurementCalibration) => void;
  cardConf: number;
  frameMm: number;
  setFrameMm: (n: number) => void;
  refMm: number;
  setRefMm: (n: number) => void;
  scale: number | null;
  precision: number | null;
  ready: boolean;
  engineOff: boolean;
  faceFound: boolean;
  onDone: () => void;
}) {
  const opt = (mode: MeasurementCalibration, n: number, icon: React.ReactNode, title: string, body: React.ReactNode) => (
    <button
      type="button"
      onClick={() => choose(mode)}
      className={`w-full rounded-2xl border p-3 text-left transition ${cal.mode === mode ? 'border-amber-400 bg-amber-400/10' : 'border-white/10 bg-white/5 hover:border-white/30'}`}
    >
      <div className="flex items-center gap-2">
        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${cal.mode === mode ? 'bg-amber-400 text-black' : 'bg-white/10'}`}>{n}</span>
        {icon}
        <span className="text-sm font-semibold">{title}</span>
      </div>
      <div className="mt-2 pl-9 text-xs text-white/70">{body}</div>
    </button>
  );
  return (
    <aside className="max-h-[48vh] shrink-0 space-y-2 overflow-y-auto border-t border-white/10 bg-[#11141b] p-3 lg:max-h-none lg:w-[380px] lg:border-l lg:border-t-0">
      <p className="text-xs font-bold uppercase tracking-wider text-white/50">{tr('cz.calibration')}</p>
      {!faceFound && (
        <p className="flex items-start gap-1.5 rounded-xl bg-amber-500/15 p-2.5 text-xs text-amber-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {engineOff ? tr('cz.engineOffAnalysis') : tr('cz.noFaceFound')}
        </p>
      )}
      {opt('CARD', 1, <CreditCard className="h-4 w-4 text-amber-300" />, tr('cz.cal.card'), (
        <>
          {cardConf >= 0.45 ? (
            <span className="font-semibold text-emerald-300">✓ {tr('cz.cal.cardDetected', { pct: Math.round(cardConf * 100) })}</span>
          ) : cardConf > 0 ? (
            <span className="text-amber-200">{tr('cz.cal.cardUnsure')}</span>
          ) : (
            <span className="text-amber-200">{tr('cz.cal.cardNotFound')}</span>
          )}
          <span className="mt-1 block">{tr('cz.cal.cardHint')}</span>
        </>
      ))}
      {opt('FRAME', 2, <Ruler className="h-4 w-4 text-amber-300" />, tr('cz.cal.frame'), (
        <label className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {tr('cz.cal.realWidth')}
          <NumberInput className="h-8 w-20 rounded-lg border border-white/20 bg-black/40 px-2 text-right text-sm text-white" value={frameMm || null} decimals={1} max={200} placeholder="138" onFocus={() => choose('FRAME')} onChange={setFrameMm} />
          mm
        </label>
      ))}
      {opt('REFERENCE', 3, <SlidersHorizontal className="h-4 w-4 text-amber-300" />, tr('cz.cal.reference'), (
        <>
          <label className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            {tr('cz.cal.length')}
            <NumberInput className="h-8 w-20 rounded-lg border border-white/20 bg-black/40 px-2 text-right text-sm text-white" value={refMm || null} decimals={1} max={300} onFocus={() => choose('REFERENCE')} onChange={setRefMm} />
            mm
          </label>
          <span className="mt-1 block">{tr('cz.cal.referenceHint')}</span>
        </>
      ))}
      <div className="rounded-2xl bg-white/5 p-3 text-xs">
        {ready && scale ? (
          <>
            <p className="font-semibold text-emerald-300">✓ {tr('cz.cal.scaleOk')}</p>
            <p className="mt-0.5 text-white/60">
              {tr('cz.cal.scaleValue', { v: scale.toFixed(3) })}
              {precision != null && ` · ${tr('cz.cal.precision', { v: precision.toFixed(1) })}`}
            </p>
          </>
        ) : (
          <p className="text-amber-200">{tr(cal.mode === 'CARD' ? 'cz.cal.placeCard' : 'cz.cal.enterLength')}</p>
        )}
      </div>
      <button type="button" disabled={!ready} onClick={onDone} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold disabled:opacity-40">
        <Check className="h-4 w-4" /> {tr('cz.cal.validate')}
      </button>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* Panneau des mesures                                                 */
/* ------------------------------------------------------------------ */

/** Déclarés hors du panneau : sinon chaque frappe recréerait les champs (perte du curseur). */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white/5 px-3 py-2">
      <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-white/45">{title}</p>
      {children}
    </div>
  );
}

function ValueRow({ v, a, label, fmt }: { v?: number; a?: number; label: string; fmt: (n?: number | null) => string }) {
  const changed = v != null && a != null && Math.abs(v - a) >= 0.2;
  return (
    <div className="flex items-baseline justify-between gap-2 py-1">
      <span className="text-xs text-white/60">{label}</span>
      <span className="text-right">
        <span className="font-mono text-sm font-semibold">{fmt(v)}</span>
        <span className="ml-1 text-[10px] text-white/40">mm</span>
        {changed && <span className="ml-2 font-mono text-[10px] text-white/40 line-through">{fmt(a)}</span>}
      </span>
    </div>
  );
}

function MeasurePanel({
  open,
  setOpen,
  values,
  autoValues,
  corrected,
  rel,
  fmt,
  cal,
  precision,
  params,
  setParams,
  frameLabel,
  setFrameLabel,
  notes,
  setNotes,
  onRecalibrate,
  onReview,
  error,
}: {
  open: boolean;
  setOpen: (b: boolean) => void;
  values: Values;
  autoValues: Values;
  corrected: boolean;
  rel: ReturnType<typeof reliability>;
  fmt: (n?: number | null) => string;
  cal: Calibration;
  precision: number | null;
  params: WorkspaceExisting['params'];
  setParams: (p: WorkspaceExisting['params']) => void;
  frameLabel: string;
  setFrameLabel: (s: string) => void;
  notes: string;
  setNotes: (s: string) => void;
  onRecalibrate: () => void;
  onReview: () => void;
  error: string;
}) {
  const tone = rel.score >= 80 ? 'text-emerald-300' : rel.score >= 60 ? 'text-amber-300' : 'text-red-300';
  const dots = Math.round(rel.score / 20);
  const param = (k: keyof WorkspaceExisting['params'], label: string, unit: string, max: number) => (
    <label className="flex items-center justify-between gap-2 py-1 text-xs text-white/60">
      {label}
      <span className="flex items-center gap-1">
        <NumberInput className="h-8 w-16 rounded-lg border border-white/15 bg-black/40 px-2 text-right font-mono text-sm text-white" value={params[k]} decimals={1} max={max} placeholder="—" onChange={(n) => setParams({ ...params, [k]: n > 0 ? n : null })} />
        <span className="w-4 text-[10px] text-white/40">{unit}</span>
      </span>
    </label>
  );
  const Row = ({ k, label }: { k: ValueKey; label: string }) => <ValueRow v={values[k]} a={autoValues[k]} label={label} fmt={fmt} />;
  const dec = (n?: number | null) => (n == null ? '—' : `${n > 0 ? '+' : ''}${fmt(n)}`);

  return (
    <aside className={`flex shrink-0 flex-col border-t border-white/10 bg-[#11141b] lg:w-[380px] lg:border-l lg:border-t-0 ${open ? 'max-h-[62vh]' : 'max-h-[30vh]'} lg:max-h-none`}>
      {/* Résumé (toujours visible) + poignée */}
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left lg:cursor-default">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className={`h-4 w-4 ${tone}`} />
            <span className={`font-mono text-sm font-bold ${tone}`}>{rel.score} %</span>
            <span className={`text-xs tracking-widest ${tone}`}>{'●'.repeat(dots)}<span className="text-white/20">{'●'.repeat(5 - dots)}</span></span>
            <span className="truncate text-[11px] text-white/50">{tr('cz.reliability')}</span>
          </div>
          <p className="mt-0.5 truncate font-mono text-xs text-white/80">
            PD {fmt(values.odMonoPd)} / {fmt(values.ogMonoPd)} ({fmt(values.pdTotal)}) · H {fmt(values.odHeight)} / {fmt(values.ogHeight)}
          </p>
        </div>
        <span className="lg:hidden">{open ? <ChevronDown className="h-5 w-5 text-white/60" /> : <ChevronUp className="h-5 w-5 text-white/60" />}</span>
      </button>

      <div className={`min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-3 ${open ? '' : 'hidden lg:block'}`}>
        <p className="flex items-start gap-1.5 rounded-xl border border-amber-400/30 bg-amber-400/10 p-2 text-[11px] font-medium text-amber-100">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {tr('cz.estimated')}
        </p>
        <div className="flex items-center gap-2 text-[11px]">
          <span className={`rounded-full px-2 py-0.5 font-semibold ${corrected ? 'bg-violet-500/25 text-violet-200' : 'bg-white/10 text-white/70'}`}>
            {corrected ? tr('cz.correctedByOptician') : tr('cz.automatic')}
          </span>
          {corrected && <span className="text-white/45">{tr('cz.strikeHint')}</span>}
        </div>

        <Section title={tr('cz.sec.pd')}>
          <Row k="odMonoPd" label="OD" />
          <Row k="ogMonoPd" label="OG" />
          <Row k="pdTotal" label={tr('cz.total')} />
        </Section>
        <Section title={tr('cz.sec.heights')}>
          <Row k="odHeight" label="OD" />
          <Row k="ogHeight" label="OG" />
        </Section>
        <Section title={tr('cz.sec.frame')}>
          {cal.mode === 'FRAME' ? (
            <div className="flex items-baseline justify-between py-1">
              <span className="text-xs text-white/60">{tr('cz.frameWidth')}</span>
              <span className="font-mono text-sm font-semibold">{fmt(cal.mm)} <span className="text-[10px] text-white/40">mm · {tr('cz.reference')}</span></span>
            </div>
          ) : (
            <Row k="frameWidth" label={tr('cz.frameWidth')} />
          )}
          <Row k="lensWidth" label="A" />
          <Row k="lensHeight" label="B" />
          <Row k="bridge" label="DBL" />
          <Row k="ed" label={tr('cz.ed')} />
          <Row k="minBlank" label={tr('cz.minBlank')} />
        </Section>
        <Section title={tr('cz.sec.decentration')}>
          <div className="grid grid-cols-3 gap-1 py-1 text-[11px] text-white/50">
            <span />
            <span className="text-right">{tr('cz.horizontal')}</span>
            <span className="text-right">{tr('cz.vertical')}</span>
            <span>OD</span>
            <span className="text-right font-mono text-sm text-white">{dec(values.odDecH)}</span>
            <span className="text-right font-mono text-sm text-white">{dec(values.odDecV)}</span>
            <span>OG</span>
            <span className="text-right font-mono text-sm text-white">{dec(values.ogDecH)}</span>
            <span className="text-right font-mono text-sm text-white">{dec(values.ogDecV)}</span>
          </div>
          <p className="pb-1 text-[10px] text-white/40">{tr('cz.decHint')}</p>
        </Section>
        <Section title={tr('cz.sec.params')}>
          {param('vertex', tr('cz.vertex'), 'mm', 30)}
          {param('pantoTilt', tr('cz.panto'), '°', 30)}
          {param('wrapAngle', tr('cz.wrap'), '°', 40)}
          {param('nearPd', tr('cz.nearPd'), 'mm', 90)}
          <p className="pb-1 text-[10px] text-white/40">{tr('cz.paramsHint')}</p>
        </Section>

        <Section title={tr('cz.reliabilityDetail')}>
          <ul className="space-y-1 py-1">
            {rel.checks.map((c, i) => (
              <li key={i} className={`flex items-start gap-1.5 text-xs ${c.ok ? 'text-emerald-200' : 'text-amber-200'}`}>
                {c.ok ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                {tr(`cz.rel.${c.key}`, c.params)}
              </li>
            ))}
          </ul>
        </Section>

        <div className="rounded-xl bg-white/5 px-3 py-2 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-white/60">
              {tr(`cz.cal.mode.${cal.mode}`)}
              {precision != null && <span className="ml-1 text-white/40">· {tr('cz.cal.precision', { v: precision.toFixed(1) })}</span>}
            </span>
            <button type="button" onClick={onRecalibrate} className="font-semibold text-amber-300">{tr('cz.change')}</button>
          </div>
        </div>

        <label className="block text-xs text-white/60">
          {tr('cz.frameLabel')}
          <input className="mt-1 h-9 w-full rounded-lg border border-white/15 bg-black/40 px-2 text-sm text-white" value={frameLabel} maxLength={160} onChange={(e) => setFrameLabel(e.target.value)} placeholder="Ray-Ban RB5154 49□21" />
        </label>
        <label className="block text-xs text-white/60">
          {tr('cz.notes')}
          <input className="mt-1 h-9 w-full rounded-lg border border-white/15 bg-black/40 px-2 text-sm text-white" value={notes} maxLength={1000} onChange={(e) => setNotes(e.target.value)} />
        </label>

        <button type="button" onClick={onReview} className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-violet-600 text-sm font-semibold">
          <Crosshair className="h-4 w-4" /> {tr('cz.review')}
        </button>
        {error && <p className="text-xs text-red-300">{error}</p>}
      </div>
    </aside>
  );
}
