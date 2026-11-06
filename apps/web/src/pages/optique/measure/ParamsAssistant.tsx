import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { Camera, Check, Image as ImageIcon, RotateCcw, Smartphone, X, ScanLine, MoveHorizontal, Glasses } from 'lucide-react';
import { fileToResizedDataUrl } from '../../../lib/image';

/**
 * Assistant des paramètres individuels (verre-œil, angle pantoscopique, galbe,
 * écart pupillaire de près), à la manière des outils de mesure sur tablette :
 *
 * - Profil : photo de côté, 3 points (haut et bas du verre, sommet de la
 *   cornée). La hauteur B du verre, déjà mesurée de face, sert d'étalon :
 *   le verre vu par la tranche mesure B, d'où l'échelle mm/pixel. On en tire
 *   l'inclinaison du verre (pantoscopique) et la distance cornée-verre.
 * - Dessus : photo prise au-dessus de la tête, 4 points (bords temporal et
 *   nasal de chaque verre) ; le galbe est l'angle moyen de chaque verre avec
 *   la ligne qui relie les bords nasaux.
 * - Capteur : le dos du téléphone posé à plat contre les verres, son
 *   inclinomètre donne directement l'angle pantoscopique.
 * - Près : EP de près = EP × d / (d + verre-œil + 13,5 mm), le centre de
 *   rotation de l'œil étant ~13,5 mm derrière la cornée.
 *
 * Valeurs ESTIMÉES : l'opticien les vérifie avant de les reporter.
 */
export interface ParamsResult {
  vertex: number | null;
  pantoTilt: number | null;
  wrapAngle: number | null;
  nearPd: number | null;
}

type Pt = { x: number; y: number };
type Tab = 'profile' | 'top' | 'sensor' | 'near';

const round1 = (n: number) => Math.round(n * 10) / 10;
const deg = (r: number) => (r * 180) / Math.PI;

/** Image cliquable : renvoie les points en coordonnées de l'image. */
function PointPicker({ src, points, max, labels, onAdd }: { src: string; points: Pt[]; max: number; labels: string[]; onAdd: (p: Pt) => void }) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [size, setSize] = useState({ w: 1, h: 1 });
  const click = (e: React.MouseEvent) => {
    if (points.length >= max || !imgRef.current) return;
    const r = imgRef.current.getBoundingClientRect();
    onAdd({ x: ((e.clientX - r.left) / r.width) * size.w, y: ((e.clientY - r.top) / r.height) * size.h });
  };
  const COLORS = ['#f472b6', '#a78bfa', '#34d399', '#fbbf24'];
  return (
    <div className="relative mx-auto w-fit max-w-full cursor-crosshair select-none" onClick={click}>
      <img ref={imgRef} src={src} alt="" className="block max-h-[52vh] max-w-full rounded-xl" onLoad={(e) => setSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} draggable={false} />
      <svg viewBox={`0 0 ${size.w} ${size.h}`} className="pointer-events-none absolute inset-0 h-full w-full">
        {points.length >= 2 && <line x1={points[0]!.x} y1={points[0]!.y} x2={points[1]!.x} y2={points[1]!.y} stroke="#f472b6" strokeWidth={size.w / 300} />}
        {max === 4 && points.length >= 3 && <line x1={points[1]!.x} y1={points[1]!.y} x2={points[2]!.x} y2={points[2]!.y} stroke="#fbbf24" strokeWidth={size.w / 300} strokeDasharray={`${size.w / 120}`} />}
        {max === 4 && points.length >= 4 && <line x1={points[2]!.x} y1={points[2]!.y} x2={points[3]!.x} y2={points[3]!.y} stroke="#34d399" strokeWidth={size.w / 300} />}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={size.w / 90} fill="none" stroke={COLORS[i % 4]} strokeWidth={size.w / 400} />
            <circle cx={p.x} cy={p.y} r={size.w / 400} fill={COLORS[i % 4]} />
          </g>
        ))}
      </svg>
      <p className="mt-2 text-center text-xs text-white/70">
        {points.length < max ? (
          <>
            Point {points.length + 1}/{max} : <b className="text-white">{labels[points.length]}</b>
          </>
        ) : (
          'Tous les points sont placés.'
        )}
      </p>
    </div>
  );
}

