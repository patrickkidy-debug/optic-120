import { TRACE_POINTS, toBoxedRadii, type Pt2 } from '@oculo/shared-types';

/**
 * Détection du contour d'un verre de présentation (ou d'un gabarit) sur une
 * photo prise de face, verre posé à plat sur une feuille unie.
 *
 * Méthode : contour actif en coordonnées polaires autour du point touché par
 * l'opticien.
 *  1. Image en niveaux de gris, réduite et lissée.
 *  2. Pour chaque angle, profil de luminosité le long du rayon et « force de
 *     bord » orientée : on cherche le passage CLAIR → FONCÉ en s'éloignant du
 *     centre (bord intérieur du cercle de monture, ou trait du gabarit sur
 *     fond clair). Le bord extérieur du cercle, de polarité inverse, est
 *     ignoré : sinon la forme serait gonflée de l'épaisseur de la monture.
 *  3. Programmation dynamique sur tous les angles : on retient le chemin
 *     fermé qui maximise la force de bord tout en restant régulier. Un logo
 *     ou une croix imprimée sur le verre de démo ne forme pas un contour
 *     fermé, il est donc écarté naturellement.
 */

export interface GrayImage {
  w: number;
  h: number;
  data: Float32Array;
  /** Facteur image source → image de travail (px source par px de travail). */
  factor: number;
}

/** Image de travail en niveaux de gris (côté max `maxSide` px). */
export function toGrayImage(src: CanvasImageSource, srcW: number, srcH: number, maxSide = 1000): GrayImage {
  const factor = Math.max(1, Math.max(srcW, srcH) / maxSide);
  const w = Math.round(srcW / factor), h = Math.round(srcH / factor);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(src, 0, 0, w, h);
  const rgba = ctx.getImageData(0, 0, w, h).data;
  const data = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) data[i] = 0.299 * rgba[i * 4]! + 0.587 * rgba[i * 4 + 1]! + 0.114 * rgba[i * 4 + 2]!;
  return { w, h, data: boxBlur(boxBlur(data, w, h), w, h), factor };
}

export function boxBlur(src: Float32Array, w: number, h: number): Float32Array {
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          s += src[yy * w + xx]!;
          n++;
        }
      }
      out[y * w + x] = s / n;
    }
  }
  return out;
}

function sample(g: GrayImage, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= g.w - 1 || y >= g.h - 1) return NaN;
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const i = y0 * g.w + x0;
  const a = g.data[i]!, b = g.data[i + 1]!, c = g.data[i + g.w]!, d = g.data[i + g.w + 1]!;
  return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy;
}

export interface TraceOptions {
  /** Rayon minimal / maximal cherché, en px de l'image de travail. */
  minR: number;
  maxR: number;
  /** 'light' : fond clair (cas recommandé) ; 'dark' : verre posé sur fond foncé. */
  background?: 'light' | 'dark';
  /** Écart de rayon maximal entre deux angles voisins (px). */
  maxStep?: number;
}

export interface TraceResult {
  /** Rayons (px de travail) depuis le point de départ, un par degré. */
  radii: number[];
  /** Fiabilité 0-100 : part des angles où le bord retenu est franc. */
  confidence: number;
}

