import { api } from '../../lib/api';
import type {
  ProductCreateInput,
  ProductUpdateInput,
  CustomerCreateInput,
  PrescriptionCreateInput,
  SaleCreateInput,
  SaleUpdateInput,
  PaymentMethod,
  LensProductInput,
} from '@oculo/shared-types';

export interface Branch {
  id: string;
  name: string;
  city?: string | null;
  isActive: boolean;
}

export async function listBranches(): Promise<Branch[]> {
  const { data } = await api.get<{ branches: Branch[] }>('/branches');
  return data.branches;
}

export async function createBranch(input: { name: string; city?: string }) {
  const { data } = await api.post('/branches', input);
  return data.branch;
}

export interface Product {
  id: string;
  sku: string;
  category: string;
  brand?: string | null;
  name: string;
  buyPrice: string;
  sellPrice: string;
  isActive: boolean;
  /** Attributs libres (ex. type de verre + fournisseur pour la catégorie VERRE). */
  attributes?: Record<string, unknown> | null;
  /** Photo principale du catalogue visuel (data URL). */
  photoUrl?: string | null;
  /** Photos secondaires : absentes des listes, présentes sur la fiche. */
  photos?: string[] | null;
  createdAt?: string;
}

export async function listProducts(params: { search?: string; category?: string; page?: number; pageSize?: number } = {}) {
  const { data } = await api.get<{ items: Product[]; total: number }>('/products', { params });
  return data;
}

export async function createProduct(input: ProductCreateInput) {
  const { data } = await api.post('/products', input);
  return data.product;
}

export async function updateProduct(id: string, input: ProductUpdateInput) {
  const { data } = await api.patch(`/products/${id}`, input);
  return data.product;
}

/** Déplace en masse tous les produits d'une catégorie vers une autre (ex. corriger un import). */
export async function recategorizeProducts(from: string, to: string): Promise<{ count: number }> {
  const { data } = await api.patch<{ count: number }>('/products/recategorize', { from, to });
  return data;
}

/**
 * Supprime définitivement un produit. Un produit déjà vendu ne peut pas
 * disparaître (les lignes de factures en dépendent) : il est alors retiré du
 * catalogue et `deleted` vaut false.
 */
export async function deleteProduct(id: string): Promise<{
  ok: boolean;
  deleted: boolean;
  soldLines?: number;
}> {
  const { data } = await api.delete(`/products/${id}`);
  return data;
}

/** Crée/réutilise un produit verre configuré (type + traitements) au prix des Réglages. */
export async function ensureLensProduct(input: LensProductInput): Promise<Product> {
  const { data } = await api.post('/products/lens', input);
  return data.product;
}

export interface StockRow {
  productId: string;
  sku: string;
  name: string;
  brand?: string | null;
  category: string;
  sellPrice: number;
  stockItemId: string | null;
  quantity: number;
  minAlert: number;
  low: boolean;
  /** Stock illimité (verres fabriqués sur commande). */
  unlimited?: boolean;
  createdAt?: string;
}

export async function getStock(branchId: string, lowStockOnly = false): Promise<StockRow[]> {
  const { data } = await api.get<{ rows: StockRow[] }>('/stock', {
    params: { branchId, lowStockOnly: lowStockOnly ? 'true' : undefined },
  });
  return data.rows;
}

export async function adjustStock(input: {
  productId: string;
  branchId: string;
  delta: number;
  reason?: string;
  minAlert?: number;
}) {
  const { data } = await api.post('/stock/adjust', input);
  return data.item;
}

export async function lowStockCount(branchId: string): Promise<number> {
  const { data } = await api.get<{ count: number }>('/stock/alerts/count', { params: { branchId } });
  return data.count;
}

export interface StockMovement {
  id: string;
  type: 'PURCHASE_IN' | 'SALE_OUT' | 'ADJUSTMENT' | 'RETURN_IN' | 'TRANSFER';
  quantity: number;
  reason?: string | null;
  saleId?: string | null;
  createdById?: string | null;
  createdAt: string;
}

