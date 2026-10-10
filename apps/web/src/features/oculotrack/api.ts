import type { TrackAnomalyType, TrackAttachmentKind, TrackLocation, TrackPackageCreateInput, TrackStage } from '@oculo/shared-types';
import { api } from '../../lib/api';

export interface TrackOrderRow {
  id: string;
  number: string;
  trackCode: string;
  trackStage: TrackStage;
  trackStartedAt: string | null;
  description: string;
  frameRef: string | null;
  expectedAt: string | null;
  updatedAt: string;
  supplierId: string | null;
  supplierName: string | null;
  customer: { id: string; firstName: string; lastName: string } | null;
  frameProduct: { name: string; brand: string | null } | null;
  openAnomalies: number;
  lateDays: number;
  location: TrackLocation;
}

export interface TrackPackageRow {
  id: string;
  number: string;
  direction: 'OUTBOUND' | 'RETURN';
  status: 'PREPARING' | 'HANDED_TO_CARRIER' | 'IN_TRANSIT' | 'RECEIVED' | 'CANCELLED';
  fromCity: string | null;
  toCity: string | null;
  carrierName: string | null;
  externalTracking: string | null;
  expectedAt: string | null;
  shippedAt: string | null;
  receivedAt: string | null;
  createdAt: string;
  supplier: { id: string; name: string; city: string | null } | null;
  _count: { items: number };
  lateDays?: number;
}

export interface TrackEvent {
  id: string;
  type: string;
  stage: string | null;
  actorType: 'STAFF' | 'SUPPLIER' | 'CARRIER' | 'SYSTEM';
  actorName: string;
  message: string | null;
  meta?: Record<string, unknown> | null;
  occurredAt: string;
  lensOrderId?: string | null;
  packageId?: string | null;
}

export interface TrackAttachmentMeta {
  id: string;
  kind: TrackAttachmentKind;
  name: string | null;
  mime: string;
  sizeBytes: number;
  uploadedByName: string;
  uploadedByType?: string;
  createdAt: string;
}

export interface TrackAnomaly {
  id: string;
  type: TrackAnomalyType;
  comment: string | null;
  status: 'OPEN' | 'RESOLVED';
  reportedByType: string;
  reportedByName: string;
  resolvedAt: string | null;
  resolvedByName: string | null;
  resolution: string | null;
  createdAt: string;
  lensOrder?: { id: string; trackCode: string | null } | null;
  package?: { id: string; number: string } | null;
  lensOrderId?: string | null;
  packageId?: string | null;
}

export interface Dashboard {
  kpis: { inTransit: number; atSupplier: number; mounting: number; readyToReturn: number; inStore: number; late: number; anomalies: number };
  flows: { from: string; to: string; direction: string; count: number }[];
  latePackages: (TrackPackageRow & { lateDays: number })[];
  lateOrders: TrackOrderRow[];
  events: (TrackEvent & { lensOrder: { id: string; trackCode: string } | null; package: { id: string; number: string } | null })[];
}

export interface OrderDetail {
  order: {
    id: string;
    number: string;
    trackCode: string | null;
    trackStage: TrackStage | null;
    status: string;
    description: string;
    odLens: string | null;
    ogLens: string | null;
    frameRef: string | null;
    expectedAt: string | null;
    createdAt: string;
    notes: string | null;
    measurementId: string | null;
    lensConfig: {
      lensType?: string;
      material?: string;
      index?: string;
      treatments?: string[];
      prescription?: { sameForBoth?: boolean; od?: Record<string, number | string | undefined>; og?: Record<string, number | string | undefined> };
    } | null;
    publicUrl: string | null;
    customer: { id: string; firstName: string; lastName: string; phone: string | null } | null;
    frameProduct: { id: string; name: string; brand: string | null; photoUrl: string | null } | null;
    supplier: { id: string; name: string; phone: string | null; whatsapp: string | null; city: string | null } | null;
    supplierName: string | null;
    packageItems: { package: TrackPackageRow }[];
    trackAttachments: TrackAttachmentMeta[];
    trackAnomalies: TrackAnomaly[];
  };
  events: TrackEvent[];
  measurement: Record<string, number | string | null> | null;
  audit: { id: string; action: string; createdAt: string; userName: string | null }[];
}

export interface PackageDetail {
  package: TrackPackageRow & {
    token: string;
    scanUrl: string;
    note: string | null;
    carrierAccessId: string | null;
    weightGrams: number | null;
    supplier: { id: string; name: string; phone: string | null; whatsapp: string | null; city: string | null } | null;
    items: { lensOrderId: string; checks: Record<string, boolean> | null; lensOrder: { id: string; number: string; trackCode: string; trackStage: TrackStage; frameRef: string | null; description: string; customer: { firstName: string; lastName: string } | null } }[];
    attachments: TrackAttachmentMeta[];
    anomalies: TrackAnomaly[];
    lateDays: number;
  };
  events: TrackEvent[];
}

