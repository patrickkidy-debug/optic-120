import {
  PRECAL_INDICES,
  estimateThickness,
  maxRadiusFrom,
  minBlankDiameter,
  opticalCenterOffset,
  shapeStats,
  standardBlank,
  strongestPower,
  suggestIndex,
  type EyePrecal,
  type FrameType,
  type Precal,
  type Pt2,
  type ShapeStats,
  type ThicknessEstimate,
} from '@oculo/shared-types';

export interface EyeResult {
  /** Centre optique / centre de boîte (mm, x vers le nez, y vers le haut). */
  oc: Pt2;
  /** Diamètre minimal de palet (mm) et palet standard conseillé. */
  mbd: number;
  blank: number | null;
  /** Puissance du méridien le plus fort (null sans prescription). */
  power: number | null;
  maxRadius: number;
  thickness: ThicknessEstimate[];
  suggestedIndex: number | null;
}

export type WarningCode =
  | 'missingPd'
  | 'missingHeight'
  | 'heightTooLow'
  | 'shallowFrame'
  | 'bigDecentration'
  | 'blankTooLarge'
  | 'thickEdge'
  | 'rimlessIndex'
  | 'pdAsymmetry'
  | 'lowConfidence';

export interface PrecalWarning {
  code: WarningCode;
  eye?: 'od' | 'og';
  level: 'warn' | 'danger';
  values?: Record<string, string | number>;
}

export interface PrecalResult {
  stats: ShapeStats;
  /** Écart de monture (A + DBL), mm. */
  framePd: number;
  od: EyeResult;
  og: EyeResult;
  warnings: PrecalWarning[];
}

/** Hauteur de montage minimale par défaut d'un progressif « court » (mm). */
export const DEFAULT_MIN_FITTING_HEIGHT = 16;

function eyeResult(radii: readonly number[], stats: ShapeStats, dbl: number, eye: EyePrecal): EyeResult {
  // Les deux verres sont calculés dans le repère « x vers le nez » : le verre
  // gauche y a exactement la forme du droit (miroir), le calcul est commun.
  const oc = opticalCenterOffset(stats, dbl, { monoPd: eye.monoPd ?? null, height: eye.height ?? null });
  const maxRadius = maxRadiusFrom(radii, oc);
  const mbd = minBlankDiameter(radii, oc);
  const hasRx = eye.sphere != null || eye.cylinder != null;
  const power = hasRx ? strongestPower({ sphere: eye.sphere ?? 0, cylinder: eye.cylinder ?? 0 }) : null;
  return {
    oc,
    mbd,
    blank: standardBlank(mbd),
    power,
    maxRadius: Math.round(maxRadius * 10) / 10,
    thickness: power == null || power === 0 ? [] : PRECAL_INDICES.map((n) => estimateThickness(power, maxRadius, n)),
    suggestedIndex: power == null || power === 0 ? null : suggestIndex(power, maxRadius),
  };
}

export function computePrecal(
  radii: readonly number[],
  dbl: number,
  precal: Precal,
  context: { frameType: FrameType; confidence?: number | null },
): PrecalResult {
  const stats = shapeStats(radii);
  const od = eyeResult(radii, stats, dbl, precal.od);
  const og = eyeResult(radii, stats, dbl, precal.og);
  const warnings: PrecalWarning[] = [];
  const progressive = precal.design === 'PROGRESSIVE' || precal.design === 'BIFOCAL';
  const minH = precal.minFittingHeight ?? DEFAULT_MIN_FITTING_HEIGHT;

  if (context.confidence != null && context.confidence < 60) {
    warnings.push({ code: 'lowConfidence', level: 'warn', values: { n: context.confidence } });
  }
  if (progressive && stats.b < minH + 12) {
    warnings.push({ code: 'shallowFrame', level: 'danger', values: { b: stats.b.toFixed(1), min: minH + 12 } });
  }
  for (const side of ['od', 'og'] as const) {
    const e = precal[side];
    const r = side === 'od' ? od : og;
    if (e.monoPd == null) warnings.push({ code: 'missingPd', eye: side, level: 'danger' });
    if (e.height == null && progressive) warnings.push({ code: 'missingHeight', eye: side, level: 'danger' });
    if (e.height != null && progressive && e.height < minH) {
      warnings.push({ code: 'heightTooLow', eye: side, level: 'danger', values: { h: e.height, min: minH } });
    }
    if (Math.abs(r.oc.x) > 5) warnings.push({ code: 'bigDecentration', eye: side, level: 'warn', values: { d: Math.abs(r.oc.x).toFixed(1) } });
    if (r.blank == null) warnings.push({ code: 'blankTooLarge', eye: side, level: 'danger', values: { d: r.mbd.toFixed(1) } });
    const chosen = precal.index ?? 1.5;
    const t = r.thickness.find((x) => x.index === chosen) ?? (r.power != null && r.power !== 0 ? estimateThickness(r.power, r.maxRadius, chosen) : null);
    if (t && r.power != null && r.power < 0 && t.edge > 6) {
      warnings.push({ code: 'thickEdge', eye: side, level: 'warn', values: { t: t.edge.toFixed(1), index: chosen.toFixed(2), suggested: (r.suggestedIndex ?? chosen).toFixed(2) } });
    }
  }
  if (context.frameType === 'RIMLESS' && (precal.index ?? 1.5) < 1.56) {
    warnings.push({ code: 'rimlessIndex', level: 'warn' });
  }
  if (precal.od.monoPd != null && precal.og.monoPd != null && Math.abs(precal.od.monoPd - precal.og.monoPd) > 3) {
    warnings.push({ code: 'pdAsymmetry', level: 'warn', values: { d: Math.round(Math.abs(precal.od.monoPd - precal.og.monoPd) * 10) / 10 } });
  }
  return { stats, framePd: Math.round((stats.a + dbl) * 10) / 10, od, og, warnings };
}

/** Texte « +1.25 » / « −0.50 » pour les dioptries. */
export function fmtDpt(v: number | null | undefined): string {
  if (v == null) return '—';
  return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(2);
}

/** Texte « 3.0 » mm avec signe facultatif. */
export function fmtMm(v: number | null | undefined, signed = false): string {
  if (v == null) return '—';
  const s = Math.abs(v).toFixed(1);
  return signed ? (v > 0 ? '+' : v < 0 ? '−' : '') + s : (v < 0 ? '−' : '') + s;
}
