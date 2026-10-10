import { ID1_CARD_WIDTH_MM, type MeasurementCalibration } from '@oculo/shared-types';
import type { FacePoints } from './landmarker';

export interface Pt {
  x: number;
  y: number;
}

/** Diamètre moyen de l'iris humain visible (mm) — sert au guidage de distance, jamais au calcul final. */
export const IRIS_MM = 11.7;
export const CARD_HEIGHT_MM = 53.98;

/* ------------------------------------------------------------------ */
/* Repères                                                             */
/* ------------------------------------------------------------------ */

/**
 * Repères posés sur la photo (pixels de l'image). OD = œil droit du client,
 * donc à GAUCHE d'une photo prise de face (image non inversée).
 */
export const FACE_KEYS = ['pupilR', 'pupilL', 'bridge'] as const;
export const RIM_KEYS = ['rTop', 'rBottom', 'rNasal', 'rTemple', 'lTop', 'lBottom', 'lNasal', 'lTemple'] as const;
export const CARD_KEYS = ['c1', 'c2', 'c3', 'c4'] as const; // haut-gauche, haut-droit, bas-droit, bas-gauche
export const REF_KEYS = ['ref1', 'ref2'] as const;

export type MarkerKey =
  | (typeof FACE_KEYS)[number]
  | (typeof RIM_KEYS)[number]
  | (typeof CARD_KEYS)[number]
  | (typeof REF_KEYS)[number];

export type Markers = Partial<Record<MarkerKey, Pt>>;

export function refKeys(cal: MeasurementCalibration): readonly MarkerKey[] {
  return cal === 'CARD' ? CARD_KEYS : REF_KEYS;
}
export function allKeys(cal: MeasurementCalibration): MarkerKey[] {
  return [...FACE_KEYS, ...RIM_KEYS, ...refKeys(cal)];
}

/* ------------------------------------------------------------------ */
/* Analyse du visage (pose, regard, ouverture des yeux, distance)       */
/* ------------------------------------------------------------------ */

const L = {
  irisR: 468, irisRing_R: [469, 470, 471, 472], irisL: 473, irisRing_L: [474, 475, 476, 477],
  eyeROuter: 33, eyeRInner: 133, eyeRUp: 159, eyeRLow: 145,
  eyeLOuter: 263, eyeLInner: 362, eyeLUp: 386, eyeLLow: 374,
  bridge: 168, noseTip: 1, forehead: 10, chin: 152, cheekR: 234, cheekL: 454,
  browR: [70, 63, 105, 66, 107], browL: [300, 293, 334, 296, 336],
  oval: [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109],
};

export interface FaceAnalysis {
  /** Pupilles : OD à gauche de l'image, OG à droite. */
  pupilR: Pt;
  pupilL: Pt;
  bridge: Pt;
  /** Diamètre moyen de l'iris (px). */
  irisPx: number;
  /** Distance entre pupilles (px). */
  pdPx: number;
  rollDeg: number;
  yawDeg: number;
  pitchDeg: number;
  /** Décalage du regard (0 = regard dans l'objectif). */
  gaze: number;
  /** Ouverture des yeux (hauteur / largeur), la plus faible des deux. */
  eyeOpen: number;
  faceBox: { x0: number; y0: number; x1: number; y1: number };
  /** Contour du visage (36 points MediaPipe, du front au menton). */
  oval: Pt[];
  /**
   * Ellipse ajustée à la tête du client : centre, demi-largeur (pommettes),
   * demi-hauteur (menton → haut du crâne, estimé au-delà du front) et
   * inclinaison en degrés.
   */
  head: { cx: number; cy: number; rx: number; ry: number; angle: number };
  browY: number;
  lidLowR: number;
  lidLowL: number;
  lidUpR: number;
  lidUpL: number;
}

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
const deg = (r: number) => (r * 180) / Math.PI;

