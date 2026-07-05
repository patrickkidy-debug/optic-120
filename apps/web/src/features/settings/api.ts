import { api } from '../../lib/api';
import type { PaymentConfigInput, BrandingUpdateInput, InvoiceSettings } from '@oculo/shared-types';
import { useAuthStore } from '../../store/auth';

export interface MaskedPaymentConfig {
  provider?: 'paytech' | 'moneroo';
  apiKeySet: boolean;
  apiSecretSet: boolean;
  siteId: string;
  environment: 'sandbox' | 'production';
  webhookUrl: string;
  simulationMode: boolean;
}

export async function getPaymentConfig(): Promise<MaskedPaymentConfig> {
  const { data } = await api.get<{ config: MaskedPaymentConfig }>('/payments/config');
  return data.config;
}

export async function savePaymentConfig(input: PaymentConfigInput): Promise<MaskedPaymentConfig> {
  const { data } = await api.put<{ config: MaskedPaymentConfig }>('/payments/config', input);
  return data.config;
}

export interface CollectInfo {
  network: string;
  number: string;
  name: string;
  qr: string;
}

export async function getCollectInfo(): Promise<CollectInfo> {
  const { data } = await api.get<{ collect: CollectInfo }>('/payments/collect-info');
  return data.collect;
}

export async function saveCollectInfo(input: CollectInfo): Promise<CollectInfo> {
  const { data } = await api.put<{ collect: CollectInfo }>('/payments/collect-info', input);
  return data.collect;
}

export interface AuditLogDto {
  id: string;
  action: string;
  entity: string | null;
  entityId: string | null;
  ipAddress: string | null;
  createdAt: string;
  user: { firstName: string; lastName: string; email: string } | null;
}

export interface Branding {
  name: string;
  logoUrl: string | null;
  location: string | null;
  invoiceSettings: InvoiceSettings | null;
}

export async function getBranding(): Promise<Branding> {
  const { data } = await api.get<{ branding: Branding }>('/settings/branding');
  return data.branding;
}

export async function updateBranding(input: BrandingUpdateInput): Promise<Branding> {
  const { data } = await api.patch<{ branding: Branding }>('/settings/branding', input);
  // Met à jour le logo/nom dans le contexte courant (barre latérale, etc.).
  const user = useAuthStore.getState().user;
  if (user) {
    useAuthStore.getState().setUser({
      ...user,
      tenantName: data.branding.name,
      tenantLogoUrl: data.branding.logoUrl,
      tenantInvoiceSettings: data.branding.invoiceSettings,
    });
  }
  return data.branding;
}

export async function getAuditLogs(page = 1) {
  const { data } = await api.get<{ items: AuditLogDto[]; total: number; page: number; pageSize: number }>(
    '/audit/logs',
    { params: { page } },
  );
  return data;
}
