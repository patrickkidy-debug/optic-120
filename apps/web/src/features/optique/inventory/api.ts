import { api } from '../../../lib/api';
import type { InventoryAdjustmentReason } from '@oculo/shared-types';

export type InventoryCountStatus = 'DRAFT' | 'COMPLETED' | 'CANCELLED';
export type InventoryLineStatusFilter =
  | 'all'
  | 'to_count'
  | 'counted'
  | 'conforme'
  | 'ecart'
  | 'manquant'
  | 'surplus';

interface PersonRef {
  firstName: string;
  lastName: string;
}

export interface InventoryCount {
  id: string;
  branchId: string;
  branch?: { id: string; name: string };
  status: InventoryCountStatus;
  scopeCategory?: string | null;
  scopeBrand?: string | null;
  scopeLocation?: string | null;
  note?: string | null;
  startedById?: string | null;
  startedBy?: PersonRef | null;
  validatedAt?: string | null;
  completedById?: string | null;
  completedBy?: PersonRef | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { lines: number };
  gapCount?: number;
  netValue?: number;
}

export interface InventoryCountLine {
  id: string;
  inventoryCountId: string;
  productId: string;
  theoreticalQty: number;
  countedQty: number | null;
  countedById?: string | null;
  countedAt?: string | null;
  locationSnapshot?: string | null;
  deltaQty: number | null;
  deltaValue: string | null;
  regularized: boolean;
  movementId?: string | null;
  reason?: InventoryAdjustmentReason | null;
  reasonNote?: string | null;
  product: { id: string; name: string; sku: string; brand: string | null; buyPrice: string };
}

export interface InventorySummary {
  total: number;
  toCount: number;
  counted: number;
  conforme: number;
  ecart: number;
  manquant: number;
  surplus: number;
  netValue: number;
}

export interface InventoryCountDetail {
  count: InventoryCount;
  summary: InventorySummary;
  lines: InventoryCountLine[];
  page: number;
  pageSize: number;
}

export async function createInventoryCount(input: {
  branchId: string;
  scopeCategory?: string;
  scopeBrand?: string;
  scopeLocation?: string;
  note?: string;
}): Promise<InventoryCount> {
  const { data } = await api.post<{ count: InventoryCount }>('/inventory-counts', input);
  return data.count;
}

export async function getActiveInventoryCount(branchId: string): Promise<InventoryCount | null> {
  const { data } = await api.get<{ count: InventoryCount | null }>('/inventory-counts/active', {
    params: { branchId },
  });
  return data.count;
}

export async function getInventoryCount(
  id: string,
  params: { status?: InventoryLineStatusFilter; search?: string; page?: number; pageSize?: number } = {},
): Promise<InventoryCountDetail> {
  const { data } = await api.get<InventoryCountDetail>(`/inventory-counts/${id}`, { params });
  return data;
}

export async function updateInventoryCountLine(
  countId: string,
  lineId: string,
  countedQty: number,
): Promise<InventoryCountLine> {
  const { data } = await api.patch<{ line: InventoryCountLine }>(
    `/inventory-counts/${countId}/lines/${lineId}`,
    { countedQty },
  );
  return data.line;
}

export async function scanInventoryCount(countId: string, code: string): Promise<InventoryCountLine> {
  const { data } = await api.post<{ line: InventoryCountLine }>(`/inventory-counts/${countId}/scan`, {
    code,
  });
  return data.line;
}

export async function validateInventoryCount(id: string): Promise<InventoryCount> {
  const { data } = await api.post<{ count: InventoryCount }>(`/inventory-counts/${id}/validate`);
  return data.count;
}

export async function regularizeInventoryCount(
  id: string,
  lines: { lineId: string; reason: InventoryAdjustmentReason; note?: string }[],
): Promise<{ inventoryCount: InventoryCount; regularized: number; net: number }> {
  const { data } = await api.post(`/inventory-counts/${id}/regularize`, { lines });
  return data;
}

export async function cancelInventoryCount(id: string): Promise<InventoryCount> {
  const { data } = await api.post<{ count: InventoryCount }>(`/inventory-counts/${id}/cancel`);
  return data.count;
}

export async function listInventoryCounts(
  params: { branchId?: string; page?: number; pageSize?: number } = {},
): Promise<{ items: InventoryCount[]; total: number; page: number; pageSize: number }> {
  const { data } = await api.get('/inventory-counts', { params });
  return data;
}
