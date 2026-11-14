import { z } from 'zod';

/* ==========================================================================
 * OculoLab — tracé de forme de monture et fiche précal.
 *
 * Convention unique pour toute l'application (et identique au format OMA/VCA
 * lu par les meuleuses et les laboratoires) :
 *   - la forme stockée est celle du verre DROIT vu de face (côté porteur) ;
 *   - TRACE_POINTS rayons en mm, à pas angulaire constant, depuis le CENTRE
 *     DE LA BOÎTE (boxing) ;
 *   - angle 0 = côté NASAL (à droite de l'observateur pour le verre droit),
 *     sens trigonométrique (vers le haut) ;
 *   - repère cartésien : x vers le nez, y vers le haut.
 * Le verre gauche est le symétrique du droit (miroir vertical).
 * ======================================================================== */

export const TRACE_POINTS = 360;

export const PRECAL_FRAME_TYPES = ['FULL_RIM', 'SEMI_RIMLESS', 'RIMLESS'] as const;
export type FrameType = (typeof PRECAL_FRAME_TYPES)[number];

export const TRACE_SOURCES = ['PHOTO', 'TEMPLATE', 'OMA'] as const;
export type TraceSource = (typeof TRACE_SOURCES)[number];

export const TRACE_STATUSES = ['DRAFT', 'SENT'] as const;
export type TraceStatus = (typeof TRACE_STATUSES)[number];

export const PRECAL_DESIGNS = ['SINGLE_VISION', 'PROGRESSIVE', 'OFFICE', 'BIFOCAL'] as const;
export type LensDesign = (typeof PRECAL_DESIGNS)[number];

/** Indices de réfraction proposés (avec l'épaisseur centre minimale usuelle d'un verre négatif). */
export const PRECAL_INDICES = [1.5, 1.56, 1.6, 1.67, 1.74] as const;
const MINUS_CENTER_MM: Record<number, number> = { 1.5: 2.0, 1.56: 1.8, 1.6: 1.6, 1.67: 1.5, 1.74: 1.4 };

/** Diamètres de palets usuels chez les laboratoires (mm). */
export const STANDARD_BLANKS = [50, 55, 60, 65, 70, 75, 80, 85] as const;

/** Marge de sécurité ajoutée au diamètre utile (biseau, meulage), en mm. */
export const BLANK_MARGIN_MM = 2;

export interface Pt2 {
  x: number;
  y: number;
}

const round2 = (v: number) => Math.round(v * 100) / 100;
const angleAt = (i: number, n = TRACE_POINTS) => (i * 2 * Math.PI) / n;

/** Points du contour (mm) depuis les rayons. */
export function radiiToPoints(radii: readonly number[], cx = 0, cy = 0): Pt2[] {
  return radii.map((r, i) => ({ x: cx + r * Math.cos(angleAt(i, radii.length)), y: cy + r * Math.sin(angleAt(i, radii.length)) }));
}

export interface Box {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
  cx: number;
  cy: number;
}

export function boxOf(points: readonly Pt2[]): Box {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}

/**
 * Rééchantillonne un contour fermé (forme étoilée autour de `center`) en
 * `n` rayons réguliers depuis ce centre : intersection de chaque rayon avec
 * le polygone, en gardant la plus lointaine.
 */
export function resampleRadii(points: readonly Pt2[], center: Pt2, n = TRACE_POINTS): number[] {
  const out: number[] = new Array(n).fill(0);
  const m = points.length;
  for (let i = 0; i < n; i++) {
    const a = angleAt(i, n);
    const dx = Math.cos(a), dy = Math.sin(a);
    let best = 0;
    for (let k = 0; k < m; k++) {
      const p = points[k]!, q = points[(k + 1) % m]!;
      const ex = q.x - p.x, ey = q.y - p.y;
      const den = dx * ey - dy * ex;
      if (Math.abs(den) < 1e-12) continue;
      const wx = p.x - center.x, wy = p.y - center.y;
      const t = (wx * ey - wy * ex) / den; // distance le long du rayon
      const u = (wx * dy - wy * dx) / den; // position sur le segment
      if (t > 0 && u >= -1e-9 && u <= 1 + 1e-9 && t > best) best = t;
    }
    out[i] = best;
  }
  return out;
}

/** Recentre un contour sur le centre de sa boîte et renvoie les rayons normalisés. */
export function toBoxedRadii(points: readonly Pt2[], n = TRACE_POINTS): number[] {
  const b = boxOf(points);
  return resampleRadii(points, { x: b.cx, y: b.cy }, n).map(round2);
}