/** Contour du verre autour de `seed` (px de l'image de travail). */
export function traceContour(g: GrayImage, seed: Pt2, opts: TraceOptions): TraceResult {
  const n = TRACE_POINTS;
  const minR = Math.max(3, Math.floor(opts.minR));
  const maxR = Math.max(minR + 5, Math.floor(opts.maxR));
  const R = maxR - minR + 1;
  const sign = opts.background === 'dark' ? 1 : -1; // clair→foncé : dérivée négative
  const step = opts.maxStep ?? Math.max(2, Math.round(maxR / 60));

  // Force de bord orientée E[a][r], normalisée.
  const E = new Float32Array(n * R);
  const rayMax = new Float32Array(n);
  for (let a = 0; a < n; a++) {
    const t = (a * 2 * Math.PI) / n;
    const dx = Math.cos(t), dy = -Math.sin(t); // image : y vers le bas
    for (let k = 0; k < R; k++) {
      const r = minR + k;
      // Dérivée centrée sur 4 px : robuste au bruit de la photo.
      const inner = sample(g, seed.x + dx * (r - 2), seed.y + dy * (r - 2));
      const outer = sample(g, seed.x + dx * (r + 2), seed.y + dy * (r + 2));
      const v = Number.isNaN(inner) || Number.isNaN(outer) ? 0 : Math.max(0, sign * (outer - inner));
      E[a * R + k] = v;
      if (v > rayMax[a]!) rayMax[a] = v;
    }
  }
  const sorted = Array.from(rayMax).sort((x, y) => x - y);
  const norm = Math.max(1, sorted[Math.floor(n * 0.9)]!);
  for (let i = 0; i < E.length; i++) E[i] = Math.min(1.5, E[i]! / norm);

  // Programmation dynamique sur deux tours : le second tour, déjà « amorcé »
  // par le premier, donne un chemin cohérent au point de raccord.
  const turns = 2 * n;
  const score = new Float32Array(turns * R);
  const from = new Int16Array(turns * R);
  const penalty = 0.04;
  for (let k = 0; k < R; k++) score[k] = E[k]!;
  for (let a = 1; a < turns; a++) {
    const ea = (a % n) * R;
    for (let k = 0; k < R; k++) {
      let best = -Infinity, arg = k;
      const lo = Math.max(0, k - step), hi = Math.min(R - 1, k + step);
      for (let j = lo; j <= hi; j++) {
        const s = score[(a - 1) * R + j]! - penalty * Math.abs(j - k);
        if (s > best) { best = s; arg = j; }
      }
      score[a * R + k] = best + E[ea + k]!;
      from[a * R + k] = arg;
    }
  }
  let k = 0;
  for (let j = 1; j < R; j++) if (score[(turns - 1) * R + j]! > score[(turns - 1) * R + k]!) k = j;
  const path = new Array<number>(turns);
  for (let a = turns - 1; a >= 0; a--) {
    path[a] = k;
    k = from[a * R + k]!;
  }
  const radii = new Array<number>(n);
  let strong = 0;
  for (let a = 0; a < n; a++) {
    const kk = path[n + a]!;
    radii[a] = minR + kk;
    if (E[a * R + kk]! >= 0.35 && E[a * R + kk]! * norm >= 0.5 * rayMax[a]!) strong++;
  }
  return { radii: smoothCircular(radii, 2), confidence: Math.round((strong / n) * 100) };
}

function smoothCircular(v: number[], h: number): number[] {
  const n = v.length;
  return v.map((_, i) => {
    let s = 0;
    for (let k = -h; k <= h; k++) s += v[(i + k + n) % n]!;
    return s / (2 * h + 1);
  });
}

/**
 * Retouche manuelle : déplace le contour vers `radius` autour de l'angle
 * `angleDeg`, avec un raccord progressif (gaussienne de `spreadDeg`).
 */
export function pullContour(radii: readonly number[], angleDeg: number, radius: number, spreadDeg = 8): number[] {
  const n = radii.length;
  return radii.map((r, i) => {
    let d = Math.abs(i - angleDeg) % n;
    if (d > n / 2) d = n - d;
    const w = Math.exp(-(d * d) / (2 * spreadDeg * spreadDeg));
    return r + (radius - r) * w;
  });
}

/**
 * Contour en pixels (autour de `seed`) → rayons normalisés en mm (verre droit
 * vu de face, centre de boîte). `mirror` : verre gauche, ou gabarit retourné.
 */
export function pixelsToRadiiMm(radiiPx: readonly number[], pxPerMm: number, mirror: boolean): number[] {
  const n = radiiPx.length;
  const pts = radiiPx.map((r, i) => {
    const t = (i * 2 * Math.PI) / n;
    const x = (r * Math.cos(t)) / pxPerMm;
    const y = (r * Math.sin(t)) / pxPerMm; // l'angle est déjà compté vers le haut
    return { x: mirror ? -x : x, y };
  });
  return toBoxedRadii(pts);
}

/** Aperçu JPEG réduit de la photo, conservé avec la fiche pour reprendre le tracé. */
export function photoPreview(src: CanvasImageSource, srcW: number, srcH: number, maxSide = 900): string {
  const f = Math.max(1, Math.max(srcW, srcH) / maxSide);
  const c = document.createElement('canvas');
  c.width = Math.round(srcW / f);
  c.height = Math.round(srcH / f);
  c.getContext('2d')!.drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.72);
}