export async function getStockMovements(productId: string, branchId: string): Promise<StockMovement[]> {
  const { data } = await api.get<{ movements: StockMovement[] }>('/stock/movements', {
    params: { productId, branchId },
  });
  return data.movements;
}

export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  email?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  address?: string | null;
  profession?: string | null;
  notes?: string | null;
  loyaltyPoints?: number;
  createdAt?: string;
}

/* ---------------- Opérations de stock (réception / transfert / inventaire) ---------------- */

/** Réception d'une commande fournisseur : entrée de stock tracée avec coût. */
export async function receiveStock(input: {
  branchId: string;
  supplierId?: string;
  reference?: string;
  items: { productId: string; quantity: number; unitCost?: number }[];
}): Promise<{ lines: number; received: number }> {
  const { data } = await api.post('/stock/receive', input);
  return data;
}

/** Transfert de stock entre deux magasins. */
export async function transferStock(input: {
  fromBranchId: string;
  toBranchId: string;
  reason?: string;
  items: { productId: string; quantity: number }[];
}): Promise<{ lines: number; moved: number }> {
  const { data } = await api.post('/stock/transfer', input);
  return data;
}

/** Inventaire physique : régularise le stock sur les quantités comptées. */
export async function applyStockCount(input: {
  branchId: string;
  note?: string;
  items: { productId: string; countedQuantity: number }[];
}): Promise<{ counted: number; adjusted: number; net: number }> {
  const { data } = await api.post('/stock/count', input);
  return data;
}

export async function listCustomers(search?: string): Promise<Customer[]> {
  const { data } = await api.get<{ customers: Customer[] }>('/customers', { params: { search } });
  return data.customers;
}

export async function createCustomer(input: CustomerCreateInput) {
  const { data } = await api.post('/customers', input);
  return data.customer;
}

export async function updateCustomer(id: string, input: Partial<CustomerCreateInput>) {
  const { data } = await api.patch(`/customers/${id}`, input);
  return data.customer as Customer;
}

export interface Prescription {
  id: string;
  customerId: string;
  date: string;
  prescriberName: string | null;
  odSphere: string | null;
  odCylinder: string | null;
  odAxis: string | null;
  odAddition: string | null;
  ogSphere: string | null;
  ogCylinder: string | null;
  ogAxis: string | null;
  ogAddition: string | null;
  pupillaryDistance: string | null;
  lensType: string | null;
  notes: string | null;
  odHeight?: string | null;
  ogHeight?: string | null;
  odNearPd?: string | null;
  ogNearPd?: string | null;
  vertex?: string | null;
  pantoTilt?: string | null;
  /** Fin de validité de l'ordonnance (null = non renseignée). */
  expiresAt?: string | null;
  /** Photo / scan d'ordonnance papier (data URL). */
  photoUrl?: string | null;
}

/** Vente d'un client, avec ses articles (fiche client 360°). */
export interface CustomerSale {
  id: string;
  number: string;
  type: string;
  totalAmount: string;
  paidAmount: string;
  status: string;
  createdAt: string;
  branch: { name: string };
  items: { id: string; quantity: number; unitPrice: string; lineTotal: string; product: { name: string; sku: string; category: string } }[];
}
/** Commande de verres d'un client (fiche client 360°). */
export interface CustomerLensOrder {
  id: string;
  number: string;
  category: string | null;
  description: string;
  odLens: string | null;
  ogLens: string | null;
  status: LensOrderStatus;
  expectedAt: string | null;
  deliveredAt: string | null;
  cost: string | number | null;
  createdAt: string;
}
/** Réparation SAV d'un client (fiche client 360°). */
export interface CustomerRepair {
  id: string;
  number: string;
  category: string | null;
  description: string;
  status: RepairStatus;
  cost: string | number | null;
  createdAt: string;
}

