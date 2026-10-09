import type { MeasurementCreateInput, MeasurementMethod } from '@oculo/shared-types';
import { api } from '../../lib/api';

export interface Measurement {
  id: string;
  customerId: string | null;
  customer: { id: string; firstName: string; lastName: string; phone: string | null } | null;
  takenAt: string;
  method: MeasurementMethod;
  pdTotal: number | null;
  odMonoPd: number | null;
  ogMonoPd: number | null;
  odHeight: number | null;
  ogHeight: number | null;
  nearPd: number | null;
  lensWidth: number | null;
  lensHeight: number | null;
  bridge: number | null;
  vertex: number | null;
  pantoTilt: number | null;
  wrapAngle: number | null;
  frameLabel: string | null;
  notes: string | null;
}

export async function listMeasurements(customerId?: string | null): Promise<Measurement[]> {
  const { data } = await api.get<{ measurements: Measurement[] }>('/measurements', {
    params: customerId ? { customerId } : {},
  });
  return data.measurements;
}

export async function createMeasurement(input: MeasurementCreateInput): Promise<Measurement> {
  const { data } = await api.post<{ measurement: Measurement }>('/measurements', input);
  return data.measurement;
}

export async function deleteMeasurement(id: string): Promise<void> {
  await api.delete(`/measurements/${id}`);
}

/* ---------------- Calcul à partir des repères posés sur la photo ---------------- */

export type PointKey =
  | 'refL'
  | 'refR'
  | 'pupilR'
  | 'pupilL'
  | 'nose'
  | 'bottomR'
  | 'bottomL'
  | 'topR'
  | 'nasalR'
  | 'templeR'
  | 'nasalL';

export interface Pt {
  x: number;
  y: number;
}

export type MeasureValues = Partial<
  Record<
    | 'pdTotal'
    | 'odMonoPd'
    | 'ogMonoPd'
    | 'odHeight'
    | 'ogHeight'
    | 'lensWidth'
    | 'lensHeight'
    | 'bridge',
    number
  >
>;

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Convertit les repères (pixels de la photo) en millimètres.
 *
 * Échelle : longueur connue de la référence (carte 85,6 mm ou largeur de
 * monture) / sa longueur en pixels. Les distances sont mesurées dans le repère
 * de la ligne des pupilles, ce qui corrige une tête légèrement penchée :
 * horizontales le long de cette ligne, hauteurs perpendiculairement.
 *
 * Sur la photo, l'œil DROIT du client est à GAUCHE de l'image.
 */
export function computeMeasures(points: Partial<Record<PointKey, Pt>>, refMm: number): MeasureValues {
  const { refL, refR, pupilR, pupilL } = points;
  if (!refL || !refR || !pupilR || !pupilL || !(refMm > 0)) return {};
  const refPx = Math.hypot(refR.x - refL.x, refR.y - refL.y);
  if (refPx < 5) return {};
  const scale = refMm / refPx;

  // Repère : u le long de la ligne des pupilles (de l'œil droit vers l'œil gauche), v vers le bas.
  const len = Math.hypot(pupilL.x - pupilR.x, pupilL.y - pupilR.y) || 1;
  const u = { x: (pupilL.x - pupilR.x) / len, y: (pupilL.y - pupilR.y) / len };
  const v = { x: -u.y, y: u.x };
  const X = (p: Pt) => p.x * u.x + p.y * u.y;
  const Y = (p: Pt) => p.x * v.x + p.y * v.y;
  const mm = (px: number) => round1(Math.abs(px) * scale);

  const out: MeasureValues = { pdTotal: mm(X(pupilL) - X(pupilR)) };
  const { nose, bottomR, bottomL, topR, nasalR, templeR, nasalL } = points;
  if (nose) {
    out.odMonoPd = mm(X(nose) - X(pupilR));
    out.ogMonoPd = mm(X(pupilL) - X(nose));
  }
  if (bottomR) out.odHeight = mm(Y(bottomR) - Y(pupilR));
  if (bottomL) out.ogHeight = mm(Y(bottomL) - Y(pupilL));
  if (topR && bottomR) out.lensHeight = mm(Y(bottomR) - Y(topR));
  if (nasalR && templeR) out.lensWidth = mm(X(nasalR) - X(templeR));
  if (nasalR && nasalL) out.bridge = mm(X(nasalL) - X(nasalR));
  return out;
}
