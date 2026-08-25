import { api } from '../../lib/api';
import type { PaymentMethod, BillingCycle } from '@oculo/shared-types';

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

export interface PlanStatus {
  status: string;
  planCode: string;
  currentPeriodEnd: string;
  trialEndsAt: string | null;
}

/** Statut minimal (offre + échéance) accessible à tout utilisateur connecté. */
export async function getPlanStatus(): Promise<PlanStatus | null> {
  const { data } = await api.get<{ status: PlanStatus | null }>('/billing/plan-status');
  return data.status;
}
export interface DemoRequest {
  id: string;
  tenantId: string | null;
  tenantName: string | null;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  preferredAt: string;
  notes: string | null;
  status: string;
  createdAt: string;
}

export async function bookDemo(input: {
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  preferredAt: string;
  notes?: string;
}): Promise<DemoRequest> {
  const { data } = await api.post<{ demo: DemoRequest }>('/billing/demo-request', input);
  return data.demo;
}

/** Dernière réservation de démo de l'établissement (état du bouton). */
export async function getMyDemoRequest(): Promise<DemoRequest | null> {
  const { data } = await api.get<{ demo: DemoRequest | null }>('/billing/demo-request/mine');
  return data.demo;
}

export async function getInvoices(): Promise<SubInvoice[]> {
  const { data } = await api.get<{ invoices: SubInvoice[] }>('/billing/invoices');
  return data.invoices;
}
export async function subscribe(
  planId: string,
  method: PaymentMethod,
  customerPhone?: string,
  cycle?: BillingCycle,
) {
  const { data } = await api.post<PayResult>('/billing/subscribe', { planId, method, customerPhone, cycle });
  return data;
}
export async function payInvoice(invoiceId: string, method: PaymentMethod, customerPhone?: string) {
  const { data } = await api.post<PayResult>(`/billing/invoices/${invoiceId}/pay`, { method, customerPhone });
  return data;
}
export interface ManualSubscribeResult {
  paymentId: string;
  invoiceId: string;
  number: string;
  amount: number;
  currency: string;
  planName: string;
}

export type ManualPaymentChannel = 'MOBILE_MONEY' | 'BANK_TRANSFER';

export interface PayInfo {
  /** Une passerelle de paiement en ligne est configurée. */
  gateway: boolean;
  /** Coordonnées Mobile Money de l'éditeur pour un règlement direct. */
  manual: { number: string; name: string | null; network: string | null } | null;
  /** Coordonnées bancaires de l'éditeur pour un règlement par virement. */
  bank: { bankName: string | null; accountName: string | null; accountNumber: string; swift: string | null } | null;
}

/** Moyens de règlement disponibles pour l'abonnement. */
export async function getPayInfo(): Promise<PayInfo> {
  const { data } = await api.get<PayInfo>('/billing/pay-info');
  return data;
}