export async function getCustomer(id: string) {
  const { data } = await api.get(`/customers/${id}`);
  return data.customer as Customer & {
    prescriptions: Prescription[];
    sales: CustomerSale[];
    lensOrders: CustomerLensOrder[];
    repairs: CustomerRepair[];
  };
}

export async function listPrescriptions(customerId: string): Promise<Prescription[]> {
  const { data } = await api.get<{ prescriptions: Prescription[] }>(`/customers/${customerId}/prescriptions`);
  return data.prescriptions;
}

export async function createPrescription(customerId: string, input: PrescriptionCreateInput) {
  const { data } = await api.post(`/customers/${customerId}/prescriptions`, input);
  return data.prescription as Prescription;
}

export async function updatePrescription(
  customerId: string,
  prescriptionId: string,
  input: Partial<PrescriptionCreateInput>,
) {
  const { data } = await api.patch(`/customers/${customerId}/prescriptions/${prescriptionId}`, input);
  return data.prescription as Prescription;
}

export async function deletePrescription(customerId: string, prescriptionId: string) {
  const { data } = await api.delete(`/customers/${customerId}/prescriptions/${prescriptionId}`);
  return data;
}

export async function createSale(input: SaleCreateInput) {
  const { data } = await api.post('/sales', input);
  return data.sale;
}

export async function listSales(
  params: { type?: string; branchId?: string; page?: number; pageSize?: number } = {},
) {
  const { data } = await api.get('/sales', { params });
  return data as { items: SaleListItem[]; total: number; page: number; pageSize: number };
}

export interface SaleListItem {
  id: string;
  number: string;
  type: string;
  status: string;
  totalAmount: string;
  paidAmount: string;
  createdAt: string;
  customer?: { firstName: string; lastName: string; phone?: string | null } | null;
  branch: { name: string };
  /**
   * Moyens d'encaissement utilisés (paiements réussis), sans doublon.
   * `INSURANCE` est ajouté en tête quand une part est prise en charge.
   */
  paymentMethods?: string[];
  /** Assureur ayant pris en charge une part de la vente, le cas échéant. */
  insurerName?: string | null;
  insuranceAmount?: string;
}

export interface SaleDetailItem {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
  /** Référence libre saisie à la vente (ex. référence fabricant), indépendante du stock. */
  reference: string | null;
  product: { name: string; sku: string };
}

/** Encaissement rattaché à une vente (détail des moyens de paiement). */
export interface SalePayment {
  id: string;
  method: string;
  status: string;
  amount: string;
  provider?: string | null;
  createdAt: string;
}

export interface SaleDetail {
  id: string;
  number: string;
  type: 'SALE' | 'QUOTE' | 'RETURN';
  status: string;
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  insuranceAmount: string;
  totalAmount: string;
  paidAmount: string;
  currency: string;
  createdAt: string;
  customerId?: string | null;
  insurerId?: string | null;
  /** Assureur ayant pris en charge une part de la vente, le cas échéant. */
  insurerName?: string | null;
  /** Ordonnance jointe au document (facultative). */
  prescriptionId?: string | null;
  prescription?: Prescription | null;
  items: SaleDetailItem[];
  payments?: SalePayment[];
  customer?: { firstName: string; lastName: string; phone?: string | null; email?: string | null } | null;
  branch: { name: string; city?: string | null; address?: string | null; phone?: string | null };
  cashier?: { firstName: string; lastName: string } | null;
}

export async function getSale(id: string): Promise<SaleDetail> {
  const { data } = await api.get(`/sales/${id}`);
  return data.sale as SaleDetail;
}

/** Modifie une vente ou un devis (permission optique.sales.update). */
export async function updateSale(id: string, input: SaleUpdateInput): Promise<SaleDetail> {
  const { data } = await api.patch(`/sales/${id}`, input);
  return data.sale as SaleDetail;
}

