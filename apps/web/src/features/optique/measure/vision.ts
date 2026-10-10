import type { FaceAnalysis, Pt } from './geometry';
import { axes, IRIS_MM } from './geometry';
import { ID1_CARD_WIDTH_MM } from '@oculo/shared-types';

/**
 * Analyse d'image légère (sans réseau de neurones) pour proposer la carte de
 * référence et les bords de la monture. Le calcul se fait sur une copie
 * réduite en niveaux de gris ; les résultats sont ramenés à l'échelle de la
 * photo. Chaque proposition porte une confiance 0-1 : en dessous de ~0,5 elle
 * doit être vérifiée par l'opticien (c'est indiqué dans l'interface).
 */

export interface Gray {
  data: Float32Array;
  w: number;
  h: number;
  /** Facteur photo → image réduite. */
  k: number;
  gx: Float32Array;
  gy: Float32Array;
}

/** Copie réduite en niveaux de gris + gradients de Sobel. */
export function toGray(src: CanvasImageSource, srcW: number, srcH: number, maxW = 900): Gray {
  const k = Math.min(1, maxW / srcW);
  const w = Math.max(1, Math.round(srcW * k));
  const h = Math.max(1, Math.round(srcH * k));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(src, 0, 0, w, h);
  const px = ctx.getImageData(0, 0, w, h).data;
  const data = new Float32Array(w * h);
  for (let i = 0, j = 0; i < data.length; i++, j += 4) data[i] = 0.299 * px[j]! + 0.587 * px[j + 1]! + 0.114 * px[j + 2]!;
  const gx = new Float32Array(w * h);
  const gy = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const a = data[i - w - 1]!, b = data[i - w]!, c2 = data[i - w + 1]!;
      const d = data[i - 1]!, f = data[i + 1]!;
      const g = data[i + w - 1]!, hh = data[i + w]!, ii = data[i + w + 1]!;
      gx[i] = c2 + 2 * f + ii - a - 2 * d - g;
      gy[i] = g + 2 * hh + ii - a - 2 * b - c2;
    }
  }
  return { data, w, h, k, gx, gy };
}

const clampI = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(v)));

/** Luminosité moyenne (0-255) d'une zone (coordonnées photo). */
export function brightness(g: Gray, box: { x0: number; y0: number; x1: number; y1: number }): number {
  const x0 = clampI(box.x0 * g.k, 0, g.w - 1), x1 = clampI(box.x1 * g.k, 0, g.w - 1);
  const y0 = clampI(box.y0 * g.k, 0, g.h - 1), y1 = clampI(box.y1 * g.k, 0, g.h - 1);
  let s = 0, n = 0;
  for (let y = y0; y <= y1; y += 2) for (let x = x0; x <= x1; x += 2) { s += g.data[y * g.w + x]!; n++; }
  return n ? s / n : 0;
}

/** Netteté : variance du laplacien sur une zone (coordonnées photo). Plus c'est haut, plus c'est net. */
export function sharpness(g: Gray, box: { x0: number; y0: number; x1: number; y1: number }): number {
  const x0 = clampI(box.x0 * g.k, 1, g.w - 2), x1 = clampI(box.x1 * g.k, 1, g.w - 2);
  const y0 = clampI(box.y0 * g.k, 1, g.h - 2), y1 = clampI(box.y1 * g.k, 1, g.h - 2);
  let s = 0, s2 = 0, n = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = y * g.w + x;
      const l = g.data[i - 1]! + g.data[i + 1]! + g.data[i - g.w]! + g.data[i + g.w]! - 4 * g.data[i]!;
      s += l; s2 += l * l; n++;
    }
  }
  if (!n) return 0;
  const m = s / n;
  return s2 / n - m * m;
}

function median(a: number[]): number {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)]!;
}

/* ------------------------------------------------------------------ */
/* Carte de référence                                                  */
/* ------------------------------------------------------------------ */

export interface CardDetection {
  corners: [Pt, Pt, Pt, Pt];
  confidence: number;
}

/**
 * Cherche une carte au format bancaire posée horizontalement au-dessus des
 * yeux (sur le haut de la monture ou contre le front). Taille attendue
 * estimée grâce à l'iris (11,7 mm en moyenne) ; on recherche deux bords
 * verticaux à la bonne distance, puis les bords haut et bas.
 */
