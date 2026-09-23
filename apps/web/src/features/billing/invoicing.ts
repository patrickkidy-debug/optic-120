import type {
  BillingSettingsInput,
  InvoiceFilter,
  InvoiceMessageKind,
  ManualInvoiceInput,
  PaymentMethod,
  RecordPaymentInput,
  RefundInput,
} from '@oculo/shared-types';
import { api } from '../../lib/api';

/**
 * Facturation de l'éditeur (console fondateur). Les montants arrivent déjà
 * calculés par le serveur — `balance` comprise, qui est dérivée côté API et
 * jamais recalculée ici : deux calculs du même chiffre finissent toujours par
 * diverger.
 */

export interface InvoiceItem {
  id: string;
  description: string;
  periodLabel: string | null;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface InvoicePayment {
  id: string;
  amount: number;
  currency: string;
  method: string;
  methodLabel: string;
  status: string;
  reference: string | null;
  provider: string | null;
  paidAt: string | null;
  createdAt: string;
  notes: string | null;
}

export interface InvoiceRefund {
  id: string;
  amount: number;
  currency: string;
  reason: string;
  method: string | null;
  reference: string | null;
  refundedAt: string;
}

export interface InvoiceEventRow {
  id: string;
  type: string;
  message: string;
  actorName: string | null;
  reference: string | null;
  createdAt: string;
}

export interface Invoice {
  id: string;
  number: string;
  kind: 'INVOICE' | 'CREDIT_NOTE';
  creditedInvoiceId: string | null;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  planName: string;
  source: string;
  status: string;
  overdue: boolean;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  amountPaid: number;
  amountRefunded: number;
  balance: number;
  currency: string;
  issueDate: string;
  dueDate: string;
  paidAt: string | null;
  periodStart: string;
  periodEnd: string;
  periodMonths: number;
  cancelledAt: string | null;
  cancelReason: string | null;
  notes: string | null;
  billing: {
    name: string;
    contact: string | null;
    whatsapp: string | null;
    email: string | null;
    address: string | null;
    city: string | null;
    country: string | null;
  };
  items: InvoiceItem[];
  payments: InvoicePayment[];
  refunds: InvoiceRefund[];
  events?: InvoiceEventRow[];
}

export interface BillingOverview {
  from: string;
  to: string;
  revenue: {
    gross: number;
    refunded: number;
    credited: number;
    net: number;
    paymentsCount: number;
  };
  mrr: number;
  arpu: number;
  activeSubscriptions: number;
  outstanding: number;
  failed: { count: number; amount: number };
  refunds: { count: number; amount: number };
  creditNotes: { count: number; amount: number };
  invoices: {
    total: number;
    paid: number;
    pending: number;
    overdue: number;
    cancelled: number;
    refunded: number;
  };
  series: { date: string; amount: number }[];
  byMethod: { method: string; label: string; amount: number }[];
}

export interface BillingSettings {
  id: string;
  legalName: string | null;
  tradeName: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  taxId: string | null;
  registrationNumber: string | null;
  defaultCurrency: string;
  paymentTerms: string | null;
  paymentDetails: string | null;
  logoUrl: string | null;
  footerNote: string | null;
  whatsappNumber: string | null;
  autoSendOnPayment: boolean;
  remindBeforeDue: boolean;
  remindAfterDue: boolean;
  sendPaymentConfirmation: boolean;
  remindBeforeDays: number;
  invoiceWhatsappTemplate: string | null;
  reminderBeforeTemplate: string | null;
  reminderDueTemplate: string | null;
  reminderAfterTemplate: string | null;
}

export interface BillingClient {
  id: string;
  name: string;
  slug: string;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  country: string | null;
  currency: string;
  planId: string | null;
  planName: string | null;
  priceMonthly: number | null;
  status: string | null;
  currentPeriodEnd: string | null;
}

export interface BillingSubscriptionRow {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  isDemo: boolean;
  whatsapp: string | null;
  email: string | null;
  planName: string;
  planCode: string;
  priceMonthly: number;
  currency: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  autoRenew: boolean;
  lastPayment: { amount: number; at: string; method: string } | null;
  nextBillingDate: string | null;
}

export interface ReminderRow extends Invoice {
  daysToDue: number;
  reminderKind: InvoiceMessageKind;
}

export interface TenantBilling {
  tenant: {
    id: string;
    name: string;
    slug: string;
    whatsapp: string | null;
    email: string | null;
    address: string | null;
    country: string | null;
    currency: string;
  };
  subscription: {
    id: string;
    planId: string;
    planName: string;
    planCode: string;
    priceMonthly: number;
    currency: string;
    status: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    autoRenew: boolean;
  } | null;
  totals: { collected: number; outstanding: number; invoiceCount: number };
  invoices: Invoice[];
}

const BASE = '/platform/billing';

export async function getBillingOverview(params: { from?: string; to?: string }) {
  const { data } = await api.get<{ overview: BillingOverview }>(`${BASE}/overview`, { params });
  return data.overview;
}

export async function getBillingSettings() {
  const { data } = await api.get<{ settings: BillingSettings }>(`${BASE}/settings`);
  return data.settings;
}

export async function saveBillingSettings(input: BillingSettingsInput) {
  const { data } = await api.put<{ settings: BillingSettings }>(`${BASE}/settings`, input);
  return data.settings;
}

export interface InvoiceListParams {
  filter?: InvoiceFilter;
  search?: string;
  from?: string;
  to?: string;
  tenantId?: string;
  page?: number;
  pageSize?: number;
}

export async function listBillingInvoices(params: InvoiceListParams) {
  const { data } = await api.get<{
    invoices: Invoice[];
    total: number;
    page: number;
    pageSize: number;
  }>(`${BASE}/invoices`, { params });
  return data;
}

export async function getBillingInvoice(id: string) {
  const { data } = await api.get<{ invoice: Invoice }>(`${BASE}/invoices/${id}`);
  return data.invoice;
}

export async function createBillingInvoice(input: ManualInvoiceInput) {
  const { data } = await api.post<{ invoice: Invoice }>(`${BASE}/invoices`, input);
  return data.invoice;
}

export async function recordBillingPayment(id: string, input: RecordPaymentInput) {
  const { data } = await api.post<{ invoice: Invoice }>(`${BASE}/invoices/${id}/payments`, input);
  return data.invoice;
}

export async function markBillingInvoicePaid(id: string, method: PaymentMethod) {
  const { data } = await api.post<{ invoice: Invoice }>(`${BASE}/invoices/${id}/mark-paid`, { method });
  return data.invoice;
}

export async function refundBillingInvoice(id: string, input: RefundInput) {
  const { data } = await api.post<{ invoice: Invoice }>(`${BASE}/invoices/${id}/refund`, input);
  return data.invoice;
}

export async function cancelBillingInvoice(id: string, reason: string) {
  const { data } = await api.post<{ invoice: Invoice }>(`${BASE}/invoices/${id}/cancel`, { reason });
  return data.invoice;
}

export async function issueBillingCreditNote(id: string, amount?: number) {
  const { data } = await api.post<{ invoice: Invoice }>(`${BASE}/invoices/${id}/credit-note`, { amount });
  return data.invoice;
}

export async function duplicateBillingInvoice(id: string) {
  const { data } = await api.post<{ invoice: Invoice }>(`${BASE}/invoices/${id}/duplicate`);
  return data.invoice;
}

export async function getInvoiceMessage(id: string, kind: InvoiceMessageKind = 'invoice') {
  const { data } = await api.get<{ message: string; whatsapp: string | null; kind: string }>(
    `${BASE}/invoices/${id}/message`,
    { params: { kind } },
  );
  return data;
}

/** Trace l'envoi, une fois WhatsApp réellement ouvert (§19). */
export async function markInvoiceSent(id: string, channel: 'whatsapp' | 'email' = 'whatsapp') {
  await api.post(`${BASE}/invoices/${id}/sent`, { channel });
}

export async function listBillingSubscriptions() {
  const { data } = await api.get<{ subscriptions: BillingSubscriptionRow[] }>(`${BASE}/subscriptions`);
  return data.subscriptions;
}

export async function listBillingReminders() {
  const { data } = await api.get<{ reminders: ReminderRow[] }>(`${BASE}/reminders`);
  return data.reminders;
}

export async function listBillingClients() {
  const { data } = await api.get<{ clients: BillingClient[] }>(`${BASE}/clients`);
  return data.clients;
}

export async function getTenantBilling(tenantId: string) {
  const { data } = await api.get<TenantBilling>(`${BASE}/tenants/${tenantId}`);
  return data;
}