export interface PortalAccessRow {
  id: string;
  supplier: { id: string; name: string } | null;
  createdAt: string;
  account: { id: string; name: string; email: string; phone: string | null; kind: 'SUPPLIER' | 'CARRIER'; lastLoginAt: string | null; activated: boolean };
}

export interface Notification {
  id: string;
  kind: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export const ot = {
  dashboard: async () => (await api.get<Dashboard>('/oculotrack/dashboard')).data,
  orders: async (params: { q?: string; stage?: string; supplierId?: string; done?: string } = {}) =>
    (await api.get<{ orders: TrackOrderRow[] }>('/oculotrack/orders', { params })).data.orders,
  candidates: async () =>
    (await api.get<{ orders: { id: string; number: string; description: string; supplierName: string | null; createdAt: string; customer: { firstName: string; lastName: string } | null }[] }>('/oculotrack/orders/candidates')).data.orders,
  order: async (id: string) => (await api.get<OrderDetail>(`/oculotrack/orders/${id}`)).data,
  start: async (id: string, body: { supplierId: string; frameRef?: string; measurementId?: string; expectedAt?: string; note?: string }) =>
    (await api.post<{ trackCode: string }>(`/oculotrack/orders/${id}/start`, body)).data,
  updateOrder: async (id: string, body: { frameRef?: string; measurementId?: string | null; expectedAt?: string }) => (await api.patch(`/oculotrack/orders/${id}`, body)).data,
  storeStage: async (id: string, stage: 'FRAME_PREPARED' | 'COMPLETED' | 'CANCELLED', note?: string) => (await api.post(`/oculotrack/orders/${id}/stage`, { stage, note })).data,
  addAttachment: async (id: string, body: { kind: TrackAttachmentKind; name?: string; data: string }) => (await api.post(`/oculotrack/orders/${id}/attachments`, body)).data,
  attachment: async (id: string) => (await api.get<{ attachment: TrackAttachmentMeta & { data: string } }>(`/oculotrack/attachments/${id}`)).data.attachment,
  packages: async (params: { q?: string; status?: string } = {}) => (await api.get<{ packages: TrackPackageRow[] }>('/oculotrack/packages', { params })).data.packages,
  package: async (id: string) => (await api.get<PackageDetail>(`/oculotrack/packages/${id}`)).data,
  createPackage: async (body: TrackPackageCreateInput) => (await api.post<{ package: { id: string; number: string } }>('/oculotrack/packages', body)).data.package,
  handover: async (id: string, body: { carrierName?: string; externalTracking?: string; shippedAt?: string; expectedAt?: string; note?: string; photo?: string }) =>
    (await api.post(`/oculotrack/packages/${id}/handover`, body)).data,
  receive: async (id: string, body: { checks: Record<string, { received: boolean; reference: boolean; quantity: boolean; condition: boolean }>; note?: string; photo?: string }) =>
    (await api.post(`/oculotrack/packages/${id}/receive`, body)).data,
  cancelPackage: async (id: string) => (await api.post(`/oculotrack/packages/${id}/cancel`)).data,
  assignCarrier: async (id: string, accessId: string | null) => (await api.post(`/oculotrack/packages/${id}/carrier`, { accessId })).data,
  resolveToken: async (token: string) => (await api.get<{ packageId: string }>(`/oculotrack/resolve/${encodeURIComponent(token)}`)).data.packageId,
  anomalies: async (status?: string) => (await api.get<{ anomalies: TrackAnomaly[] }>('/oculotrack/anomalies', { params: status ? { status } : {} })).data.anomalies,
  reportAnomaly: async (body: { type: TrackAnomalyType; comment?: string; lensOrderId?: string; packageId?: string; photo?: string }) => (await api.post('/oculotrack/anomalies', body)).data,
  resolveAnomaly: async (id: string, resolution?: string) => (await api.post(`/oculotrack/anomalies/${id}/resolve`, { resolution })).data,
  notifications: async () => (await api.get<{ notifications: Notification[]; unread: number }>('/oculotrack/notifications')).data,
  readNotifications: async (ids?: string[]) => (await api.post('/oculotrack/notifications/read', { ids })).data,
  accesses: async () => (await api.get<{ accesses: PortalAccessRow[] }>('/oculotrack/portal-accesses')).data.accesses,
  invite: async (body: { kind: 'SUPPLIER' | 'CARRIER'; name: string; email: string; phone?: string; supplierId?: string }) =>
    (await api.post<{ inviteUrl: string | null; accountActivated: boolean }>('/oculotrack/portal-invite', body)).data,
  revokeAccess: async (id: string) => (await api.post(`/oculotrack/portal-accesses/${id}/revoke`)).data,
};