export function detectCard(g: Gray, f: FaceAnalysis): CardDetection | null {
  const k = g.k;
  const D = f.pdPx * k;
  let expW = (ID1_CARD_WIDTH_MM * f.irisPx * k) / IRIS_MM;
  expW = Math.max(1.05 * D, Math.min(1.75 * D, expW));
  const mid = ((f.pupilR.x + f.pupilL.x) / 2) * k;
  const eyeY = ((f.pupilR.y + f.pupilL.y) / 2) * k;
  const yA = clampI(Math.min(f.browY * k, eyeY - 0.3 * D) - 1.05 * expW, 1, g.h - 2);
  const yB = clampI(eyeY - 0.12 * D, 1, g.h - 2);
  if (yB - yA < 10) return null;
  const L = Math.max(6, Math.round(0.5 * expW * 0.63));

  const xA = clampI(mid - 1.0 * expW, 1, g.w - 2);
  const xB = clampI(mid + 1.0 * expW, 1, g.w - 2);
  // Pour chaque colonne : meilleure fenêtre verticale (longueur L) de |gx|.
  const colBest: number[] = [];
  const colY: number[] = [];
  for (let x = xA; x <= xB; x++) {
    let win = 0;
    for (let y = yA; y < yA + L && y <= yB; y++) win += Math.abs(g.gx[y * g.w + x]!);
    let best = win, by = yA;
    for (let y = yA + L; y <= yB; y++) {
      win += Math.abs(g.gx[y * g.w + x]!) - Math.abs(g.gx[(y - L) * g.w + x]!);
      if (win > best) { best = win; by = y - L + 1; }
    }
    colBest.push(best);
    colY.push(by);
  }
  const med = median(colBest) || 1;
  let best: { x1: number; x2: number; score: number } | null = null;
  for (let i = 0; i < colBest.length; i++) {
    const x1 = xA + i;
    if (x1 > mid - 0.3 * expW) break;
    for (let w = Math.round(0.8 * expW); w <= Math.round(1.25 * expW); w++) {
      const j = i + w;
      if (j >= colBest.length) break;
      const x2 = x1 + w;
      if (Math.abs((x1 + x2) / 2 - mid) > 0.35 * expW) continue;
      const dy = Math.abs(colY[i]! - colY[j]!);
      const score = (colBest[i]! + colBest[j]!) / (2 * med) - dy / L - Math.abs(w - expW) / expW;
      if (!best || score > best.score) best = { x1, x2, score };
    }
  }
  if (!best) return null;
  // Affinage sous-pixel des deux bords verticaux (parabole sur le profil de colonnes).
  const sub = (x: number) => {
    const i = x - xA;
    if (i <= 0 || i >= colBest.length - 1) return x;
    const a = colBest[i - 1]!, b2 = colBest[i]!, c = colBest[i + 1]!;
    const den = a - 2 * b2 + c;
    return den < 0 ? x + (0.5 * (a - c)) / den : x;
  };
  const fx1 = sub(best.x1);
  const fx2 = sub(best.x2);

  // Bords haut et bas : profil de |gy| entre les deux bords verticaux.
  const W = best.x2 - best.x1;
  const cx0 = Math.round(best.x1 + 0.1 * W), cx1 = Math.round(best.x2 - 0.1 * W);
  const rowScore = (y: number) => {
    let s = 0;
    for (let x = cx0; x <= cx1; x++) s += Math.abs(g.gy[y * g.w + x]!);
    return s / Math.max(1, cx1 - cx0 + 1);
  };
  const yc = (colY[best.x1 - xA]! + colY[best.x2 - xA]!) / 2;
  const searchTop = [clampI(yc - 0.35 * W, 1, g.h - 2), clampI(yc + 0.3 * W, 1, g.h - 2)] as const;
  let top = searchTop[0], topS = 0;
  for (let y = searchTop[0]; y <= searchTop[1]; y++) { const s = rowScore(y); if (s > topS) { topS = s; top = y; } }
  let bot = top + Math.round(0.63 * W), botS = 0;
  for (let y = clampI(top + 0.45 * W, 1, g.h - 2); y <= clampI(top + 0.78 * W, 1, g.h - 2); y++) {
    const s = rowScore(y);
    if (s > botS) { botS = s; bot = y; }
  }
  const rows: number[] = [];
  for (let y = yA; y <= yB; y += 2) rows.push(rowScore(y));
  const rowMed = median(rows) || 1;
  const aspect = W / Math.max(1, bot - top);
  const aspectErr = Math.abs(aspect - 1.586) / 1.586;
  const edge = Math.min(1, (best.score - 1) / 3);
  const hor = Math.min(1, (Math.min(topS, botS) / rowMed - 1) / 2.5);
  const confidence = Math.max(0, Math.min(1, 0.45 * edge + 0.35 * hor + 0.2 * (1 - Math.min(1, aspectErr * 4))));
  const toPhoto = (x: number, y: number): Pt => ({ x: x / k, y: y / k });
  return {
    corners: [toPhoto(fx1, top), toPhoto(fx2, top), toPhoto(fx2, bot), toPhoto(fx1, bot)],
    confidence,
  };
}

/* ------------------------------------------------------------------ */
/* Bords de la monture                                                 */
/* ------------------------------------------------------------------ */

export interface RimDetection {
  points: Partial<Record<'rTop' | 'rBottom' | 'rNasal' | 'rTemple' | 'lTop' | 'lBottom' | 'lNasal' | 'lTemple', Pt>>;
  conf: Partial<Record<'rTop' | 'rBottom' | 'rNasal' | 'rTemple' | 'lTop' | 'lBottom' | 'lNasal' | 'lTemple', number>>;
}