export async function cancelSale(id: string) {
  const { data } = await api.patch(`/sales/${id}/cancel`);
  return data.sale;
}

export async function convertQuote(id: string) {
  const { data } = await api.post(`/sales/${id}/convert-quote`);
  return data.sale;
}

export async function addPayment(
  saleId: string,
  input: { method: PaymentMethod; amount: number; customerPhone?: string },
) {
  const { data } = await api.post(`/sales/${saleId}/payments`, input);
  return data as {
    paymentId: string;
    status: string;
    providerRef: string;
    instruction?: string;
    redirectUrl?: string;
  };
}

export async function paymentStatus(paymentId: string) {
  const { data } = await api.get(`/payments/${paymentId}/status`);
  return data as { status: string; amount: number; method: string };
}

export interface Receivable {
  id: string;
  number: string;
  customer: string | null;
  customerPhone: string | null;
  branch: string;
  total: number;
  paid: number;
  balance: number;
  insuranceAmount?: number;
  insurerPaidAmount?: number;
  insuranceRemaining?: number;
  insurerName?: string | null;
  insurerId?: string | null;
  insurerPaidAt?: string | null;
  isInsuranceUnpaid?: boolean;
  createdAt: string;
}

export interface ReceivablesData {
  totalOutstanding: number;
  totalInsuranceOutstanding?: number;
  count: number;
  items: Receivable[];
}

export interface StockTransferItem {
  id: string;
  productId: string;
  quantity: number;
  product: { id: string; name: string; sku: string; brand?: string | null };
}

export interface StockTransferRecord {
  id: string;
  number: string;
  fromBranchId: string;
  fromBranch: { id: string; name: string };
  toBranchId: string;
  toBranch: { id: string; name: string };
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED';
  reason?: string | null;
  createdAt: string;
  confirmedAt?: string | null;
  createdBy?: { firstName: string; lastName: string } | null;
  confirmedBy?: { firstName: string; lastName: string } | null;
  items: StockTransferItem[];
}

export async function listStockTransfers(params?: {
  branchId?: string;
  direction?: 'incoming' | 'outgoing' | 'all';
  status?: 'PENDING' | 'CONFIRMED' | 'CANCELLED';
}): Promise<StockTransferRecord[]> {
  const { data } = await api.get<{ transfers: StockTransferRecord[] }>('/stock/transfers', { params });
  return data.transfers;
}

export async function confirmStockTransfer(id: string): Promise<StockTransferRecord> {
  const { data } = await api.post<{ transfer: StockTransferRecord }>(`/stock/transfers/${id}/confirm`);
  return data.transfer;
}

export async function cancelStockTransfer(id: string): Promise<StockTransferRecord> {
  const { data } = await api.post<{ transfer: StockTransferRecord }>(`/stock/transfers/${id}/cancel`);
  return data.transfer;
}

export async function listReceivables(branchId?: string): Promise<ReceivablesData> {
  const { data } = await api.get<ReceivablesData>('/sales/receivables', {
    params: branchId ? { branchId } : {},
  });
  return data;
}

export interface SalesReportRow {
  number: string;
  date: string;
  customer: string;
  branch: string;
  status: string;
  total: number;
  paid: number;
  balance: number;
}

export interface SalesReport {
  from: string;
  to: string;
  summary: { revenue: number; count: number; avgBasket: number };
  rows: SalesReportRow[];
}

export async function getSalesReport(params: {
  from: string;
  to: string;
  branchId?: string;
}): Promise<SalesReport> {
  const { data } = await api.get<SalesReport>('/sales/report', { params });
  return data;
}

export async function simulatePayment(paymentId: string, status: 'SUCCESS' | 'FAILED' = 'SUCCESS') {
  const { data } = await api.post(`/payments/${paymentId}/simulate-callback`, { status });
  return data as { ok: boolean; status: string };
}

