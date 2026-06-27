import { api } from '../../lib/api';
import type { PaymentConfigInput } from '@oculo/shared-types';

export interface MaskedPaymentConfig {
  apiKeySet: boolean;
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

export interface AuditLogDto {
  id: string;
  action: string;
  entity: string | null;
  entityId: string | null;
  ipAddress: string | null;
  createdAt: string;
  user: { firstName: string; lastName: string; email: string } | null;
}

export async function getAuditLogs(page = 1) {
  const { data } = await api.get<{ items: AuditLogDto[]; total: number; page: number; pageSize: number }>(
    '/audit/logs',
    { params: { page } },
  );
  return data;
}
