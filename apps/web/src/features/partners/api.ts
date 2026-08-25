import { api } from '../../lib/api';
import type {
  PartnerStatus,
  PartnerTierCode,
  PartnerCommissionStatus,
  PartnerCommissionRuleUpsertInput,
  PartnerCommissionActionInput,
} from '@oculo/shared-types';

/* --------------------------- Console fondateur --------------------------- */

export interface AdminPartner {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  whatsapp: string;
  countryCode: string | null;
  city: string | null;
  status: PartnerStatus;
  tier: PartnerTierCode;
  referralCode: string;
  createdAt: string;
  approvedAt: string | null;
  suspendedAt: string | null;
  _count: { leads: number; commissions: number };
}

export async function listPartnersAdmin(status?: PartnerStatus): Promise<AdminPartner[]> {
  const { data } = await api.get<{ partners: AdminPartner[] }>('/platform/partners', {
    params: status ? { status } : undefined,
  });
  return data.partners;
}

export async function setPartnerStatusAdmin(id: string, status: PartnerStatus): Promise<AdminPartner> {
  const { data } = await api.patch<{ partner: AdminPartner }>(`/platform/partners/${id}/status`, { status });
  return data.partner;
}

export async function setPartnerTierAdmin(id: string, tier: PartnerTierCode): Promise<AdminPartner> {
  const { data } = await api.patch<{ partner: AdminPartner }>(`/platform/partners/${id}/tier`, { tier });
  return data.partner;
}

export interface CommissionRule {
  id: string;
  planCode: string;
  tier: PartnerTierCode;
  amount: string;
  currency: string;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export async function listCommissionRulesAdmin(): Promise<CommissionRule[]> {
  const { data } = await api.get<{ rules: CommissionRule[] }>('/platform/partners/commission-rules');
  return data.rules;
}

export async function upsertCommissionRuleAdmin(input: PartnerCommissionRuleUpsertInput): Promise<CommissionRule> {
  const { data } = await api.put<{ rule: CommissionRule }>('/platform/partners/commission-rules', input);
  return data.rule;
}

export interface AdminCommission {
  id: string;
  partnerId: string;
  tenantId: string;
  planCode: string;
  customerAmount: string;
  amount: string;
  currency: string;
  status: PartnerCommissionStatus;
  createdAt: string;
  approvedAt: string | null;
  paidAt: string | null;
  partner: { firstName: string; lastName: string; email: string };
}

export async function listCommissionsAdmin(status?: PartnerCommissionStatus): Promise<AdminCommission[]> {
  const { data } = await api.get<{ commissions: AdminCommission[] }>('/platform/partners/commissions', {
    params: status ? { status } : undefined,
  });
  return data.commissions;
}

export async function applyCommissionActionAdmin(
  id: string,
  input: PartnerCommissionActionInput,
): Promise<AdminCommission> {
  const { data } = await api.post<{ commission: AdminCommission }>(
    `/platform/partners/commissions/${id}/action`,
    input,
  );
  return data.commission;
}