export async function subscribeManual(
  planId: string,
  cycle?: BillingCycle,
  channel?: ManualPaymentChannel,
): Promise<ManualSubscribeResult> {
  const { data } = await api.post<ManualSubscribeResult>('/billing/subscribe-manual', { planId, cycle, channel });
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
  whatsapp: string | null;
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
/** Active/prolonge manuellement un abonnement (paiement reçu en direct, sans passerelle). */
export async function platformActivate(
  tenantId: string,
  months = 1,
  planCode?: string,
) {
  await api.post(`/platform/subscriptions/${tenantId}/activate`, { months, planCode });
}
/** Reconduit l'essai gratuit d'un tenant précis (statut TRIALING, sans paiement). */
export async function extendTrial(tenantId: string, minutes: number): Promise<{ tenantId: string; trialEndsAt: string }> {
  const { data } = await api.post<{ tenantId: string; trialEndsAt: string }>(
    `/platform/subscriptions/${tenantId}/extend-trial`,
    { minutes },
  );
  return data;
}

export async function runBilling() {
  const { data } = await api.post<{ markedPastDue: number; suspended: number }>('/platform/billing/run');
  return data;
}

export interface PendingPayment {
  id: string;
  tenantName: string;
  amount: number;
  currency: string;
  invoiceNumber: string;
  channel: ManualPaymentChannel | null;
  createdAt: string;
}

export async function listPendingPayments(): Promise<PendingPayment[]> {
  const { data } = await api.get<{ payments: PendingPayment[] }>('/platform/payments/pending');
  return data.payments;
}

export async function confirmPayment(id: string): Promise<void> {
  await api.post(`/platform/payments/${id}/confirm`);
}

/** Réservations de démonstration (console fondateur). */
export async function listDemoRequests(): Promise<DemoRequest[]> {
  const { data } = await api.get<{ demos: DemoRequest[] }>('/platform/demo-requests');
  return data.demos;
}
export async function setDemoRequestStatus(id: string, status: string): Promise<DemoRequest> {
  const { data } = await api.patch<{ demo: DemoRequest }>(`/platform/demo-requests/${id}`, { status });
  return data.demo;
}

export interface PlatformStats {
  tenantsTotal: number;
  usersTotal: number;
  usersActive: number;
  newTenants30d: number;
  newUsers30d: number;
  subsActive: number;
  subsTrialing: number;
  subsPastDue: number;
  subsSuspended: number;
  mrr: number;
}

export async function getPlatformStats(): Promise<PlatformStats> {
  const { data } = await api.get<{ stats: PlatformStats }>('/platform/stats');
  return data.stats;
}

export interface PlatformUser {
  id: string;
  /** Établissement du compte — sert à agir sur son abonnement (essai, activation, suspension). */
  tenantId: string;
  name: string;
  email: string;
  phone: string | null;
  tenantName: string;
  tenantSlug: string;
  roleLabel: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  /** Abonnement de l'établissement du compte. */
  subscriptionStatus: string | null;
  subscriptionEndsAt: string | null;
  planName: string | null;
  planCode: string | null;
  /** Vrai si l'abonnement est actif ET la période encore valide (hors essai). */
  isPaid: boolean;
}

export async function listPlatformUsers(): Promise<PlatformUser[]> {
  const { data } = await api.get<{ users: PlatformUser[] }>('/platform/users');
  return data.users;
}

export interface PlatformPlan {
  id: string;
  code: string;
  name: string;
  description: string | null;
  priceMonthly: string | number;
  trialDays: number;
  maxUsers: number | null;
  maxBranches: number | null;
  maxPatients: number | null;
  maxSales: number | null;
  isActive: boolean;
}

export async function getPlatformPlans(): Promise<PlatformPlan[]> {
  const { data } = await api.get<{ plans: PlatformPlan[] }>('/platform/plans');
  return data.plans;
}

export async function updatePlatformPlan(
  id: string,
  input: Partial<{
    name: string;
    priceMonthly: number;
    maxUsers: number | null;
    maxBranches: number | null;
    maxPatients: number | null;
    maxSales: number | null;
    isActive: boolean;
  }>,
): Promise<PlatformPlan> {
  const { data } = await api.patch<{ plan: PlatformPlan }>(`/platform/plans/${id}`, input);
  return data.plan;
}

/* --- Équipe & accès (opérateurs de la console fondateur) --- */

export interface PlatformOperator {
  id: string;
  email: string;
  name: string | null;
  readOnly: boolean;
  createdAt: string | null;
}

export async function listOperators(): Promise<PlatformOperator[]> {
  const { data } = await api.get<{ operators: PlatformOperator[] }>('/platform/operators');
  return data.operators;
}
export async function addOperator(email: string, name?: string): Promise<void> {
  await api.post('/platform/operators', { email, name });
}
export async function removeOperator(id: string): Promise<void> {
  await api.delete(`/platform/operators/${id}`);
}

/* --- Finances --- */

export interface FinanceSummary {
  totalRevenue: number;
  paidInvoicesCount: number;
  mrr: number;
  arpu: number;
  activeCount: number;
  churnRate30d: number;
}

export async function getFinanceSummary(): Promise<FinanceSummary> {
  const { data } = await api.get<{ summary: FinanceSummary }>('/platform/finance/summary');
  return data.summary;
}

export async function getRevenueSeries(days = 30): Promise<{ date: string; revenue: number }[]> {
  const { data } = await api.get<{ series: { date: string; revenue: number }[] }>(
    '/platform/finance/revenue',
    { params: { days } },
  );
  return data.series;
}

export interface PlatformInvoice {
  id: string;
  number: string;
  tenantName: string;
  tenantSlug: string;
  planName: string;
  amount: number;
  currency: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  paidAt: string | null;
  createdAt: string;
}

export async function listAllInvoices(status?: string): Promise<PlatformInvoice[]> {
  const { data } = await api.get<{ invoices: PlatformInvoice[] }>('/platform/finance/invoices', {
    params: status ? { status } : undefined,
  });
  return data.invoices;
}

/* --- Utilisateurs (actions cross-tenant) --- */

export async function setUserActive(id: string, isActive: boolean): Promise<void> {
  await api.patch(`/platform/users/${id}/active`, { isActive });
}
export async function forceLogoutUser(id: string): Promise<void> {
  await api.post(`/platform/users/${id}/force-logout`);
}
/** Réinitialise le mot de passe d'un utilisateur, sans email (console fondateur). */
export async function platformResetPassword(id: string): Promise<{ tempPassword: string }> {
  const { data } = await api.post<{ tempPassword: string }>(`/platform/users/${id}/reset-password`);
  return data;
}

/* --- Notifications (console fondateur) --- */

export interface PlatformNotification {
  id: string;
  type: string;
  tenantId: string | null;
  tenantName: string | null;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export async function getNotifications(): Promise<{ notifications: PlatformNotification[]; unreadCount: number }> {
  const { data } = await api.get<{ notifications: PlatformNotification[]; unreadCount: number }>(
    '/platform/notifications',
  );
  return data;
}

export async function markNotificationsRead(ids?: string[]): Promise<void> {
  await api.post('/platform/notifications/read', { ids });
}

/* --- Réglage : durée de l'essai gratuit (console fondateur) --- */

export async function getTrialSettings(): Promise<{ minutes: number }> {
  const { data } = await api.get<{ minutes: number }>('/platform/settings/trial');
  return data;
}

export async function setTrialSettings(minutes: number): Promise<{ minutes: number }> {
  const { data } = await api.patch<{ minutes: number }>('/platform/settings/trial', { minutes });
  return data;
}

export interface DemoEngagementRow {
  tenantId: string;
  tenantName: string;
  whatsappPhone: string | null;
  contactName: string | null;
  contactEmail: string | null;
  videosCompleted: number;
  avgPercent: number;
  totalViews: number;
  notUnderstoodCount: number;
  lastActivityAt: string | null;
  score: number;
}

/** Engagement sur les vidéos de démonstration, trié par score d'intérêt (console fondateur). */
export async function getDemoEngagement(): Promise<DemoEngagementRow[]> {
  const { data } = await api.get<{ rows: DemoEngagementRow[] }>('/platform/demo-engagement');
  return data.rows;
}
