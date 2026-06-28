import { api } from '../../lib/api';
import type { PaymentMethod } from '@oculo/shared-types';

export interface Plan {
  id: string;
  code: string;
  name: string;
  description: string | null;
  priceMonthly: number;
  currency: string;
  trialDays: number;
  maxUsers: number | null;
  maxBranches: number | null;
  maxPatients: number | null;
  maxSales: number | null;
  features: string[];
}

export interface SubscriptionInfo {
  id: string;
  status: string;
  autoRenew: boolean;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialEndsAt: string | null;
  plan: {
    id: string;
    code: string;
    name: string;
    priceMonthly: number;
    maxUsers: number | null;
    maxBranches: number | null;
    maxPatients: number | null;
    maxSales: number | null;
  };
  usage: { users: number; branches: number; patients: number; sales: number };
}

export interface SubInvoice {
  id: string;
  number: string;
  amount: string;
  currency: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  paidAt: string | null;
}

export interface PayResult {
  invoiceId: string;
  paymentId: string;
  status: string;
  instruction?: string;
  redirectUrl?: string;
  simulation: boolean;
}

export async function getPlans(): Promise<Plan[]> {
  const { data } = await api.get<{ plans: Plan[] }>('/billing/plans');
  return data.plans;
}
export async function getSubscription(): Promise<SubscriptionInfo | null> {
  const { data } = await api.get<{ subscription: SubscriptionInfo | null }>('/billing/subscription');
  return data.subscription;
}
export async function getInvoices(): Promise<SubInvoice[]> {
  const { data } = await api.get<{ invoices: SubInvoice[] }>('/billing/invoices');
  return data.invoices;
}
export async function subscribe(planId: string, method: PaymentMethod, customerPhone?: string) {
  const { data } = await api.post<PayResult>('/billing/subscribe', { planId, method, customerPhone });
  return data;
}
export async function payInvoice(invoiceId: string, method: PaymentMethod, customerPhone?: string) {
  const { data } = await api.post<PayResult>(`/billing/invoices/${invoiceId}/pay`, { method, customerPhone });
  return data;
}
export async function billingPaymentStatus(paymentId: string) {
  const { data } = await api.get<{ status: string }>(`/billing/payments/${paymentId}/status`);
  return data;
}
export async function simulateBillingPayment(paymentId: string, status: 'SUCCESS' | 'FAILED' = 'SUCCESS') {
  const { data } = await api.post<{ ok: boolean; status: string }>(
    `/billing/payments/${paymentId}/simulate-callback`,
    { status },
  );
  return data;
}

/* --- Console plateforme (opérateur) --- */

export interface PlatformSub {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  status: string;
  planName: string;
  planCode: string;
  currentPeriodEnd: string;
  autoRenew: boolean;
}

export async function listAllSubscriptions(): Promise<PlatformSub[]> {
  const { data } = await api.get<{ subscriptions: PlatformSub[] }>('/platform/subscriptions');
  return data.subscriptions;
}
export async function platformSuspend(tenantId: string) {
  await api.post(`/platform/subscriptions/${tenantId}/suspend`);
}
export async function platformReactivate(tenantId: string) {
  await api.post(`/platform/subscriptions/${tenantId}/reactivate`);
}
export async function runBilling() {
  const { data } = await api.post<{ markedPastDue: number; suspended: number }>('/platform/billing/run');
  return data;
}