function PhotoInput({ onPhoto }: { onPhoto: (src: string) => void }) {
  const cam = useRef<HTMLInputElement>(null);
  const gal = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState('');
  const take = async (f?: File) => {
    if (!f) return;
    setErr('');
    try {
      onPhoto(await fileToResizedDataUrl(f, 1600, 1_500_000, { anyImage: true, maxInputBytes: 30 * 1024 * 1024 }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Photo illisible');
    }
  };
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 py-6">
      <button type="button" onClick={() => cam.current?.click()} className="flex h-11 items-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white">
        <Camera className="h-4 w-4" /> Prendre la photo
      </button>
      <button type="button" onClick={() => gal.current?.click()} className="flex h-11 items-center gap-2 rounded-xl border border-white/20 px-4 text-sm text-white/80">
        <ImageIcon className="h-4 w-4" /> Galerie
      </button>
      <input ref={cam} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { void take(e.target.files?.[0]); e.target.value = ''; }} />
      <input ref={gal} type="file" accept="image/*" className="hidden" onChange={(e) => { void take(e.target.files?.[0]); e.target.value = ''; }} />
      {err && <p className="w-full text-center text-xs text-red-300">{err}</p>}
    </div>
  );
}

function Result({ label, value, unit, hint }: { label: string; value: number | null; unit: string; hint?: string }) {
  return (
    <div className="rounded-xl bg-white/5 px-3 py-2">
      <p className="text-[11px] text-white/50">{label}</p>
      <p className="font-mono text-xl font-bold text-white">
        {value == null ? '—' : value.toFixed(1)} <span className="text-xs text-white/40">{unit}</span>
      </p>
      {hint && <p className="text-[10px] text-white/40">{hint}</p>}
    </div>
  );
}

/** Profil : panto + verre-œil à partir de 3 points et de la hauteur B. */
export function profileCompute(p: Pt[], lensHeightMm: number): { panto: number; vertex: number } | null {
  if (p.length < 3 || !(lensHeightMm > 0)) return null;
  const [top, bot, cornea] = p as [Pt, Pt, Pt];
  const vx = bot.x - top.x, vy = bot.y - top.y;
  const len = Math.hypot(vx, vy);
  if (len < 5) return null;
  const scale = lensHeightMm / len;
  // Côté du visage : là où se trouve la cornée par rapport au verre.
  const mid = { x: (top.x + bot.x) / 2, y: (top.y + bot.y) / 2 };
  const face = Math.sign(cornea.x - mid.x) || 1;
  const tilt = deg(Math.atan2(Math.abs(vx), Math.abs(vy)));
  // Pantoscopique positif quand le bas du verre se rapproche de la joue.
  const panto = Math.sign(vx) === face ? tilt : -tilt;
  const dist = Math.abs(vy * cornea.x - vx * cornea.y + bot.x * top.y - bot.y * top.x) / len;
  return { panto: round1(panto) || 0, vertex: round1(dist * scale) };
}

/** Dessus : galbe moyen à partir des bords temporal/nasal de chaque verre. */
export function wrapCompute(p: Pt[]): number | null {
  if (p.length < 4) return null;
  const [rt, rn, ln, lt] = p as [Pt, Pt, Pt, Pt];
  const angle = (a: Pt, b: Pt, c: Pt, d: Pt) => {
    const u = { x: b.x - a.x, y: b.y - a.y }, v = { x: d.x - c.x, y: d.y - c.y };
    const cos = (u.x * v.x + u.y * v.y) / (Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y) || 1);
    return deg(Math.acos(Math.max(-1, Math.min(1, cos))));
  };
  // Ligne de référence : bord nasal droit → bord nasal gauche.
  const right = angle(rn, ln, rt, rn); // verre droit, du temporal vers le nasal
  const left = angle(rn, ln, ln, lt); // verre gauche, du nasal vers le temporal
  return round1((right + left) / 2);
}