export interface ShapeStats {
  /** Largeur de la boîte (calibre « A »), mm. */
  a: number;
  /** Hauteur de la boîte (« B »), mm. */
  b: number;
  /** Diamètre effectif : 2 × plus grand rayon depuis le centre de boîte, mm. */
  ed: number;
  /** Périmètre du contour, mm (contrôle du biseau). */
  circumference: number;
  /** Surface, mm². */
  area: number;
}

export function shapeStats(radii: readonly number[]): ShapeStats {
  const pts = radiiToPoints(radii);
  const b = boxOf(pts);
  let per = 0, area = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!, q = pts[(i + 1) % pts.length]!;
    per += Math.hypot(q.x - p.x, q.y - p.y);
    area += p.x * q.y - q.x * p.y;
  }
  return {
    a: round2(b.width),
    b: round2(b.height),
    ed: round2(2 * Math.max(...radii)),
    circumference: round2(per),
    area: round2(Math.abs(area) / 2),
  };
}

/** Met une forme aux cotes exactes A × B (cotes gravées sur la branche) : homothétie par axe. */
export function fitToBox(radii: readonly number[], a: number, b: number): number[] {
  const pts = radiiToPoints(radii);
  const box = boxOf(pts);
  if (box.width <= 0 || box.height <= 0) return [...radii];
  const sx = a / box.width, sy = b / box.height;
  return toBoxedRadii(pts.map((p) => ({ x: (p.x - box.cx) * sx, y: (p.y - box.cy) * sy })), radii.length);
}

/** Décale le contour vers l'extérieur (profondeur du drageoir d'une monture cerclée). */
export function offsetRadii(radii: readonly number[], mm: number): number[] {
  return radii.map((r) => round2(Math.max(1, r + mm)));
}

/** Lissage circulaire (moyenne glissante) — supprime les petites irrégularités de détection. */
export function smoothRadii(radii: readonly number[], window = 5): number[] {
  const n = radii.length, h = Math.floor(window / 2);
  return radii.map((_, i) => {
    let s = 0;
    for (let k = -h; k <= h; k++) s += radii[(i + k + n) % n]!;
    return round2(s / (2 * h + 1));
  });
}

/** Verre gauche : miroir du droit (r_G(θ) = r_D(180° − θ)). */
export function mirrorRadii(radii: readonly number[]): number[] {
  const n = radii.length;
  return radii.map((_, i) => radii[(Math.round(n / 2) - i + n) % n]!);
}

/* ------------------------------ Gabarits ------------------------------ */

export const TEMPLATE_SHAPES = ['RECTANGLE', 'SOFT_RECT', 'OVAL', 'ROUND', 'PANTOS', 'AVIATOR', 'CAT_EYE', 'D_FRAME'] as const;
export type TemplateShape = (typeof TEMPLATE_SHAPES)[number];

/**
 * Forme type mise aux cotes A × B. Base « superellipse » (|x|^n + |y|^n = 1)
 * déformée pour reproduire les silhouettes classiques ; le résultat est
 * toujours remis exactement aux cotes demandées.
 */
export function templateRadii(shape: TemplateShape, a: number, b: number, n = TRACE_POINTS): number[] {
  const expo: Record<TemplateShape, number> = {
    RECTANGLE: 7, SOFT_RECT: 4, OVAL: 2.2, ROUND: 2, PANTOS: 2.6, AVIATOR: 2.4, CAT_EYE: 3, D_FRAME: 3.5,
  };
  const e = expo[shape];
  const pts: Pt2[] = [];
  for (let i = 0; i < n; i++) {
    const t = angleAt(i, n);
    const c = Math.cos(t), s = Math.sin(t);
    let x = Math.sign(c) * Math.abs(c) ** (2 / e);
    let y = Math.sign(s) * Math.abs(s) ** (2 / e);
    if (shape === 'PANTOS' && y > 0) x *= 1 - 0.12 * y; // haut légèrement resserré
    if (shape === 'AVIATOR') {
      // Goutte : bas temporal (x < 0) plus profond, haut plat.
      if (y < 0) y *= 1 + 0.35 * Math.max(0, -x) ;
      if (y > 0) y = Math.min(y, 0.82 + 0.1 * y);
    }
    if (shape === 'CAT_EYE' && y > 0 && x < 0) y *= 1 + 0.45 * -x; // coin temporal relevé
    if (shape === 'D_FRAME' && x > 0) x = Math.min(x, 0.78 + 0.22 * Math.abs(y)); // côté nasal aplati
    pts.push({ x, y });
  }
  const square = shape === 'ROUND' ? Math.max(a, b) : 0;
  return fitToBox(toBoxedRadii(pts, n), square || a, square || b);
}

/* ------------------------- Centrage et diamètre ------------------------ */

