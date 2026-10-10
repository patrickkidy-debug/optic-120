import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Camera, CameraOff, RotateCcw, Check, AlertTriangle, Flashlight, FlashlightOff, ImagePlus, Loader2, RefreshCw, Timer } from 'lucide-react';
import { getLandmarker, toFacePoints } from '../../../features/optique/measure/landmarker';
import { analyzeFace, IRIS_MM, type FaceAnalysis } from '../../../features/optique/measure/geometry';
import { brightness, detectRims, sharpness, toGray } from '../../../features/optique/measure/vision';
import { tr } from '../../../lib/tr';

type CamError = 'denied' | 'notFound' | 'busy' | 'unsupported' | 'other';

/** Vrai dans l'application Android / iOS (Capacitor), faux dans un navigateur. */
const isNative = () =>
  Boolean((window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.());

/** Plus grand côté de la photo transmise à l'analyse (précision ~0,2 mm/px avec une carte). */
export const CAPTURE_MAX = 1600;

type CheckKey = 'face' | 'eyes' | 'frame' | 'centered' | 'gaze' | 'distance' | 'light';
const CHECK_ORDER: CheckKey[] = ['face', 'eyes', 'frame', 'centered', 'gaze', 'distance', 'light'];

interface Live {
  face: FaceAnalysis | null;
  checks: Record<CheckKey, boolean>;
  /** Consigne prioritaire (clé de traduction) quand un contrôle échoue. */
  hint: string | null;
  quality: number;
  /** Position de la jauge de distance : 0 = trop loin, 0,5 = idéal, 1 = trop près. */
  gauge: number;
  distanceCm: number | null;
}

const EMPTY: Live = {
  face: null,
  checks: { face: false, eyes: false, frame: false, centered: false, gaze: false, distance: false, light: false },
  hint: 'cz.hint.searching',
  quality: 0,
  gauge: 0.5,
  distanceCm: null,
};

/** Évalue une image du flux : contrôles, consigne, score de qualité. */
function evaluate(face: FaceAnalysis | null, vw: number, vh: number, img: { light: number; sharp: number; frame: number } | null): Live {
  if (!face) return { ...EMPTY, hint: 'cz.hint.noFace' };
  const fb = face.faceBox;
  const faceW = (fb.x1 - fb.x0) / vw;
  const cx = (face.pupilR.x + face.pupilL.x) / 2 / vw;
  const cy = (face.pupilR.y + face.pupilL.y) / 2 / vh;
  // Distance estimée grâce à l'iris (champ horizontal supposé de 65°) : indicative seulement.
  const focal = vw / (2 * Math.tan((65 * Math.PI) / 360));
  const distanceCm = face.irisPx > 2 ? Math.round((IRIS_MM * focal) / face.irisPx / 10) : null;
  const gauge = Math.max(0, Math.min(1, (faceW - 0.25) / 0.6));

  const inFrame = fb.x0 > vw * 0.02 && fb.x1 < vw * 0.98 && fb.y0 > vh * 0.01;
  const checks: Record<CheckKey, boolean> = {
    face: true,
    eyes: face.eyeOpen > 0.17,
    frame: (img?.frame ?? 0) >= 0.35 && inFrame,
    centered: Math.abs(cx - 0.5) < 0.09 && cy > 0.28 && cy < 0.58 && Math.abs(face.rollDeg) < 3 && Math.abs(face.yawDeg) < 6 && Math.abs(face.pitchDeg) < 10,
    gaze: face.gaze < 0.12,
    distance: faceW >= 0.4 && faceW <= 0.72 && inFrame,
    light: img ? img.light >= 70 && img.light <= 215 && img.sharp >= 25 : true,
  };

  let hint: string | null = null;
  if (!checks.eyes) hint = 'cz.hint.openEyes';
  else if (faceW < 0.4) hint = 'cz.hint.closer';
  else if (faceW > 0.72 || !inFrame) hint = 'cz.hint.farther';
  else if (Math.abs(face.rollDeg) >= 3) hint = 'cz.hint.straightenHead';
  else if (Math.abs(face.yawDeg) >= 6) hint = 'cz.hint.faceCamera';
  else if (Math.abs(face.pitchDeg) >= 10) hint = 'cz.hint.eyeLevel';
  else if (Math.abs(cx - 0.5) >= 0.09 || cy <= 0.28 || cy >= 0.58) hint = 'cz.hint.center';
  else if (!checks.gaze) hint = 'cz.hint.lookAtLens';
  else if (img && img.light < 70) hint = 'cz.hint.moreLight';
  else if (img && img.light > 215) hint = 'cz.hint.lessLight';
  else if (img && img.sharp < 25) hint = 'cz.hint.holdStill';
  else if (!checks.frame) hint = 'cz.hint.frameVisible';

  const w: Record<CheckKey, number> = { face: 15, eyes: 15, frame: 10, centered: 20, gaze: 10, distance: 20, light: 10 };
  const quality = CHECK_ORDER.reduce((s, k) => s + (checks[k] ? w[k] : 0), 0);
  return { face, checks, hint, quality, gauge, distanceCm };
}

/**
 * Interface caméra plein écran de l'assistant de centrage : flux en direct,
 * gabarit de positionnement, guidage en temps réel et score de qualité.
 */
export function CameraCapture({
  onCapture,
  onClose,
}: {
  onCapture: (photo: HTMLCanvasElement) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  /** Cause du refus de la caméra (null = caméra active). */
  const [camError, setCamError] = useState<CamError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const photoRef = useRef<HTMLInputElement>(null);
  const [engine, setEngine] = useState<'loading' | 'ready' | 'off'>('loading');
  const [torch, setTorch] = useState<{ available: boolean; on: boolean }>({ available: false, on: false });
  const [live, setLive] = useState<Live>(EMPTY);
  const [dims, setDims] = useState({ w: 1280, h: 720 });
  const [auto, setAuto] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const goodSince = useRef<number | null>(null);
  const [showChecks, setShowChecks] = useState(false);

  /* ---------- Caméra ---------- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setCamError(null);
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setCamError('unsupported');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1440 } },
          audio: false,
        });
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        streamRef.current = stream;
        const v = videoRef.current!;
        v.srcObject = stream;
        await v.play();
        setDims({ w: v.videoWidth || 1280, h: v.videoHeight || 720 });
        const track = stream.getVideoTracks()[0];
        const caps = (track?.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean };
        setTorch({ available: Boolean(caps.torch), on: false });
      } catch (e) {
        const name = (e as { name?: string })?.name ?? '';
        setCamError(
          name === 'NotAllowedError' || name === 'SecurityError'
            ? 'denied'
            : name === 'NotFoundError' || name === 'OverconstrainedError'
              ? 'notFound'
              : name === 'NotReadableError' || name === 'AbortError'
                ? 'busy'
                : 'other',
        );
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [facing, attempt]);

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torch.on } as MediaTrackConstraintSet] });
      setTorch((t) => ({ ...t, on: !t.on }));
    } catch {
      setTorch({ available: false, on: false });
    }
  }

  /* ---------- Capture ---------- */
  const capture = useCallback(() => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const k = Math.min(1, CAPTURE_MAX / Math.max(v.videoWidth, v.videoHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(v.videoWidth * k);
    c.height = Math.round(v.videoHeight * k);
    c.getContext('2d')!.drawImage(v, 0, 0, c.width, c.height);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    onCapture(c);
  }, [onCapture]);

  function importFile(file?: File | null) {
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, CAPTURE_MAX / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * k);
      c.height = Math.round(img.naturalHeight * k);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      onCapture(c);
    };
    img.src = URL.createObjectURL(file);
  }

  /* ---------- Analyse en continu ---------- */
  useEffect(() => {
    let raf = 0;
    let stop = false;
    let lastDetect = 0;
    let lastImg = 0;
    let lastUi = 0;
    let img: { light: number; sharp: number; frame: number } | null = null;
    let face: FaceAnalysis | null = null;
    let landmarker: Awaited<ReturnType<typeof getLandmarker>> | null = null;

    getLandmarker('VIDEO')
      .then((l) => { if (!stop) { landmarker = l; setEngine('ready'); } })
      .catch(() => { if (!stop) setEngine('off'); });

    const loop = () => {
      if (stop) return;
      raf = requestAnimationFrame(loop);
      const v = videoRef.current;
      if (!v || v.readyState < 2 || !v.videoWidth) return;
      const now = performance.now();
      if (landmarker && now - lastDetect > 70) {
        lastDetect = now;
        try {
          const fp = toFacePoints(landmarker.detectForVideo(v, now), v.videoWidth, v.videoHeight);
          face = fp ? analyzeFace(fp) : null;
        } catch {
          face = null;
        }
      }
      // Luminosité, netteté et présence de la monture : 2 fois par seconde, sur une image réduite.
      if (face && now - lastImg > 500) {
        lastImg = now;
        const g = toGray(v, v.videoWidth, v.videoHeight, 420);
        const fb = face.faceBox;
        const eyeBox = {
          x0: Math.min(face.pupilR.x, face.pupilL.x) - 0.3 * face.pdPx,
          x1: Math.max(face.pupilR.x, face.pupilL.x) + 0.3 * face.pdPx,
          y0: face.pupilR.y - 0.25 * face.pdPx,
          y1: face.pupilR.y + 0.25 * face.pdPx,
        };
        const rims = detectRims(g, face);
        img = {
          light: brightness(g, { x0: fb.x0, x1: fb.x1, y0: fb.y0, y1: fb.y1 }),
          sharp: sharpness(g, eyeBox),
          frame: ((rims.conf.rBottom ?? 0) + (rims.conf.lBottom ?? 0)) / 2,
        };
      }
      if (now - lastUi > 120) {
        lastUi = now;
        const next = evaluate(face, v.videoWidth, v.videoHeight, img);
        setLive(next);
        goodSince.current = next.quality >= 85 ? goodSince.current ?? now : null;
      }
    };
    raf = requestAnimationFrame(loop);
    return () => {
      stop = true;
      cancelAnimationFrame(raf);
    };
  }, []);

  // Capture automatique : conditions optimales tenues 1,2 s, puis compte à rebours.
  useEffect(() => {
    if (!auto || engine !== 'ready') { setCountdown(null); return; }
    const t = setInterval(() => {
      const since = goodSince.current;
      if (!since) { setCountdown(null); return; }
      const held = performance.now() - since;
      if (held >= 2400) { clearInterval(t); capture(); }
      else if (held >= 1200) setCountdown(Math.ceil((2400 - held) / 400));
      else setCountdown(null);
    }, 100);
    return () => clearInterval(t);
  }, [auto, engine, capture]);

  const optimal = engine === 'ready' && live.quality >= 85;
  const passed = CHECK_ORDER.filter((k) => live.checks[k]).length;
  const f = live.face;
  const tone = live.quality >= 85 ? '#22c55e' : live.quality >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black text-white" role="dialog" aria-label={tr('cz.title')}>
      {/* Barre supérieure */}
      <div className="relative z-10 flex items-center gap-2 px-3 py-2" style={{ paddingTop: 'calc(0.5rem + env(safe-area-inset-top))' }}>
        <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-white/10 hover:bg-white/20" aria-label={tr('cz.back')}>
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{tr('cz.title')}</p>
          <p className="truncate text-[11px] text-white/60">
            {engine === 'loading' ? tr('cz.engineLoading') : engine === 'off' ? tr('cz.engineOff') : tr('cz.engineReady')}
          </p>
        </div>
        {torch.available && (
          <button type="button" onClick={toggleTorch} className={`grid h-10 w-10 place-items-center rounded-full ${torch.on ? 'bg-amber-400 text-black' : 'bg-white/10'}`} aria-label={tr('cz.flash')}>
            {torch.on ? <Flashlight className="h-5 w-5" /> : <FlashlightOff className="h-5 w-5" />}
          </button>
        )}
        <button type="button" onClick={() => setFacing((x) => (x === 'user' ? 'environment' : 'user'))} className="grid h-10 w-10 place-items-center rounded-full bg-white/10" aria-label={tr('cz.switchCamera')}>
          <RefreshCw className="h-5 w-5" />
        </button>
      </div>

      {/* Zone vidéo */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {/* Toujours présente : « Réessayer » doit retrouver l'élément vidéo. */}
        <video ref={videoRef} playsInline muted className={`absolute inset-0 h-full w-full object-cover ${camError ? 'hidden' : ''}`} />
        {camError ? (
          <div className="grid h-full place-items-center overflow-y-auto p-6 text-center">
            <div className="max-w-sm space-y-4">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-amber-400/15 text-amber-300">
                <CameraOff className="h-7 w-7" />
              </span>
              <p className="text-base font-semibold">{tr(`cz.camErr.${camError}.title`)}</p>
              <p className="text-sm text-white/75">
                {tr(`cz.camErr.${camError}.body${camError === 'denied' ? (isNative() ? 'App' : 'Web') : ''}`)}
              </p>
              {/* Solution qui marche partout : l'appareil photo du téléphone, sans flux vidéo. */}
              <button type="button" onClick={() => photoRef.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black">
                <Camera className="h-5 w-5" /> {tr('cz.takePhotoNative')}
              </button>
              <div className="flex gap-2">
                <button type="button" onClick={() => setAttempt((n) => n + 1)} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2.5 text-sm font-medium">
                  <RotateCcw className="h-4 w-4" /> {tr('cz.retry')}
                </button>
                <button type="button" onClick={() => importRef.current?.click()} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2.5 text-sm font-medium">
                  <ImagePlus className="h-4 w-4" /> {tr('cz.import')}
                </button>
              </div>
              <p className="text-xs text-white/50">{tr('cz.photoModeHint')}</p>
            </div>
          </div>
        ) : (
          <>
            {/* Points détectés, dans le repère de la vidéo (même recadrage que object-cover). */}
            <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${dims.w} ${dims.h}`} preserveAspectRatio="xMidYMid slice">
              {f && (
                <>
                  <line x1={f.pupilR.x - f.pdPx * 0.6} y1={f.pupilR.y - (f.pupilL.y - f.pupilR.y) * 0.6} x2={f.pupilL.x + f.pdPx * 0.6} y2={f.pupilL.y + (f.pupilL.y - f.pupilR.y) * 0.6} stroke={tone} strokeWidth={dims.w / 500} strokeDasharray={`${dims.w / 120} ${dims.w / 240}`} />
                  {[f.pupilR, f.pupilL].map((p, i) => (
                    <g key={i}>
                      <circle cx={p.x} cy={p.y} r={f.irisPx * 0.75} fill="none" stroke={tone} strokeWidth={dims.w / 600} />
                      <circle cx={p.x} cy={p.y} r={dims.w / 400} fill={tone} />
                    </g>
                  ))}
                  <line x1={f.bridge.x} y1={f.faceBox.y0} x2={f.bridge.x} y2={f.faceBox.y1} stroke="white" strokeOpacity={0.35} strokeWidth={dims.w / 900} strokeDasharray={`${dims.w / 150} ${dims.w / 150}`} />
                </>
              )}
            </svg>
            {/* Gabarit fixe de positionnement : contour de tête, ligne des yeux, zones OD / OG. */}
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="relative aspect-[3/4] h-[78%] max-w-[86%]">
                <div className="absolute inset-0 rounded-[48%] border-2 transition-colors" style={{ borderColor: optimal ? '#22c55e' : 'rgba(255,255,255,.55)' }} />
                <div className="absolute inset-x-[-12%] top-[40%] border-t border-dashed border-white/60" />
                <span className="absolute left-[18%] top-[40%] -translate-x-1/2 -translate-y-[130%] rounded bg-black/50 px-1.5 text-[11px] font-bold">OD</span>
                <span className="absolute right-[18%] top-[40%] translate-x-1/2 -translate-y-[130%] rounded bg-black/50 px-1.5 text-[11px] font-bold">OG</span>
                <span className="absolute left-[18%] top-[40%] h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/50" />
                <span className="absolute right-[18%] top-[40%] h-7 w-7 translate-x-1/2 -translate-y-1/2 rounded-full border border-white/50" />
                <span className="absolute inset-x-[8%] top-[5%] h-[15%] rounded-md border border-dashed border-amber-300/70" />
                <span className="absolute left-1/2 top-[5%] -translate-x-1/2 -translate-y-full pb-0.5 text-[10px] text-amber-200">{tr('cz.cardZone')}</span>
              </div>
            </div>

            {/* Contrôles en temps réel : liste complète sur tablette / ordinateur,
                pastille repliable sur téléphone pour ne pas masquer le visage. */}
            <button
              type="button"
              onClick={() => setShowChecks((v) => !v)}
              className={`absolute left-2 top-2 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold backdrop-blur sm:hidden ${passed === CHECK_ORDER.length ? 'bg-emerald-500/30 text-emerald-100' : 'bg-black/55 text-white'}`}
            >
              {passed === CHECK_ORDER.length ? <Check className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5 text-amber-300" />}
              {passed}/{CHECK_ORDER.length}
            </button>
            <ul className={`absolute left-2 top-10 space-y-1 sm:left-4 sm:top-4 sm:block ${showChecks ? 'block' : 'hidden'}`}>
              {CHECK_ORDER.map((k) => (
                <li key={k} className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium backdrop-blur ${live.checks[k] ? 'bg-emerald-500/25 text-emerald-100' : 'bg-black/45 text-white/75'}`}>
                  {live.checks[k] ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <AlertTriangle className="h-3.5 w-3.5 text-amber-300" />}
                  {tr(`cz.check.${k}`)}
                </li>
              ))}
            </ul>

            {/* Jauge de distance */}
            <div className="absolute right-1.5 top-2 flex flex-col items-center gap-1 opacity-90 sm:right-4 sm:top-1/2 sm:-translate-y-1/2">
              <span className="text-[10px] text-white/70">{tr('cz.near')}</span>
              <div className="relative h-24 w-2.5 sm:h-40 overflow-hidden rounded-full bg-gradient-to-b from-red-500 via-emerald-500 to-red-500">
                <span className="absolute left-1/2 h-1.5 w-5 -translate-x-1/2 rounded-full bg-white shadow" style={{ top: `${(1 - live.gauge) * 100}%` }} />
                <span className="absolute inset-x-0 top-[38%] h-[24%] border-y border-white/70" />
              </div>
              <span className="text-[10px] text-white/70">{tr('cz.far')}</span>
              {live.distanceCm != null && <span className="mt-1 rounded bg-black/50 px-1.5 text-[11px]">≈ {live.distanceCm} cm</span>}
            </div>

            {countdown != null && (
              <div className="pointer-events-none absolute inset-0 grid place-items-center">
                <span className="grid h-24 w-24 place-items-center rounded-full bg-black/40 font-display text-5xl font-bold">{countdown}</span>
              </div>
            )}
            {engine === 'loading' && (
              <div className="absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 text-xs">
                <Loader2 className="h-4 w-4 animate-spin" /> {tr('cz.engineLoading')}
              </div>
            )}
          </>
        )}
      </div>

      {/* Bas : consigne, qualité, capture (masqué si la caméra est indisponible) */}
      <div className={`relative z-10 ${camError ? 'hidden' : ''} space-y-3 bg-gradient-to-t from-black via-black/90 to-black/60 px-4 pb-4 pt-3`} style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
        <p className={`text-center text-sm font-semibold ${optimal ? 'text-emerald-300' : 'text-amber-200'}`}>
          {engine === 'off' ? tr('cz.hint.manualOnly') : optimal ? tr('cz.hint.ready') : tr(live.hint ?? 'cz.hint.searching')}
        </p>
        <div className="mx-auto flex max-w-md items-center gap-3">
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-white/60">{tr('cz.quality')}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/15">
            <div className="h-full rounded-full transition-all duration-300" style={{ width: `${live.quality}%`, background: tone }} />
          </div>
          <span className="w-10 shrink-0 text-right font-mono text-sm font-bold" style={{ color: tone }}>{live.quality} %</span>
        </div>
        <div className="mx-auto flex max-w-md items-center justify-between">
          <button type="button" onClick={() => importRef.current?.click()} className="flex w-20 flex-col items-center gap-1 text-[11px] text-white/80">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-white/10"><ImagePlus className="h-5 w-5" /></span>
            {tr('cz.import')}
          </button>
          <button
            type="button"
            onClick={capture}
            disabled={!!camError}
            aria-label={tr('cz.capture')}
            className={`grid h-[72px] w-[72px] place-items-center rounded-full border-4 transition disabled:opacity-40 ${optimal ? 'border-emerald-400 shadow-[0_0_30px_rgba(34,197,94,.6)]' : 'border-white'}`}
          >
            <span className={`h-14 w-14 rounded-full ${optimal ? 'bg-emerald-400' : 'bg-white/90'}`} />
          </button>
          <button type="button" onClick={() => setAuto((a) => !a)} disabled={engine !== 'ready'} className="flex w-20 flex-col items-center gap-1 text-[11px] text-white/80 disabled:opacity-40">
            <span className={`grid h-11 w-11 place-items-center rounded-full ${auto ? 'bg-emerald-500 text-black' : 'bg-white/10'}`}><Timer className="h-5 w-5" /></span>
            {tr('cz.autoCapture')}
          </button>
        </div>
      </div>
      <input ref={importRef} type="file" accept="image/*" className="hidden" onChange={(e) => importFile(e.target.files?.[0])} />
      {/* Appareil photo natif (capture) : fonctionne aussi quand le flux vidéo est refusé. */}
      <input ref={photoRef} type="file" accept="image/*" capture={facing === 'user' ? 'user' : 'environment'} className="hidden" onChange={(e) => importFile(e.target.files?.[0])} />
    </div>
  );
}
