import { api } from '../../lib/api';
import type {
  ProductCreateInput,
  ProductUpdateInput,
  CustomerCreateInput,
  PrescriptionCreateInput,
  SaleCreateInput,
  PaymentMethod,
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
}

export async function listProducts(params: { search?: string; category?: string } = {}) {
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

export async function deleteProduct(id: string) {
  await api.delete(`/products/${id}`);
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

export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  email?: string | null;
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
}

export async function getCustomer(id: string) {
  const { data } = await api.get(`/customers/${id}`);
  return data.customer as Customer & {
    prescriptions: Prescription[];
    sales: { id: string; number: string; totalAmount: string; status: string; createdAt: string }[];
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

export async function createSale(input: SaleCreateInput) {
  const { data } = await api.post('/sales', input);
  return data.sale;
}

export async function listSales(params: { type?: string; branchId?: string; page?: number } = {}) {
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
  customer?: { firstName: string; lastName: string } | null;
  branch: { name: string };
}

export interface SaleDetailItem {
  id: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
  product: { name: string; sku: string };
}

export interface SaleDetail {
  id: string;
  number: string;
  type: 'SALE' | 'QUOTE';
  status: string;
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  insuranceAmount: string;
  totalAmount: string;
  paidAmount: string;
  currency: string;
  createdAt: string;
  items: SaleDetailItem[];
  customer?: { firstName: string; lastName: string; phone?: string | null; email?: string | null } | null;
  branch: { name: string; city?: string | null; address?: string | null; phone?: string | null };
  cashier?: { firstName: string; lastName: string } | null;
}

export async function getSale(id: string): Promise<SaleDetail> {
  const { data } = await api.get(`/sales/${id}`);
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

export async function simulatePayment(paymentId: string, status: 'SUCCESS' | 'FAILED' = 'SUCCESS') {
  const { data } = await api.post(`/payments/${paymentId}/simulate-callback`, { status });
  return data as { ok: boolean; status: string };
}

export interface DashboardData {
  todayRevenue: number;
  monthRevenue: number;
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
  revenueByDay: { date: string; revenue: number }[];
  paymentBreakdown: { method: string; total: number }[];
}

export async function getDashboard(branchId?: string): Promise<DashboardData> {
  const { data } = await api.get<{ dashboard: DashboardData }>('/dashboard', {
    params: branchId ? { branchId } : {},
  });
  return data.dashboard;
}