export function analyzeFace(f: FacePoints): FaceAnalysis {
  const p = f.pts;
  // Iris 468 / 473 : on attribue OD / OG par la position dans l'image, pas par l'indice.
  const a = p[L.irisR]!;
  const b = p[L.irisL]!;
  const rightIsA = a.x <= b.x;
  const pupilR = rightIsA ? a : b;
  const pupilL = rightIsA ? b : a;
  const ringA = dist(p[L.irisRing_R[0]!]!, p[L.irisRing_R[2]!]!);
  const ringB = dist(p[L.irisRing_L[0]!]!, p[L.irisRing_L[2]!]!);
  const irisPx = (ringA + ringB) / 2;

  const eye = (outer: number, inner: number, up: number, low: number, iris: Pt) => {
    const o = p[outer]!;
    const i = p[inner]!;
    const w = dist(o, i) || 1;
    const t = ((iris.x - o.x) * (i.x - o.x) + (iris.y - o.y) * (i.y - o.y)) / (w * w);
    return { open: Math.abs(p[low]!.y - p[up]!.y) / w, gaze: Math.abs(t - 0.5) };
  };
  const e1 = eye(L.eyeROuter, L.eyeRInner, L.eyeRUp, L.eyeRLow, rightIsA ? a : b);
  const e2 = eye(L.eyeLOuter, L.eyeLInner, L.eyeLUp, L.eyeLLow, rightIsA ? b : a);

  // Rotation de la tête : matrice MediaPipe (colonne par colonne) si disponible.
  let yaw = 0;
  let pitch = 0;
  const roll = deg(Math.atan2(pupilL.y - pupilR.y, pupilL.x - pupilR.x));
  if (f.matrix && f.matrix.length >= 16) {
    const m = (r: number, c: number) => f.matrix![c * 4 + r]!;
    yaw = deg(Math.asin(Math.max(-1, Math.min(1, -m(2, 0)))));
    pitch = deg(Math.atan2(m(2, 1), m(2, 2)));
  } else {
    const nose = p[L.noseTip]!;
    const dR = Math.abs(nose.x - p[L.cheekR]!.x);
    const dL = Math.abs(p[L.cheekL]!.x - nose.x);
    yaw = ((dL - dR) / (dL + dR || 1)) * 60;
  }

  const xs = [p[L.cheekR]!.x, p[L.cheekL]!.x];
  const browY = Math.min(...[...L.browR, ...L.browL].map((i) => p[i]!.y));
  const lid = (up: number, low: number) => [p[up]!.y, p[low]!.y];
  const [upA, lowA] = lid(L.eyeRUp, L.eyeRLow);
  const [upB, lowB] = lid(L.eyeLUp, L.eyeLLow);
  const leftEyeIsR = p[L.eyeROuter]!.x < p[L.eyeLOuter]!.x;
  const oval = L.oval.map((i) => ({ x: p[i]!.x, y: p[i]!.y }));
  // Ellipse de la tête, dans le repère incliné de la tête (axe des pupilles).
  const ang = Math.atan2(pupilL.y - pupilR.y, pupilL.x - pupilR.x);
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const U = (q: Pt) => q.x * ca + q.y * sa;
  const V = (q: Pt) => -q.x * sa + q.y * ca;
  const us = oval.map(U);
  const vs = oval.map(V);
  const u0 = Math.min(...us), u1 = Math.max(...us);
  const vChin = Math.max(...vs), vForehead = Math.min(...vs);
  // Le point 10 est en haut du front : le crâne monte encore d'environ 25 %
  // de la hauteur front-menton.
  const vTop = vForehead - 0.25 * (vChin - vForehead);
  const uc = (u0 + u1) / 2, vc = (vTop + vChin) / 2;
  const head = {
    cx: uc * ca - vc * sa,
    cy: uc * sa + vc * ca,
    rx: ((u1 - u0) / 2) * 1.04,
    ry: (vChin - vTop) / 2,
    angle: deg(ang),
  };
  return {
    pupilR,
    pupilL,
    bridge: p[L.bridge]!,
    irisPx,
    pdPx: dist(pupilR, pupilL),
    rollDeg: roll,
    yawDeg: yaw,
    pitchDeg: pitch,
    gaze: Math.max(e1.gaze, e2.gaze),
    eyeOpen: Math.min(e1.open, e2.open),
    faceBox: { x0: Math.min(...xs), x1: Math.max(...xs), y0: p[L.forehead]!.y, y1: p[L.chin]!.y },
    oval,
    head,
    browY,
    lidLowR: leftEyeIsR ? lowA! : lowB!,
    lidLowL: leftEyeIsR ? lowB! : lowA!,
    lidUpR: leftEyeIsR ? upA! : upB!,
    lidUpL: leftEyeIsR ? upB! : upA!,
  };
}

