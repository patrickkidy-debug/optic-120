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

/** Demande publique de suppression du compte (page /suppression-compte). */
export async function createDeletionRequest(input: {
  name: string;
  email: string;
  phone: string;
  establishment: string;
  scope: 'ALL' | 'USER';
  message: string;
}) {
  const user = await prisma.user.findFirst({ where: { email: { equals: input.email, mode: 'insensitive' } }, select: { id: true, tenantId: true } });
  return prisma.supportTicket.create({
    data: {
      tenantId: user?.tenantId ?? null,
      userId: user?.id ?? null,
      name: input.name,
      email: input.email,
      subject: `[Suppression de compte] ${input.establishment}`,
      message: [
        `Portée : ${input.scope === 'ALL' ? "tout l'établissement et ses données" : 'seulement ce compte utilisateur'}`,
        `Établissement : ${input.establishment}`,
        `Téléphone : ${input.phone || '—'}`,
        `Compte trouvé : ${user ? 'oui' : 'non (vérifier l’e-mail)'}`,
        input.message ? `Message : ${input.message}` : '',
        "À traiter sous 30 jours, après vérification de l'identité.",
      ]
        .filter(Boolean)
        .join('\n'),
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
