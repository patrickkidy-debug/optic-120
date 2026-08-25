import type { FastifyReply, FastifyRequest } from 'fastify';
import { PartnerStatus } from '@oculo/shared-types';
import { verifyPartnerAccessToken } from '../lib/jwt.js';
import { prisma } from '../lib/prisma.js';
import { unauthorized, forbidden } from '../lib/http-error.js';
import type { PartnerAuthContext } from '../types/partner-auth.js';

/**
 * preHandler d'authentification partenaire. Frontière stricte avec `requireAuth`
 * (magasins) : un jeton magasin ne peut jamais passer ici (claim `typ` distincte
 * vérifiée par verifyPartnerAccessToken) et réciproquement.
 */
export async function requirePartnerAuth(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw unauthorized("Jeton d'accès manquant");
  }
  const token = header.slice('Bearer '.length).trim();

  let partnerId: string;
  try {
    partnerId = await verifyPartnerAccessToken(token);
  } catch {
    throw unauthorized("Jeton d'accès invalide ou expiré");
  }

  const partner = await prisma.partner.findUnique({ where: { id: partnerId } });
  if (!partner) throw unauthorized('Session invalide');
  if (partner.status === PartnerStatus.SUSPENDED) throw forbidden('Compte partenaire suspendu');
  if (partner.status === PartnerStatus.REJECTED) throw forbidden('Candidature refusée');

  const ctx: PartnerAuthContext = {
    partnerId: partner.id,
    status: partner.status as PartnerStatus,
    tier: partner.tier as PartnerAuthContext['tier'],
  };
  req.partnerAuth = ctx;
}

/** Réserve une route aux partenaires ACTIFS (ex. actions générant un engagement financier). */
export async function requireActivePartner(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
  if (req.partnerAuth?.status !== PartnerStatus.ACTIVE) {
    throw forbidden('Compte partenaire en attente de validation');
  }
}