export interface DashboardData {
  todayRevenue: number;
  /** Dépenses saisies aujourd'hui, déjà déduites de todayRevenue. */
  todayExpenses?: number;
  monthRevenue: number;
  /** Part prise en charge par les assurances (jour / mois). */
  todayInsurance?: number;
  monthInsurance?: number;
  /** Encaissé auprès des clients, hors part assurances (jour / mois). */
  todayCollected?: number;
  monthCollected?: number;
  todaySalesCount: number;
  customersCount: number;
  lowStockCount: number;
  recentSales: {
    id: string;
    number: string;
    total: number;
    paid: number;
    status: string;
    type: string;
    customer: string | null;
    branch: string;
    createdAt: string;
  }[];
  revenueByDay: { date: string; revenue: number; sales: number }[];
  paymentBreakdown: { method: string; total: number }[];
  monthSalesCount: number;
  avgBasket: number;
  newCustomersMonth: number;
  weekRevenue: number;
  prevWeekRevenue: number;
  topProducts: { name: string; revenue: number; quantity: number }[];
  activeCustomers?: number;
  activeCustomersPrev?: number;
}

export async function getDashboard(branchId?: string): Promise<DashboardData> {
  const { data } = await api.get<{ dashboard: DashboardData }>('/dashboard', {
    params: branchId ? { branchId } : {},
  });
  return data.dashboard;
}

export interface AdminDashboardData {
  branchBreakdown: { name: string; revenue: number; salesCount: number }[];
  topSellers: { name: string; revenue: number; salesCount: number }[];
  team: { usersTotal: number; usersActive: number };
  finance: { monthRevenue: number; monthExpenses: number; net: number };
}

export async function getAdminDashboard(): Promise<AdminDashboardData> {
  const { data } = await api.get<{ admin: AdminDashboardData }>('/dashboard/admin');
  return data.admin;
}

export type DashboardRange = '7d' | '30d' | '3m' | '12m';
export interface SeriesPoint {
  date: string;
  revenue: number;
  sales: number;
  collected: number;
  margin: number;
}
/** Série multi-métrique (CA/ventes/encaissé/marge) pour le graphique interactif. */
export async function getDashboardSeries(range: DashboardRange, branchId?: string): Promise<SeriesPoint[]> {
  const { data } = await api.get<{ series: SeriesPoint[] }>('/dashboard/series', {
    params: { range, ...(branchId ? { branchId } : {}) },
  });
  return data.series;
}

export interface ActivityItem {
  id: string;
  type: 'sale' | 'payment' | 'lens_order' | 'consultation' | 'stock_in';
  label: string;
  detail: string | null;
  amount: number | null;
  at: string;
}
/** Fil d'activité du jour (ventes, paiements, commandes labo, consultations, réceptions stock). */
export async function getDashboardActivity(branchId?: string): Promise<ActivityItem[]> {
  const { data } = await api.get<{ activity: ActivityItem[] }>('/dashboard/activity', {
    params: branchId ? { branchId } : {},
  });
  return data.activity;
}

/* ---------------- Commandes de verres (labo) & SAV ---------------- */
import type {
  LensOrderCreateInput,
  LensOrderStatus,
  LensOrderConfig,
  RepairCreateInput,
  RepairStatus,
} from '@oculo/shared-types';

