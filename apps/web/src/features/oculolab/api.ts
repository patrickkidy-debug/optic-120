import type { FrameTraceInput, FrameTraceUpdate, FrameType, Precal, TraceSource, TraceStatus } from '@oculo/shared-types';
import { api } from '../../lib/api';

export interface FrameTrace {
  id: string;
  number: string;
  label: string | null;
  customerId: string | null;
  customer: { id: string; firstName: string; lastName: string; phone: string | null } | null;
  supplierId: string | null;
  supplier: { id: string; name: string; phone: string | null; whatsapp: string | null; email: string | null } | null;
  lensOrderId: string | null;
  measurementId: string | null;
  prescriptionId: string | null;
  source: TraceSource;
  frameType: FrameType;
  frameRef: string | null;
  radii: number[];
  boxA: number;
  boxB: number;
  dbl: number;
  ed: number;
  circumference: number;
  confidence: number | null;
  photoUrl?: string | null;
  precal: Precal;
  status: TraceStatus;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function listTraces(customerId?: string): Promise<FrameTrace[]> {
  const { data } = await api.get<{ traces: FrameTrace[] }>('/oculolab/traces', { params: customerId ? { customerId } : {} });
  return data.traces;
}

export async function getTrace(id: string): Promise<FrameTrace> {
  const { data } = await api.get<{ trace: FrameTrace }>(`/oculolab/traces/${id}`);
  return data.trace;
}

export async function createTrace(input: FrameTraceInput): Promise<FrameTrace> {
  const { data } = await api.post<{ trace: FrameTrace }>('/oculolab/traces', input);
  return data.trace;
}

export async function updateTrace(id: string, input: FrameTraceUpdate): Promise<FrameTrace> {
  const { data } = await api.patch<{ trace: FrameTrace }>(`/oculolab/traces/${id}`, input);
  return data.trace;
}

export async function deleteTrace(id: string): Promise<void> {
  await api.delete(`/oculolab/traces/${id}`);
}