/* ------------------------------------------------------------------ */
/* Calculs                                                             */
/* ------------------------------------------------------------------ */

export interface Calibration {
  mode: MeasurementCalibration;
  /** Longueur réelle de la référence (mm) : 85,6 pour une carte, largeur de monture, ou cote saisie. */
  mm: number;
}

/** Échelle en mm par pixel, à partir des repères de référence. */
export function scaleOf(m: Markers, cal: Calibration): number | null {
  if (cal.mode === 'CARD') {
    const { c1, c2, c3, c4 } = m;
    if (!c1 || !c2 || !c3 || !c4) return null;
    const w = (dist(c1, c2) + dist(c4, c3)) / 2;
    return w > 5 ? ID1_CARD_WIDTH_MM / w : null;
  }
  const { ref1, ref2 } = m;
  if (!ref1 || !ref2 || !(cal.mm > 0)) return null;
  const d = dist(ref1, ref2);
  return d > 5 ? cal.mm / d : null;
}

/** Rapport largeur / hauteur mesuré de la carte (attendu : 1,586). */
export function cardAspect(m: Markers): number | null {
  const { c1, c2, c3, c4 } = m;
  if (!c1 || !c2 || !c3 || !c4) return null;
  const w = (dist(c1, c2) + dist(c4, c3)) / 2;
  const h = (dist(c1, c4) + dist(c2, c3)) / 2;
  return h > 0 ? w / h : null;
}

export type ValueKey =
  | 'pdTotal' | 'odMonoPd' | 'ogMonoPd' | 'odHeight' | 'ogHeight'
  | 'odA' | 'ogA' | 'odB' | 'ogB' | 'lensWidth' | 'lensHeight' | 'bridge' | 'frameWidth'
  | 'ed' | 'odDecH' | 'ogDecH' | 'odDecV' | 'ogDecV' | 'minBlank';

export type Values = Partial<Record<ValueKey, number>>;

/** Repère aligné sur la ligne des pupilles : corrige une tête légèrement penchée. */
export function axes(m: Markers) {
  const { pupilR, pupilL } = m;
  if (!pupilR || !pupilL) return null;
  const len = dist(pupilR, pupilL) || 1;
  const u = { x: (pupilL.x - pupilR.x) / len, y: (pupilL.y - pupilR.y) / len };
  const v = { x: -u.y, y: u.x };
  return {
    u,
    v,
    X: (p: Pt) => p.x * u.x + p.y * u.y,
    Y: (p: Pt) => p.x * v.x + p.y * v.y,
    at: (X: number, Y: number): Pt => ({ x: X * u.x + Y * v.x, y: X * u.y + Y * v.y }),
  };
}

/** Boîte (système « boxing ») d'un verre, dans le repère des pupilles. */
export function lensBox(m: Markers, side: 'r' | 'l') {
  const ax = axes(m);
  const t = m[`${side}Top`];
  const b = m[`${side}Bottom`];
  const n = m[`${side}Nasal`];
  const te = m[`${side}Temple`];
  if (!ax || !t || !b || !n || !te) return null;
  const xs = [ax.X(n), ax.X(te)];
  const ys = [ax.Y(t), ax.Y(b)];
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys), ax };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Toutes les mesures calculables à partir des repères et de l'échelle.
 *
 * - Écarts mono : pupille → centre du pont, le long de la ligne des pupilles.
 * - Hauteurs : pupille → bas de la boîte du verre, perpendiculairement.
 * - A / B : largeur / hauteur de la boîte ; DBL : entre bords nasaux.
 * - Décentrement horizontal : pupille − centre de la boîte (positif = côté nez).
 * - Décentrement vertical : pupille − centre de la boîte (positif = au-dessus).
 * - ED : diagonale de la boîte (majorant du diamètre effectif).
 * - Ø minimal : ED + 2 × décentrement horizontal + 2 mm (marge de taille).
 */
