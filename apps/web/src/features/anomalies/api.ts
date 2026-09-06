import { api } from '../../lib/api';
import type {
  AnomalyDeclareInput,
  AnomalyModifyInput,
  AnomalyCategory,
  AnomalyStatus,
  AnomalyCorrectionType,
  AnomalyReasonCode,
  AnomalyTargetEntity,
} from '@oculo/shared-types';

export interface AnomalyUserRef {
  id: string;
  firstName: string;
  lastName: string;
}

export interface AnomalyCorrectionEntry {
  id: string;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  amountImpact: string | null;
  stockImpact: number | null;
  createdAt: string;
}

export interface Anomaly {
  id: string;
  number: string;
  category: AnomalyCategory;
  correctionType: AnomalyCorrectionType;
  targetEntity: AnomalyTargetEntity;
  targetId: string;
  targetReference: string;
  branchId: string | null;
  description: string;
  reasonCode: AnomalyReasonCode;
  reasonNote: string | null;
  comment: string | null;
  status: AnomalyStatus;
  financialImpact: string;
  stockImpact: number;
  cashImpact: string;
  insuranceImpact: string;
  declaredById: string;
  declaredBy?: AnomalyUserRef;
  declaredAt: string;
  submittedAt: string | null;
  approvedById: string | null;
  approvedBy?: AnomalyUserRef | null;
  approvedAt: string | null;
  approvalNote: string | null;
  rejectedById: string | null;
  rejectedBy?: AnomalyUserRef | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  appliedById: string | null;
  appliedBy?: AnomalyUserRef | null;
  appliedAt: string | null;
  cancelledById: string | null;
  cancelledBy?: AnomalyUserRef | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  entries: AnomalyCorrectionEntry[];
}

export interface AnomalyFilters {
  category?: AnomalyCategory;
  status?: AnomalyStatus;
  declaredById?: string;
  from?: string;
  to?: string;
  hasFinancialImpact?: boolean;
  hasStockImpact?: boolean;
  page?: number;
}

export async function listAnomalies(filters: AnomalyFilters = {}): Promise<{ items: Anomaly[]; total: number; page: number; pageSize: number }> {
  const { data } = await api.get('/anomalies', { params: filters });
  return data;
}

export async function getAnomaly(id: string): Promise<Anomaly> {
  const { data } = await api.get<{ anomaly: Anomaly }>(`/anomalies/${id}`);
  return data.anomaly;
}

export interface AnomalyDashboard {
  counts: { open: number; pendingValidation: number; approved: number; corrected: number; rejected: number; cancelled: number };
  financialImpact: number;
  stockImpact: number;
}

export async function getAnomalyDashboard(filters: Pick<AnomalyFilters, 'category' | 'declaredById' | 'from' | 'to'> = {}): Promise<AnomalyDashboard> {
  const { data } = await api.get('/anomalies/dashboard', { params: filters });
  return data;
}

export interface AnomalyJournalEntry {
  id: string;
  action: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  user: { firstName: string; lastName: string; email: string } | null;
}

export async function getAnomalyJournal(page = 1): Promise<{ items: AnomalyJournalEntry[]; total: number; page: number; pageSize: number }> {
  const { data } = await api.get('/anomalies/journal', { params: { page } });
  return data;
}

export interface AnomalyTimelineEvent {
  id: string;
  action: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  userName: string | null;
}

export async function getAnomalyTimeline(id: string): Promise<AnomalyTimelineEvent[]> {
  const { data } = await api.get<{ events: AnomalyTimelineEvent[] }>(`/anomalies/${id}/timeline`);
  return data.events;
}

export async function declareAnomaly(input: AnomalyDeclareInput): Promise<Anomaly> {
  const { data } = await api.post<{ anomaly: Anomaly }>('/anomalies', input);
  return data.anomaly;
}

export async function updateDeclaredAnomaly(id: string, input: AnomalyModifyInput): Promise<Anomaly> {
  const { data } = await api.patch<{ anomaly: Anomaly }>(`/anomalies/${id}`, input);
  return data.anomaly;
}

export async function submitAnomaly(id: string): Promise<Anomaly> {
  const { data } = await api.post<{ anomaly: Anomaly }>(`/anomalies/${id}/submit`, {});
  return data.anomaly;
}

export async function approveAnomaly(id: string, approvalNote?: string): Promise<Anomaly> {
  const { data } = await api.post<{ anomaly: Anomaly }>(`/anomalies/${id}/approve`, { approvalNote });
  return data.anomaly;
}

export async function rejectAnomaly(id: string, rejectionReason: string): Promise<Anomaly> {
  const { data } = await api.post<{ anomaly: Anomaly }>(`/anomalies/${id}/reject`, { rejectionReason });
  return data.anomaly;
}

export async function cancelAnomaly(id: string, cancellationReason: string): Promise<Anomaly> {
  const { data } = await api.post<{ anomaly: Anomaly }>(`/anomalies/${id}/cancel`, { cancellationReason });
  return data.anomaly;
}

export async function applyAnomalyCorrection(id: string): Promise<Anomaly> {
  const { data } = await api.post<{ anomaly: Anomaly }>(`/anomalies/${id}/apply`, {});
  return data.anomaly;
}
