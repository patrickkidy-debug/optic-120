import { api } from '../../lib/api';

/**
 * Console fondateur : lectures consolidées.
 *
 * Tous les compteurs de la page d'accueil viennent d'UN appel. Les répartir
 * donnerait plusieurs instantanés différents, donc des chiffres qui ne
 * s'additionnent pas entre eux à l'écran.
 */

export type RealSubState = 'paying' | 'trialing' | 'expired' | 'suspended' | 'cancelled';

export interface FounderOverview {
  period: { from: string; to: string; days: number };
  tenants: { total: number; created: number; previous: number };
  users: { total: number; active: number; created: number; previous: number };
  subscriptions: {
    paying: number;
    trialing: number;
    expired: number;
    suspended: number;
    cancelled: number;
    total: number;
  };
  revenue: {
    mrr: number;
    arr: number;
    collected: number;
    collectedPrevious: number;
    refunded: number;
    net: number;
    outstanding: number;
  };
  renewals: {
    /** null quand aucune échéance n'est tombée sur la période : pas de taux inventé. */
    rate: number | null;
    renewed: number;
    expired: number;
    today: number;
    next48h: number;
  };
  actionRequired: {
    failedPayments: number;
    renewalsToday: number;
    pendingConfirmations: number;
    demosToProcess: number;
    expiredClients: number;
    overdueInvoices: number;
  };
  series: { date: string; tenants: number; users: number; revenue: number }[];
}

export interface SearchResults {
  query: string;
  users: { id: string; name: string; email: string; phone: string | null; tenantId: string; tenantName: string }[];
  tenants: {
    id: string;
    name: string;
    slug: string;
    whatsapp: string | null;
    email: string | null;
    planName: string | null;
    state: RealSubState | null;
  }[];
  invoices: {
    id: string;
    number: string;
    tenantId: string;
    tenantName: string;
    total: number;
    balance: number;
    currency: string;
    status: string;
    createdAt: string;
  }[];
  payments: {
    id: string;
    reference: string | null;
    amount: number;
    currency: string;
    status: string;
    method: string;
    invoiceId: string;
    invoiceNumber: string;
    tenantId: string;
    tenantName: string;
    createdAt: string;
  }[];
  totals: { users?: number; tenants?: number; invoices?: number; payments?: number };
}

export interface ConsoleUser {
  id: string;
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
  subscriptionStatus: string | null;
  subscriptionEndsAt: string | null;
  planName: string | null;
  planCode: string | null;
  state: RealSubState | null;
  isPaid: boolean;
}

export interface ConsoleTenant {
  id: string;
  name: string;
  slug: string;
  country: string | null;
  location: string | null;
  whatsapp: string | null;
  email: string | null;
  createdAt: string;
  userCount: number;
  branchCount: number;
  planName: string | null;
  planCode: string | null;
  mrr: number;
  currency: string;
  status: string | null;
  state: RealSubState | null;
  currentPeriodEnd: string | null;
  autoRenew: boolean;
}

export interface TenantDetail {
  id: string;
  name: string;
  slug: string;
  country: string | null;
  location: string | null;
  whatsapp: string | null;
  email: string | null;
  currency: string;
  createdAt: string;
  isDemo: boolean;
  branches: { id: string; name: string }[];
  users: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    isActive: boolean;
    lastLoginAt: string | null;
    createdAt: string;
    roleLabel: string;
  }[];
  subscription: {
    planId: string;
    planName: string;
    planCode: string;
    priceMonthly: number;
    currency: string;
    status: string;
    state: RealSubState;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    autoRenew: boolean;
  } | null;
  mrr: number;
}

export async function getFounderOverview(params: { from?: string; to?: string }) {
  const { data } = await api.get<{ overview: FounderOverview }>('/platform/overview', { params });
  return data.overview;
}

export async function searchPlatform(q: string) {
  const { data } = await api.get<{ results: SearchResults }>('/platform/search', { params: { q } });
  return data.results;
}

export async function listConsoleUsers(params: {
  search?: string;
  filter?: string;
  page?: number;
  pageSize?: number;
}) {
  const { data } = await api.get<{
    users: ConsoleUser[];
    total: number;
    page: number;
    pageSize: number;
  }>('/platform/users/paged', { params });
  return data;
}

export async function listConsoleTenants(params: {
  search?: string;
  state?: string;
  page?: number;
  pageSize?: number;
}) {
  const { data } = await api.get<{
    tenants: ConsoleTenant[];
    total: number;
    page: number;
    pageSize: number;
  }>('/platform/tenants', { params });
  return data;
}

export async function getConsoleTenant(tenantId: string) {
  const { data } = await api.get<{ tenant: TenantDetail }>(`/platform/tenants/${tenantId}`);
  return data.tenant;
}

/** Libellés de l'état RÉEL d'un abonnement, partagés par tous les écrans. */
export const SUB_STATE_META: Record<
  RealSubState,
  { label: string; tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }
> = {
  paying: { label: 'Payant', tone: 'success' },
  trialing: { label: 'Essai', tone: 'info' },
  expired: { label: 'Expiré', tone: 'danger' },
  suspended: { label: 'Suspendu', tone: 'warning' },
  cancelled: { label: 'Annulé', tone: 'neutral' },
};