export interface LensOrder {
  id: string;
  number: string;
  customerId: string | null;
  customer: { firstName: string; lastName: string; phone?: string | null } | null;
  category: string | null;
  supplierName: string | null;
  description: string;
  odLens: string | null;
  ogLens: string | null;
  frameProductId: string | null;
  frameProduct: { id: string; name: string; brand: string | null; photoUrl: string | null } | null;
  status: LensOrderStatus;
  expectedAt: string | null;
  deliveredAt: string | null;
  notifiedAt: string | null;
  cost: string | number | null;
  notes: string | null;
  lensConfig: LensOrderConfig | null;
  createdAt: string;
}
/** Nombre de commandes de verres en retard (échéance dépassée, non livrées). */
export async function lensOverdueCount(): Promise<number> {
  const { data } = await api.get<{ count: number }>('/optique/lens-orders/alerts/count');
  return data.count;
}
export async function listLensOrders(status?: string): Promise<LensOrder[]> {
  const { data } = await api.get<{ orders: LensOrder[] }>('/optique/lens-orders', {
    params: status ? { status } : {},
  });
  return data.orders;
}
export async function createLensOrder(input: LensOrderCreateInput): Promise<LensOrder> {
  const { data } = await api.post<{ order: LensOrder }>('/optique/lens-orders', input);
  return data.order;
}
export async function setLensOrderStatus(id: string, status: LensOrderStatus): Promise<void> {
  await api.patch(`/optique/lens-orders/${id}`, { status });
}

/** Entrée du journal d'activité d'une commande (créée, statut changé, rappel envoyé). */
export interface LensOrderEvent {
  id: string;
  action: string;
  metadata: { from?: string; to?: string; number?: string } | null;
  createdAt: string;
  userName: string | null;
}
export async function getLensOrderTimeline(id: string): Promise<LensOrderEvent[]> {
  const { data } = await api.get<{ events: LensOrderEvent[] }>(`/optique/lens-orders/${id}/timeline`);
  return data.events;
}
/** Marque le client comme prévenu (bouton « Notifier le client »). */
export async function notifyLensOrderClient(id: string): Promise<{ notifiedAt: string }> {
  const { data } = await api.post<{ ok: boolean; notifiedAt: string }>(`/optique/lens-orders/${id}/notified`);
  return data;
}

export interface Repair {
  id: string;
  number: string;
  customerId: string | null;
  customer: { firstName: string; lastName: string } | null;
  category: string | null;
  description: string;
  status: RepairStatus;
  cost: string | number | null;
  notes: string | null;
  createdAt: string;
}
export async function listRepairs(status?: string): Promise<Repair[]> {
  const { data } = await api.get<{ repairs: Repair[] }>('/optique/repairs', {
    params: status ? { status } : {},
  });
  return data.repairs;
}
export async function createRepair(input: RepairCreateInput): Promise<void> {
  await api.post('/optique/repairs', input);
}
export async function setRepairStatus(id: string, status: RepairStatus): Promise<void> {
  await api.patch(`/optique/repairs/${id}`, { status });
}

/* ---------------- Retours & avoirs ---------------- */
export async function createSaleReturn(saleId: string): Promise<void> {
  await api.post(`/sales/${saleId}/return`);
}

/* ---------------- Rappels de renouvellement ---------------- */
export interface Renewal {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  email?: string | null;
  renewPrescription: boolean;
  reorder: boolean;
  lastPrescriptionAt?: string | null;
  lastPurchaseAt?: string | null;
  lastLensType?: string | null;
  recommendedAt?: string | null;
}
export async function listRenewals(): Promise<Renewal[]> {
  const { data } = await api.get<{ renewals: Renewal[] }>('/optique/renewals');
  return data.renewals;
}

/* ---------------- IA prédictive (dashboard) ---------------- */
export interface ForecastData {
  hasEnoughData: boolean;
  history: { date: string; revenue: number }[];
  forecast: { date: string; revenue: number }[];
  actualMonthRevenue: number;
  projectedMonthRevenue: number;
  lastMonthRevenue: number;
  trendPct: number;
  next7Total: number;
  bestWeekday: { label: string; avg: number } | null;
  stockRisks: { product: string; stock: number; daysLeft: number }[];
}
export async function getForecast(branchId?: string): Promise<ForecastData> {
  const { data } = await api.get<{ forecast: ForecastData }>('/dashboard/forecast', {
    params: branchId ? { branchId } : {},
  });
  return data.forecast;
}
