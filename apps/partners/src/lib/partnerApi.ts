import { api } from './api';
import type {
  PartnerSignupInput,
  PartnerLoginInput,
  PartnerLeadCreateInput,
  PartnerLeadUpdateInput,
  PartnerProfileUpdateInput,
  PartnerChangePasswordInput,
  PartnerAuthUser,
  PartnerDashboardStats,
  PartnerLeadStatus,
  PartnerCommissionStatus,
} from '@oculo/shared-types';

export async function signupPartner(input: PartnerSignupInput) {
  const { data } = await api.post<{ accessToken: string; partner: PartnerAuthUser }>(
    '/partners/auth/signup',
    input,
  );
  return data;
}

export async function loginPartner(input: PartnerLoginInput) {
  const { data } = await api.post<{ accessToken: string; partner: PartnerAuthUser }>(
    '/partners/auth/login',
    input,
  );
  return data;
}

export async function logoutPartner(): Promise<void> {
  await api.post('/partners/auth/logout');
}

export async function getMe(): Promise<PartnerAuthUser> {
  const { data } = await api.get<{ partner: PartnerAuthUser }>('/partners/me');
  return data.partner;
}

export async function updateProfile(input: PartnerProfileUpdateInput): Promise<PartnerAuthUser> {
  const { data } = await api.patch<{ partner: PartnerAuthUser }>('/partners/me', input);
  return data.partner;
}

export async function changePassword(input: PartnerChangePasswordInput): Promise<void> {
  await api.post('/partners/me/password', input);
}

export async function getDashboard(periodDays?: number): Promise<PartnerDashboardStats> {
  const { data } = await api.get<{ stats: PartnerDashboardStats }>('/partners/dashboard', {
    params: periodDays ? { period: periodDays } : undefined,
  });
  return data.stats;
}

export interface Lead {
  id: string;
  establishmentName: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  countryCode: string | null;
  city: string | null;
  source: string;
  status: PartnerLeadStatus;
  tenantId: string | null;
  lastActivityAt: string;
  createdAt: string;
}

export async function getLeads(): Promise<Lead[]> {
  const { data } = await api.get<{ leads: Lead[] }>('/partners/leads');
  return data.leads;
}

export async function createLead(input: PartnerLeadCreateInput): Promise<Lead> {
  const { data } = await api.post<{ lead: Lead }>('/partners/leads', input);
  return data.lead;
}

export async function updateLead(id: string, input: PartnerLeadUpdateInput): Promise<Lead> {
  const { data } = await api.patch<{ lead: Lead }>(`/partners/leads/${id}`, input);
  return data.lead;
}

export interface PartnerCustomer {
  tenantId: string;
  tenantName: string;
  countryCode: string | null;
  linkedAt: string | null;
  subscriptionStatus: string | null;
  planName: string | null;
  active: boolean;
  commissionGenerated: number;
}

export async function getCustomers(): Promise<PartnerCustomer[]> {
  const { data } = await api.get<{ customers: PartnerCustomer[] }>('/partners/customers');
  return data.customers;
}

export interface Commission {
  id: string;
  tenantId: string;
  planCode: string;
  customerAmount: string;
  amount: string;
  currency: string;
  status: PartnerCommissionStatus;
  createdAt: string;
  paidAt: string | null;
}

export async function getCommissions(): Promise<Commission[]> {
  const { data } = await api.get<{ commissions: Commission[] }>('/partners/commissions');
  return data.commissions;
}
