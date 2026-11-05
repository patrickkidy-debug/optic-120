import type { RxLensRow, RxOrderCreateInput, RxSettingsInput, RxStatus, RxSupplierInput } from '@oculo/shared-types';
import { api } from '../../lib/api';

export interface RxSettings extends RxSettingsInput {
  shopMountingFee: number;
  geometryCoefficients: Partial<Record<string, number>>;
}

export interface RxSupplier {
  id: string;
  name: string;
  code: string | null;
  city: string | null;
  country: string | null;
  deliveryDays: number | null;
  contactName: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  orderEmail: string | null;
  rxCoefficient: number | null;
  rxVatRate: number | null;
  rxDemo: boolean;
  _count: { rxLenses: number; rxOrders: number };
}

export interface RxLens {
  id: string;
  supplierId: string;
  supplier: { id: string; name: string; code: string | null };
  reference: string;
  designation: string;
  geometry: string;
  /** STOCK ou RX (fabriqué sur mesure). */
  fabrication: string | null;
  lensIndex: number | null;
  material: string | null;
  treatment: string | null;
  diameter: number | null;
  sphMin: number | null;
  sphMax: number | null;
  cylMax: number | null;
  addMin: number | null;
  addMax: number | null;
  isActive: boolean;
  priceUpdatedAt: string;
  /** Catalogue boutique : nom commercial et prix de vente d'un verre au magasin. */
  shopName: string | null;
  shopPrice: number | null;
  /** Prix de vente d'un verre : celui du catalogue boutique (null tant qu'il n'est pas fixé). */
  suggestedPrice: number | null;
  /** Présents seulement avec la permission « marges ». */
  purchasePrice?: number;
  margin?: number;
  priceHistory?: { price: number; until: string }[];
}

export interface RxEyeValue {
  sph: number | null;
  cyl: number | null;
  axis: number | null;
}

/** « Commande de verres » liée (Kanban) et son code de suivi OculoTrack. */
export interface RxLensLink {
  id: string;
  number: string;
  trackCode: string | null;
  trackStage: string | null;
  status: string;
}

export interface RxOrder {
  id: string;
  lensOrder: RxLensLink | null;
  number: string;
  createdAt: string;
  status: RxStatus;
  statusHistory: { status: RxStatus; at: string; by?: string; note?: string }[];
  supplier: { id: string; name: string; code: string | null; phone?: string | null; whatsapp?: string | null };
  lens: { reference: string; designation: string; shopName?: string | null; fabrication?: string | null; geometry: string; lensIndex: number | null; material: string | null; treatment: string | null };
  customerId: string | null;
  patientName: string;
  fileNumber: string | null;
  od: RxEyeValue;
  og: RxEyeValue;
  addition: number | null;
  pd: number | null;
  height: number | null;
  frameType: string | null;
  mounted: boolean;
  urgent: boolean;
  comment: string | null;
  salePrice: number;
  saleId: string | null;
  userName: string | null;
  emailSentAt: string | null;
  isDemo: boolean;
  purchasePrice?: number;
  supplements?: { label: string; amount: number }[];
  margin?: number;
}

export interface RxMonthStats {
  orders: number;
  sales: number;
  purchases?: number;
  margin?: number;
  marginPct?: number;
}

export interface RxDashboard {
  month: string;
  previousMonth: string;
  current: RxMonthStats;
  previous: RxMonthStats;
  open: number;
  bySupplier: { id: string; name: string; orders: number; purchases?: number }[];
  recent: RxOrder[];
  canSeeMargins: boolean;
}

export interface RxStatementLine {
  id: string;
  date: string;
  number: string;
  patient: string;
  lens: string;
  supplements: string;
  amount: number;
  credit: boolean;
}

export interface RxStatement {
  supplier: { id: string; name: string; code: string; city: string | null; country: string | null; phone: string | null; orderEmail: string | null; address: string | null };
  month: string;
  number: string;
  lines: RxStatementLine[];
  orderCount: number;
  totalHt: number;
  vatRate: number;
  /** Base TVA : suppléments seulement (verres exonérés). */
  vatBase: number;
  vatAmount: number;
  totalTtc: number;
  dueDate: string;
  margin: number;
  marginPct: number;
}

