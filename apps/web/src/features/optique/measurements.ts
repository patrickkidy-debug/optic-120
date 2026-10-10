import type { MeasurementCalibration, MeasurementCreateInput, MeasurementMethod, MeasurementUpdateInput } from '@oculo/shared-types';
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
  frameWidth: number | null;
  ed: number | null;
  confidence: number | null;
  calibration: MeasurementCalibration | null;
  frameLabel: string | null;
  notes: string | null;
  autoValues?: Record<string, number | null> | null;
  /** Liste : vrai si une photo d'analyse est enregistrée (la photo n'est pas renvoyée). */
  hasPhoto?: boolean;
  updatedAt?: string | null;
}

/** Fiche complète : photo et repères, pour reprendre la mesure. */
export interface MeasurementDetail extends Measurement {
  photoUrl: string | null;
  markers: Record<string, unknown> | null;
}

export async function listMeasurements(customerId?: string | null): Promise<Measurement[]> {
  const { data } = await api.get<{ measurements: Measurement[] }>('/measurements', {
    params: customerId ? { customerId } : {},
  });
  return data.measurements;
}

export async function getMeasurement(id: string): Promise<MeasurementDetail> {
  const { data } = await api.get<{ measurement: MeasurementDetail }>(`/measurements/${id}`);
  return data.measurement;
}

export async function createMeasurement(input: MeasurementCreateInput): Promise<Measurement> {
  const { data } = await api.post<{ measurement: Measurement }>('/measurements', input);
  return data.measurement;
}

export async function updateMeasurement(id: string, input: MeasurementUpdateInput): Promise<Measurement> {
  const { data } = await api.patch<{ measurement: Measurement }>(`/measurements/${id}`, input);
  return data.measurement;
}

export async function deleteMeasurement(id: string): Promise<void> {
  await api.delete(`/measurements/${id}`);
}