export interface EyeCentering {
  /** Écart pupillaire monoculaire (mm). */
  monoPd: number | null;
  /** Hauteur pupillaire depuis le bas de la boîte (mm). */
  height: number | null;
}

/**
 * Position du centre optique par rapport au centre de boîte (mm, repère du
 * verre droit : x vers le nez, y vers le haut).
 *   x = (A + DBL) / 2 − EP mono   → décentrement nasal (positif = vers le nez)
 *   y = hauteur − B / 2           → au-dessus du centre de boîte si positif
 */
export function opticalCenterOffset(stats: Pick<ShapeStats, 'a' | 'b'>, dbl: number, eye: EyeCentering): Pt2 {
  const x = eye.monoPd != null ? (stats.a + dbl) / 2 - eye.monoPd : 0;
  const y = eye.height != null ? eye.height - stats.b / 2 : 0;
  return { x: round2(x), y: round2(y) };
}

/** Plus grande distance entre le centre optique et le contour (mm). */
export function maxRadiusFrom(radii: readonly number[], oc: Pt2): number {
  let m = 0;
  for (const p of radiiToPoints(radii)) m = Math.max(m, Math.hypot(p.x - oc.x, p.y - oc.y));
  return m;
}

/** Diamètre minimal de palet (MBD) : 2 × rayon maximal depuis le centre optique + marge. */
export function minBlankDiameter(radii: readonly number[], oc: Pt2, margin = BLANK_MARGIN_MM): number {
  return round2(2 * maxRadiusFrom(radii, oc) + margin);
}

/** Palet standard immédiatement supérieur (null si au-delà de 85 mm : verre spécial). */
export function standardBlank(mbd: number): number | null {
  return STANDARD_BLANKS.find((d) => d >= mbd) ?? null;
}

/* ------------------------- Estimation d'épaisseur ---------------------- */

export interface EyeRx {
  sphere: number | null;
  cylinder: number | null;
  axis: number | null;
  addition: number | null;
}

/** Puissance du méridien le plus fort (en valeur absolue), signe conservé. */
export function strongestPower(rx: Pick<EyeRx, 'sphere' | 'cylinder'>): number {
  const s = rx.sphere ?? 0;
  const sc = s + (rx.cylinder ?? 0);
  return Math.abs(sc) > Math.abs(s) ? sc : s;
}

export interface ThicknessEstimate {
  index: number;
  /** Épaisseur au centre optique (mm). */
  center: number;
  /** Épaisseur du bord le plus épais (verre négatif) ou le plus fin (positif), mm. */
  edge: number;
}

/**
 * Estimation par la flèche (s = r²·P / 2000(n−1)), précise à quelques
 * dixièmes de mm : sert à COMPARER les indices, pas à remplacer le calcul du
 * laboratoire. Verre négatif : centre minimal fixe, bord = centre + flèche.
 * Verre positif : bord minimal 1 mm, centre = bord + flèche — c'est là que le
 * précalibrage (rayon réduit au contour réel) fait gagner de l'épaisseur.
 */
export function estimateThickness(power: number, maxRadius: number, index: number): ThicknessEstimate {
  const sag = (maxRadius * maxRadius * Math.abs(power)) / (2000 * (index - 1));
  if (power < 0) {
    const tc = MINUS_CENTER_MM[index] ?? 1.6;
    return { index, center: round2(tc), edge: round2(tc + sag) };
  }
  const te = 1;
  return { index, center: round2(te + sag), edge: te };
}

/** Indice conseillé : le plus bas qui garde le bord (négatif) ≤ 5 mm ou le centre (positif) ≤ 5,5 mm. */
export function suggestIndex(power: number, maxRadius: number): number {
  const limit = power < 0 ? 5 : 5.5;
  for (const n of PRECAL_INDICES) {
    const t = estimateThickness(power, maxRadius, n);
    if ((power < 0 ? t.edge : t.center) <= limit) return n;
  }
  return PRECAL_INDICES[PRECAL_INDICES.length - 1]!;
}

/* ------------------------------ Format OMA ----------------------------- */

/**
 * Fichier OMA / VCA (Data Communication Standard) lu par les laboratoires et
 * les meuleuses : cotes de boîte, pont, diamètre effectif, périmètre et le
 * tracé des deux verres en rayons au centième de mm.
 */