export interface RxSavedStatement {
  id: string;
  supplierId: string;
  supplier?: { id: string; name: string; code: string | null };
  month: string;
  number: string;
  totalHt: number;
  vatRate: number;
  vatAmount: number;
  totalTtc: number;
  orderCount: number;
  dueDate: string;
  generatedAt: string;
  paidAt: string | null;
  paymentMethod: string | null;
}

/** Ordonnance d'un patient (dossier client ou commande de verres), prête à reprendre. */
export interface RxPatientSource {
  source: 'PRESCRIPTION' | 'LENS_ORDER';
  id: string;
  date: string;
  label: string;
  od: RxEyeValue;
  og: RxEyeValue;
  addition: number | null;
  pd: number | null;
  height: number | null;
}

export const rx = {
  patientRx: async (customerId: string) => (await api.get<{ sources: RxPatientSource[] }>('/oculorx/patient-rx', { params: { customerId } })).data.sources,
  packageOrders: async (orderIds: string[]) => (await api.post<{ package: { id: string; number: string } }>('/oculorx/orders/package', { orderIds })).data.package,
  settings: async () => (await api.get<{ settings: RxSettings; canSeeMargins: boolean }>('/oculorx/settings')).data,
  saveSettings: async (s: RxSettingsInput) => (await api.put<{ settings: RxSettings }>('/oculorx/settings', s)).data.settings,
  suppliers: async () => (await api.get<{ suppliers: RxSupplier[] }>('/oculorx/suppliers')).data.suppliers,
  createSupplier: async (s: RxSupplierInput) => (await api.post('/oculorx/suppliers', s)).data,
  updateSupplier: async (id: string, s: Partial<RxSupplierInput>) => (await api.patch(`/oculorx/suppliers/${id}`, s)).data,
  lenses: async (params: { supplierId?: string; q?: string; geometry?: string; index?: number; treatment?: string; all?: boolean }) =>
    (await api.get<{ lenses: RxLens[] }>('/oculorx/lenses', { params: { ...params, all: params.all ? '1' : undefined } })).data.lenses,
  importLenses: async (supplierId: string, rows: RxLensRow[]) =>
    (await api.post<{ added: number; updated: number; unchanged: number }>('/oculorx/lenses/import', { supplierId, rows })).data,
  setLensActive: async (id: string, isActive: boolean) => (await api.patch(`/oculorx/lenses/${id}`, { isActive })).data,
  clearCatalog: async (supplierId: string) => (await api.delete<{ deleted: number; deactivated: number }>(`/oculorx/suppliers/${supplierId}/lenses`)).data,
  updateLens: async (id: string, body: { shopName?: string | null; shopPrice?: number | null }) => (await api.patch(`/oculorx/lenses/${id}`, body)).data,
  orders: async (params: { status?: string; supplierId?: string; from?: string; to?: string; q?: string }) =>
    (await api.get<{ orders: RxOrder[] }>('/oculorx/orders', { params })).data.orders,
  createOrder: async (input: RxOrderCreateInput) => (await api.post<{ order: RxOrder; emailed: boolean }>('/oculorx/orders', input)).data,
  setStatus: async (id: string, status: RxStatus, note?: string) => (await api.post(`/oculorx/orders/${id}/status`, { status, note })).data,
  linkSale: async (id: string, saleNumber: string) => (await api.post<{ sale: { id: string; number: string } }>(`/oculorx/orders/${id}/link-sale`, { saleNumber })).data.sale,
  resend: async (id: string) => (await api.post(`/oculorx/orders/${id}/resend`)).data,
  dashboard: async () => (await api.get<RxDashboard>('/oculorx/dashboard')).data,
  statements: async () => (await api.get<{ statements: RxSavedStatement[] }>('/oculorx/statements')).data.statements,
  previewStatement: async (supplierId: string, month: string) =>
    (await api.get<{ statement: RxStatement; saved: RxSavedStatement | null }>('/oculorx/statements/preview', { params: { supplierId, month } })).data,
  generateStatement: async (supplierId: string, month: string) =>
    (await api.post<{ statement: RxStatement; saved: RxSavedStatement }>('/oculorx/statements', { supplierId, month })).data,
  payStatement: async (id: string, body: { paid: boolean; paidAt?: string; paymentMethod?: string }) => (await api.post(`/oculorx/statements/${id}/pay`, body)).data,
  seedDemo: async () => (await api.post<{ created: boolean }>('/oculorx/demo')).data,
  clearDemo: async () => (await api.delete('/oculorx/demo')).data,
};
