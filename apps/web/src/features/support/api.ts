import { api } from '../../lib/api';
import type { SupportTicketInput } from '@oculo/shared-types';

export async function createSupportTicket(input: SupportTicketInput): Promise<void> {
  await api.post('/support', input);
}

export interface MySupportTicket {
  id: string;
  subject: string;
  message: string;
  status: string;
  createdAt: string;
}

/** Demandes envoyées par l'utilisateur connecté. */
export async function listMySupportTickets(): Promise<MySupportTicket[]> {
  const { data } = await api.get<{ tickets: MySupportTicket[] }>('/support/mine');
  return data.tickets;
}

/* --- Console fondateur --- */
export interface SupportTicket {
  id: string;
  tenantId: string | null;
  userId: string | null;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: string;
  createdAt: string;
}

export async function listSupportTickets(): Promise<SupportTicket[]> {
  const { data } = await api.get<{ tickets: SupportTicket[] }>('/platform/support');
  return data.tickets;
}

export async function setSupportTicketStatus(id: string, status: 'OPEN' | 'CLOSED'): Promise<void> {
  await api.patch(`/platform/support/${id}`, { status });
}