export function nearPdCompute(pd: number, vertex: number | null, distanceCm: number): number | null {
  if (!(pd > 0) || !(distanceCm > 0)) return null;
  const d = distanceCm * 10;
  return round1((pd * d) / (d + (vertex ?? 12) + 13.5));
}

export function ParamsAssistant({
  pdTotal,
  lensHeight,
  initial,
  onApply,
  onClose,
}: {
  pdTotal: number | null;
  lensHeight: number | null;
  initial: ParamsResult;
  onApply: (r: ParamsResult) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>('profile');
  const [res, setRes] = useState<ParamsResult>(initial);
  const [profSrc, setProfSrc] = useState<string | null>(null);
  const [profPts, setProfPts] = useState<Pt[]>([]);
  const [bMm, setBMm] = useState<number>(lensHeight ?? 0);
  const [topSrc, setTopSrc] = useState<string | null>(null);
  const [topPts, setTopPts] = useState<Pt[]>([]);
  const [dist, setDist] = useState(40);
  const [pd, setPd] = useState<number>(pdTotal ?? 0);
  const [beta, setBeta] = useState<number | null>(null);
  const [sensorErr, setSensorErr] = useState('');
  const [listening, setListening] = useState(false);

  const prof = profileCompute(profPts, bMm);
  const wrap = wrapCompute(topPts);
  const near = nearPdCompute(pd, res.vertex, dist);
  const sensorPanto = beta == null ? null : round1(Math.max(-30, Math.min(30, 90 - beta)));

  useEffect(() => {
    if (!listening) return;
    const h = (e: DeviceOrientationEvent) => {
      if (e.beta != null) setBeta(e.beta);
    };
    window.addEventListener('deviceorientation', h);
    return () => window.removeEventListener('deviceorientation', h);
  }, [listening]);

  async function startSensor() {
    setSensorErr('');
    const D = window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> } | undefined;
    if (!D) return setSensorErr('Ce navigateur n’a pas de capteur d’inclinaison. Utilisez la photo de profil.');
    try {
      if (typeof D.requestPermission === 'function') {
        const r = await D.requestPermission();
        if (r !== 'granted') return setSensorErr('Accès au capteur refusé.');
      }
      setListening(true);
      setTimeout(() => setBeta((b) => { if (b == null) setSensorErr('Aucune donnée du capteur : utilisez un téléphone ou une tablette.'); return b; }), 1500);
    } catch {
      setSensorErr('Capteur indisponible.');
    }
  }

  const TABS: { k: Tab; label: string; icon: typeof Camera }[] = [
    { k: 'profile', label: 'Profil', icon: ScanLine },
    { k: 'top', label: 'Galbe', icon: MoveHorizontal },
    { k: 'sensor', label: 'Capteur', icon: Smartphone },
    { k: 'near', label: 'EP de près', icon: Glasses },
  ];

  const useBtn = (onClick: () => void, disabled: boolean) => (
    <button type="button" disabled={disabled} onClick={onClick} className="flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white disabled:opacity-40">
      <Check className="h-4 w-4" /> Utiliser ces valeurs
    </button>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-3">
      <div className="flex max-h-[96vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#11141b] text-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div>
            <p className="font-semibold">Assistant des paramètres individuels</p>
            <p className="text-[11px] text-white/50">Verre-œil, angle pantoscopique, galbe et EP de près, mesurés au téléphone.</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-white/10" aria-label="Fermer">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex gap-1 border-b border-white/10 px-3 pt-2">
          {TABS.map((t) => (
            <button key={t.k} type="button" onClick={() => setTab(t.k)} className={clsx('flex items-center gap-1.5 rounded-t-lg px-3 py-2 text-sm', tab === t.k ? 'bg-white/10 font-semibold text-white' : 'text-white/55 hover:text-white')}>
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {tab === 'profile' && (
            <div className="space-y-3">
              <ol className="list-decimal space-y-1 pl-5 text-xs text-white/70">
                <li>Le client porte la monture ajustée et regarde droit devant, tête naturelle.</li>
                <li>Photographiez-le exactement de côté, téléphone tenu bien droit, à hauteur des yeux.</li>
                <li>Cliquez : haut du verre, bas du verre (face arrière), puis le sommet de la cornée.</li>
              </ol>
              {!profSrc ? (
                <PhotoInput onPhoto={(s) => { setProfSrc(s); setProfPts([]); }} />
              ) : (
                <>
                  <PointPicker src={profSrc} points={profPts} max={3} labels={['haut du verre', 'bas du verre', 'sommet de la cornée']} onAdd={(p) => setProfPts((x) => [...x, p])} />
                  <div className="flex flex-wrap items-end gap-3">
                    <label className="text-xs text-white/60">
                      Hauteur du verre B (étalon)
                      <span className="mt-1 flex items-center gap-1">
                        <input type="number" step="0.5" className="h-9 w-20 rounded-lg border border-white/15 bg-black/40 px-2 text-right font-mono text-sm text-white" value={bMm || ''} onChange={(e) => setBMm(Number(e.target.value) || 0)} />
                        <span className="text-[10px] text-white/40">mm</span>
                      </span>
                    </label>
                    <button type="button" onClick={() => setProfPts([])} className="flex h-9 items-center gap-1.5 rounded-lg border border-white/15 px-3 text-xs text-white/70">
                      <RotateCcw className="h-3.5 w-3.5" /> Replacer les points
                    </button>
                    <button type="button" onClick={() => { setProfSrc(null); setProfPts([]); }} className="h-9 rounded-lg px-3 text-xs text-white/60">Autre photo</button>
                  </div>
                  {!(bMm > 0) && <p className="text-xs text-amber-200">Indiquez la hauteur B du verre (mesurée de face) pour obtenir le verre-œil.</p>}
                  <div className="grid grid-cols-2 gap-2">
                    <Result label="Angle pantoscopique" value={prof?.panto ?? null} unit="°" hint="habituel : 6° à 12°" />
                    <Result label="Distance verre-œil" value={prof?.vertex ?? null} unit="mm" hint="habituel : 10 à 14 mm" />
                  </div>
                  {useBtn(() => prof && setRes((r) => ({ ...r, pantoTilt: prof.panto, vertex: prof.vertex })), !prof)}
                </>
              )}
            </div>
          )}

          {tab === 'top' && (
            <div className="space-y-3">
              <ol className="list-decimal space-y-1 pl-5 text-xs text-white/70">
                <li>Photographiez la monture portée vue du dessus (téléphone au-dessus de la tête, parallèle au sol).</li>
                <li>Cliquez dans l’ordre : bord temporal du verre droit, son bord nasal, bord nasal du verre gauche, son bord temporal.</li>
              </ol>
              {!topSrc ? (
                <PhotoInput onPhoto={(s) => { setTopSrc(s); setTopPts([]); }} />
              ) : (
                <>
                  <PointPicker src={topSrc} points={topPts} max={4} labels={['bord temporal du verre droit', 'bord nasal du verre droit', 'bord nasal du verre gauche', 'bord temporal du verre gauche']} onAdd={(p) => setTopPts((x) => [...x, p])} />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setTopPts([])} className="flex h-9 items-center gap-1.5 rounded-lg border border-white/15 px-3 text-xs text-white/70">
                      <RotateCcw className="h-3.5 w-3.5" /> Replacer les points
                    </button>
                    <button type="button" onClick={() => { setTopSrc(null); setTopPts([]); }} className="h-9 rounded-lg px-3 text-xs text-white/60">Autre photo</button>
                  </div>
                  <Result label="Angle de galbe" value={wrap} unit="°" hint="monture classique : 0° à 8° · sport : 15° et plus" />
                  {useBtn(() => wrap != null && setRes((r) => ({ ...r, wrapAngle: wrap })), wrap == null)}
                </>
              )}
            </div>
          )}

          {tab === 'sensor' && (
            <div className="space-y-3">
              <ol className="list-decimal space-y-1 pl-5 text-xs text-white/70">
                <li>Le client regarde droit devant, tête naturelle.</li>
                <li>Posez le dos du téléphone à plat contre les deux verres, écran vers vous.</li>
                <li>Quand la valeur est stable, appuyez sur « Utiliser ».</li>
              </ol>
              {!listening ? (
                <button type="button" onClick={() => void startSensor()} className="flex h-11 items-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-semibold">
                  <Smartphone className="h-4 w-4" /> Activer le capteur d’inclinaison
                </button>
              ) : (
                <div className="flex flex-col items-center gap-3 py-4">
                  {/* Niveau : la barre penche comme le téléphone. */}
                  <div className="relative h-40 w-40 rounded-full border-2 border-white/15">
                    <div className="absolute left-1/2 top-2 h-[calc(100%-1rem)] w-1 -translate-x-1/2 rounded bg-white/15" />
                    <div className="absolute left-1/2 top-2 h-[calc(100%-1rem)] w-1.5 -translate-x-1/2 origin-center rounded bg-pink-400" style={{ transform: `translateX(-50%) rotate(${-(sensorPanto ?? 0)}deg)` }} />
                  </div>
                  <Result label="Angle pantoscopique (capteur)" value={sensorPanto} unit="°" />
                </div>
              )}
              {sensorErr && <p className="text-xs text-amber-200">{sensorErr}</p>}
              {useBtn(() => sensorPanto != null && setRes((r) => ({ ...r, pantoTilt: sensorPanto })), sensorPanto == null)}
            </div>
          )}

          {tab === 'near' && (
            <div className="space-y-3">
              <p className="text-xs text-white/70">
                L’écart pupillaire de près se déduit de l’EP de loin, de la distance de lecture et du verre-œil (convergence des yeux).
              </p>
              <div className="grid grid-cols-3 gap-3">
                <label className="text-xs text-white/60">
                  EP de loin (mm)
                  <input type="number" step="0.5" className="mt-1 h-9 w-full rounded-lg border border-white/15 bg-black/40 px-2 text-right font-mono text-sm text-white" value={pd || ''} onChange={(e) => setPd(Number(e.target.value) || 0)} />
                </label>
                <label className="text-xs text-white/60">
                  Distance de lecture (cm)
                  <input type="number" step="1" className="mt-1 h-9 w-full rounded-lg border border-white/15 bg-black/40 px-2 text-right font-mono text-sm text-white" value={dist} onChange={(e) => setDist(Number(e.target.value) || 0)} />
                </label>
                <label className="text-xs text-white/60">
                  Verre-œil (mm)
                  <input type="number" step="0.5" className="mt-1 h-9 w-full rounded-lg border border-white/15 bg-black/40 px-2 text-right font-mono text-sm text-white" value={res.vertex ?? ''} placeholder="12" onChange={(e) => setRes((r) => ({ ...r, vertex: Number(e.target.value) || null }))} />
                </label>
              </div>
              <Result label="EP de près estimé" value={near} unit="mm" hint="lecture à 40 cm : souvent 3 à 4 mm de moins que de loin" />
              {useBtn(() => near != null && setRes((r) => ({ ...r, nearPd: near })), near == null)}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-4 py-3">
          <p className="font-mono text-xs text-white/70">
            Verre-œil {res.vertex ?? '—'} mm · Panto {res.pantoTilt ?? '—'}° · Galbe {res.wrapAngle ?? '—'}° · EP près {res.nearPd ?? '—'} mm
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="h-10 rounded-xl px-4 text-sm text-white/70">Annuler</button>
            <button type="button" onClick={() => { onApply(res); onClose(); }} className="h-10 rounded-xl bg-violet-600 px-4 text-sm font-semibold">
              Reporter dans la fiche
            </button>
          </div>
        </div>
        <p className="border-t border-white/10 px-4 py-2 text-[10px] text-white/40">Aide à la mesure pour professionnels de l’optique : valeurs estimées à vérifier, pas un dispositif médical.</p>
      </div>
    </div>
  );
}