export function computeValues(m: Markers, scale: number | null): Values {
  const ax = axes(m);
  if (!ax || !scale) return {};
  const s = scale;
  const out: Values = {};
  const { pupilR, pupilL, bridge } = m;
  out.pdTotal = r1(Math.abs(ax.X(pupilL!) - ax.X(pupilR!)) * s);
  if (bridge) {
    out.odMonoPd = r1(Math.abs(ax.X(bridge) - ax.X(pupilR!)) * s);
    out.ogMonoPd = r1(Math.abs(ax.X(pupilL!) - ax.X(bridge)) * s);
  }
  const R = lensBox(m, 'r');
  const Lb = lensBox(m, 'l');
  if (R) {
    out.odA = r1((R.x1 - R.x0) * s);
    out.odB = r1((R.y1 - R.y0) * s);
    out.odHeight = r1((R.y1 - ax.Y(pupilR!)) * s);
    // OD à gauche de l'image : le nez est vers +X.
    out.odDecH = r1((ax.X(pupilR!) - (R.x0 + R.x1) / 2) * s);
    out.odDecV = r1(((R.y0 + R.y1) / 2 - ax.Y(pupilR!)) * s);
  }
  if (Lb) {
    out.ogA = r1((Lb.x1 - Lb.x0) * s);
    out.ogB = r1((Lb.y1 - Lb.y0) * s);
    out.ogHeight = r1((Lb.y1 - ax.Y(pupilL!)) * s);
    out.ogDecH = r1(((Lb.x0 + Lb.x1) / 2 - ax.X(pupilL!)) * s);
    out.ogDecV = r1(((Lb.y0 + Lb.y1) / 2 - ax.Y(pupilL!)) * s);
  }
  if (R && Lb) {
    out.lensWidth = r1((out.odA! + out.ogA!) / 2);
    out.lensHeight = r1((out.odB! + out.ogB!) / 2);
    out.bridge = r1((Lb.x0 - R.x1) * s);
    out.frameWidth = r1((Lb.x1 - R.x0) * s);
    out.ed = r1(Math.hypot(out.lensWidth, out.lensHeight));
    const dec = Math.max(Math.abs(out.odDecH ?? 0), Math.abs(out.ogDecH ?? 0));
    out.minBlank = r1(out.ed + 2 * dec + 2);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Fiabilité                                                           */
/* ------------------------------------------------------------------ */

/** Partie de l'analyse du visage conservée avec la mesure (pour recalculer la fiabilité). */
export type PoseInfo = Pick<FaceAnalysis, 'rollDeg' | 'yawDeg' | 'pitchDeg' | 'gaze' | 'eyeOpen'>;

export interface CaptureContext {
  face: PoseInfo | null;
  /** Confiance de détection automatique (0-1) de la référence et de chaque bord de monture. */
  refConf: number;
  rimConf: Partial<Record<(typeof RIM_KEYS)[number], number>>;
  brightness: number;
  sharpness: number;
}

export interface Check {
  ok: boolean;
  key: string;
  params?: Record<string, string | number>;
}

/**
 * Score de fiabilité (0-100) et liste des contrôles. Un repère déplacé par
 * l'opticien est considéré comme vérifié : sa confiance remonte, mais la
 * mesure reste une estimation à valider.
 */
export function reliability(ctx: CaptureContext, cal: Calibration, m: Markers, corrected: Set<MarkerKey>): { score: number; checks: Check[] } {
  const checks: Check[] = [];
  const f = ctx.face;

  // Référence de taille
  let ref = 0;
  const refCorrected = refKeys(cal.mode).some((k) => corrected.has(k));
  if (cal.mode === 'CARD') {
    const asp = cardAspect(m);
    const aspOk = asp != null && Math.abs(asp - ID1_CARD_WIDTH_MM / CARD_HEIGHT_MM) < 0.12;
    ref = Math.max(ctx.refConf, refCorrected ? 0.85 : 0) * (aspOk ? 1 : 0.7);
    checks.push({ ok: ref >= 0.6, key: ref >= 0.6 ? 'refOk' : 'refWeak' });
    if (asp != null && !aspOk) checks.push({ ok: false, key: 'cardAspect' });
  } else {
    ref = refCorrected || ctx.refConf > 0 ? 0.8 : 0.55;
    checks.push({ ok: ref >= 0.6, key: ref >= 0.6 ? 'refOk' : 'refPlace' });
  }

  // Position du visage
  let pose = 0.5;
  if (f) {
    const roll = Math.abs(f.rollDeg);
    const yaw = Math.abs(f.yawDeg);
    pose = Math.max(0, 1 - Math.max(0, roll - 2) / 6 - Math.max(0, yaw - 3) / 10);
    checks.push({ ok: pose >= 0.7, key: pose >= 0.7 ? 'poseOk' : 'poseBad', params: { roll: roll.toFixed(1), yaw: yaw.toFixed(1) } });
  } else {
    checks.push({ ok: false, key: 'noFace' });
  }

  // Pupilles
  let pupils = f ? Math.min(1, f.eyeOpen / 0.22) * (f.gaze < 0.12 ? 1 : 0.7) : 0.4;
  if (corrected.has('pupilR') || corrected.has('pupilL')) pupils = Math.max(pupils, 0.85);
  checks.push({ ok: pupils >= 0.7, key: pupils >= 0.7 ? 'pupilsOk' : f && f.eyeOpen < 0.15 ? 'eyesClosed' : 'pupilsWeak' });
  if (f && f.gaze >= 0.12) checks.push({ ok: false, key: 'gaze' });

  // Monture
  const rimVals = RIM_KEYS.map((k) => (corrected.has(k) ? 0.9 : ctx.rimConf[k] ?? 0));
  const frame = rimVals.reduce((a, b) => a + b, 0) / rimVals.length;
  checks.push({ ok: frame >= 0.55, key: frame >= 0.55 ? 'frameOk' : 'frameWeak' });

  // Image
  const light = ctx.brightness < 60 ? 0.4 : ctx.brightness > 220 ? 0.6 : 1;
  if (light < 1) checks.push({ ok: false, key: ctx.brightness < 60 ? 'tooDark' : 'tooBright' });
  const sharp = Math.min(1, ctx.sharpness / 40);
  if (sharp < 0.6) checks.push({ ok: false, key: 'blurry' });

  let score = Math.round(100 * (0.3 * ref + 0.2 * pose + 0.2 * pupils + 0.2 * frame + 0.05 * light + 0.05 * sharp));
  // Une estimation automatique jamais vérifiée n'est pas présentée comme sûre :
  // au-delà de 92 %, il faut que l'opticien ait vérifié les repères.
  const reviewed = [...FACE_KEYS, ...RIM_KEYS].filter((k) => corrected.has(k)).length;
  if (reviewed < FACE_KEYS.length + RIM_KEYS.length) score = Math.min(score, 92);
  if (reviewed === 0) checks.push({ ok: false, key: 'notReviewed' });
  return { score: Math.max(0, Math.min(100, score)), checks };
}

/** Repères initiaux : pupilles et pont détectés, monture et référence proposées par l'analyse d'image. */
export function defaultRims(f: FaceAnalysis): Record<(typeof RIM_KEYS)[number], Pt> {
  // Proportions moyennes (H ≈ 20 mm, A ≈ 50 mm, B ≈ 36 mm pour un EP de 62 mm)
  // utilisées seulement quand la monture n'est pas trouvée : à vérifier.
  const D = f.pdPx;
  const ax = axes({ pupilR: f.pupilR, pupilL: f.pupilL })!;
  const pr = { X: ax.X(f.pupilR), Y: ax.Y(f.pupilR) };
  const pl = { X: ax.X(f.pupilL), Y: ax.Y(f.pupilL) };
  return {
    rTop: ax.at(pr.X, pr.Y - 0.27 * D),
    rBottom: ax.at(pr.X, pr.Y + 0.32 * D),
    rNasal: ax.at(pr.X + 0.35 * D, pr.Y),
    rTemple: ax.at(pr.X - 0.42 * D, pr.Y),
    lTop: ax.at(pl.X, pl.Y - 0.27 * D),
    lBottom: ax.at(pl.X, pl.Y + 0.32 * D),
    lNasal: ax.at(pl.X - 0.35 * D, pl.Y),
    lTemple: ax.at(pl.X + 0.42 * D, pl.Y),
  };
}