/**
 * Cherche, autour de chaque pupille, le contour le plus marqué du cercle de
 * la monture : en dessous (bas du verre), au-dessus, côté nez et côté tempe.
 * Les recherches commencent au-delà des paupières pour ne pas les confondre
 * avec la monture.
 */
export function detectRims(g: Gray, f: FaceAnalysis): RimDetection {
  const ax = axes({ pupilR: f.pupilR, pupilL: f.pupilL })!;
  const D = f.pdPx;
  const out: RimDetection = { points: {}, conf: {} };
  /** Gradient projeté sur un axe de la tête (u : horizontal, v : vertical). */
  const sample = (p: Pt, along: 'u' | 'v') => {
    const x = clampI(p.x * g.k, 1, g.w - 2);
    const y = clampI(p.y * g.k, 1, g.h - 2);
    const i = y * g.w + x;
    const d = along === 'u' ? ax.u : ax.v;
    return Math.abs(g.gx[i]! * d.x + g.gy[i]! * d.y);
  };

  /** Profil le long d'une direction, moyenné sur une petite bande perpendiculaire. */
  const scan = (origin: { X: number; Y: number }, dir: 'X' | 'Y', sign: 1 | -1, from: number, to: number, band: number) => {
    const steps = Math.max(8, Math.round((to - from) * g.k));
    const vals: { t: number; s: number }[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = from + ((to - from) * i) / steps;
      let s = 0;
      const n = 7;
      for (let j = -3; j <= 3; j++) {
        const off = (j / 3) * band;
        const p = dir === 'Y' ? ax.at(origin.X + off, origin.Y + sign * t) : ax.at(origin.X + sign * t, origin.Y + off);
        s += sample(p, dir === 'Y' ? 'v' : 'u');
      }
      vals.push({ t, s: s / n });
    }
    const med = median(vals.map((v) => v.s)) || 1;
    let max = vals[0]!;
    for (const v of vals) if (v.s > max.s) max = v;
    // Un cercle de monture est un trait : deux bords (intérieur, extérieur). Le
    // centrage se mesure au bord INTÉRIEUR (côté pupille) : on retient le
    // premier pic marqué en partant de la pupille, pas forcément le plus fort.
    const thr = Math.max(0.5 * max.s, 1.6 * med);
    let pick = max;
    let idx = vals.indexOf(max);
    for (let i = 1; i < vals.length - 1; i++) {
      const v = vals[i]!;
      if (v.s >= thr && v.s >= vals[i - 1]!.s && v.s >= vals[i + 1]!.s) { pick = v; idx = i; break; }
    }
    // Affinage sous-pixel (parabole sur le pic et ses voisins).
    let t = pick.t;
    if (idx > 0 && idx < vals.length - 1) {
      const a = vals[idx - 1]!.s, b2 = pick.s, c = vals[idx + 1]!.s;
      const den = a - 2 * b2 + c;
      if (den < 0) t += (0.5 * (a - c) / den) * (vals[1]!.t - vals[0]!.t);
    }
    const prom = pick.s / med;
    return { t, conf: Math.max(0, Math.min(1, (prom - 1.4) / 2)) };
  };

  for (const side of ['r', 'l'] as const) {
    const p = side === 'r' ? f.pupilR : f.pupilL;
    const o = { X: ax.X(p), Y: ax.Y(p) };
    const nasalSign: 1 | -1 = side === 'r' ? 1 : -1;
    const lidLow = (side === 'r' ? f.lidLowR : f.lidLowL) - p.y;
    const lidUp = p.y - (side === 'r' ? f.lidUpR : f.lidUpL);
    const bottom = scan(o, 'Y', 1, Math.max(0.2 * D, lidLow + 0.07 * D), 0.72 * D, 0.1 * D);
    const top = scan(o, 'Y', -1, Math.max(0.14 * D, lidUp + 0.06 * D), Math.min(0.62 * D, p.y - f.browY + 0.12 * D), 0.1 * D);
    const nasal = scan(o, 'X', nasalSign, 0.24 * D, 0.47 * D, 0.06 * D);
    const temple = scan(o, 'X', (-nasalSign) as 1 | -1, 0.3 * D, 0.8 * D, 0.06 * D);
    out.points[`${side}Bottom`] = ax.at(o.X, o.Y + bottom.t);
    out.points[`${side}Top`] = ax.at(o.X, o.Y - top.t);
    out.points[`${side}Nasal`] = ax.at(o.X + nasalSign * nasal.t, o.Y);
    out.points[`${side}Temple`] = ax.at(o.X - nasalSign * temple.t, o.Y);
    out.conf[`${side}Bottom`] = bottom.conf;
    // Le haut du cercle est souvent confondu avec les sourcils (sombres contre une
    // monture sombre) : confiance plafonnée pour qu'il soit signalé « à vérifier ».
    out.conf[`${side}Top`] = Math.min(0.45, top.conf * 0.6);
    out.conf[`${side}Nasal`] = nasal.conf;
    out.conf[`${side}Temple`] = temple.conf;
  }
  return out;
}