export function toOma(input: { radii: readonly number[]; dbl: number; job: string }): string {
  const right = input.radii;
  const left = mirrorRadii(right);
  const st = shapeStats(right);
  const f2 = (v: number) => v.toFixed(2);
  const lines = [
    `JOB="${input.job.replace(/"/g, '')}"`,
    `DBL=${f2(input.dbl)}`,
    `HBOX=${f2(st.a)};${f2(st.a)}`,
    `VBOX=${f2(st.b)};${f2(st.b)}`,
    `FED=${f2(st.ed)};${f2(st.ed)}`,
    `CIRC=${f2(st.circumference)};${f2(st.circumference)}`,
  ];
  for (const [side, radii] of [['R', right], ['L', left]] as const) {
    lines.push(`TRCFMT=1;${radii.length};E;${side};F`);
    for (let i = 0; i < radii.length; i += 10) {
      lines.push(`R=${radii.slice(i, i + 10).map((r) => Math.round(r * 100)).join(';')}`);
    }
  }
  return lines.join('\r\n') + '\r\n';
}

/** Lit un fichier OMA/VCA : tracé du verre droit (ou miroir du gauche) et pont. */
export function parseOma(text: string): { radii: number[]; dbl: number | null } | null {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const traces: Record<'R' | 'L', number[]> = { R: [], L: [] };
  let dbl: number | null = null;
  let current: 'R' | 'L' | null = null;
  for (const line of lines) {
    const [key, raw = ''] = line.split('=', 2) as [string, string?];
    if (key === 'DBL') {
      const v = Number(raw.split(';')[0]);
      if (Number.isFinite(v) && v > 0) dbl = v;
    }
    if (key === 'TRCFMT') {
      const parts = raw.split(';');
      // Seul le format 1 (rayons ASCII à pas angulaire égal) est pris en charge.
      current = parts[0] === '1' && (parts[3] === 'R' || parts[3] === 'L') ? (parts[3] as 'R' | 'L') : null;
      if (current) traces[current] = [];
      continue;
    }
    if (key === 'R' && current) {
      for (const v of raw.split(';')) {
        const n = Number(v);
        if (Number.isFinite(n) && v.trim() !== '') traces[current].push(n / 100);
      }
      continue;
    }
    if (key !== 'R') current = null;
  }
  const raw = traces.R.length >= 32 ? traces.R : traces.L.length >= 32 ? mirrorRadii(traces.L) : null;
  if (!raw) return null;
  return { radii: toBoxedRadii(radiiToPoints(raw)), dbl };
}

/* ------------------------------- Schémas ------------------------------- */

const num = (min: number, max: number) => z.number().min(min).max(max);
const optNum = (min: number, max: number) => num(min, max).nullable().optional();

const eyePrecalSchema = z.object({
  monoPd: optNum(15, 45),
  height: optNum(5, 50),
  sphere: optNum(-30, 30),
  cylinder: optNum(-15, 15),
  axis: optNum(0, 180),
  addition: optNum(0, 5),
});
export type EyePrecal = z.infer<typeof eyePrecalSchema>;

export const precalSchema = z.object({
  od: eyePrecalSchema.default({}),
  og: eyePrecalSchema.default({}),
  design: z.enum(PRECAL_DESIGNS).default('SINGLE_VISION'),
  index: z.number().min(1.4).max(1.9).nullable().optional(),
  material: z.string().trim().max(60).optional().or(z.literal('')),
  treatments: z.string().trim().max(200).optional().or(z.literal('')),
  /** Hauteur minimale de montage du progressif choisi (mm). */
  minFittingHeight: optNum(10, 30),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
});
export type Precal = z.infer<typeof precalSchema>;

export const frameTraceInputSchema = z.object({
  label: z.string().trim().max(120).optional().or(z.literal('')),
  customerId: z.string().uuid().nullable().optional(),
  supplierId: z.string().uuid().nullable().optional(),
  lensOrderId: z.string().uuid().nullable().optional(),
  measurementId: z.string().uuid().nullable().optional(),
  prescriptionId: z.string().uuid().nullable().optional(),
  source: z.enum(TRACE_SOURCES),
  frameType: z.enum(PRECAL_FRAME_TYPES).default('FULL_RIM'),
  frameRef: z.string().trim().max(80).nullable().optional(),
  radii: z.array(num(3, 60)).length(TRACE_POINTS),
  dbl: num(5, 40),
  /** Fiabilité de la détection (0-100), null pour un gabarit ou un fichier OMA. */
  confidence: z.number().int().min(0).max(100).nullable().optional(),
  /** Aperçu JPEG réduit de la photo scannée (data URL), pour reprendre le tracé. */
  photoUrl: z.string().max(700_000).nullable().optional(),
  precal: precalSchema.default({}),
  status: z.enum(TRACE_STATUSES).optional(),
});
export type FrameTraceInput = z.infer<typeof frameTraceInputSchema>;
export const frameTraceUpdateSchema = frameTraceInputSchema.partial();
export type FrameTraceUpdate = z.infer<typeof frameTraceUpdateSchema>;
