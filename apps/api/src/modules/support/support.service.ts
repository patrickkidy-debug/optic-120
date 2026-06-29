import { prisma } from '../../lib/prisma.js';
import type { SupportTicketInput } from '@oculo/shared-types';

/** Crée un ticket de support en récupérant le contact depuis le compte. */
export async function createTicket(
  tenantId: string,
  userId: string,
  input: SupportTicketInput,
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { firstName: true, lastName: true, email: true },
  });
  return prisma.supportTicket.create({
    data: {
      tenantId,
      userId,
      name: user ? `${user.firstName} ${user.lastName}` : '—',
      email: user?.email ?? '',
      subject: input.subject,
      message: input.message,
    },
  });
}

/** Liste tous les tickets (console fondateur). */
export async function listTickets(limit = 200) {
  return prisma.supportTicket.findMany({ orderBy: { createdAt: 'desc' }, take: limit });
}

export async function setTicketStatus(id: string, status: 'OPEN' | 'CLOSED') {
  return prisma.supportTicket.update({ where: { id }, data: { status } });
}
