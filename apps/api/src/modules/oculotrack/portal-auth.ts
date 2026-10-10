import type { FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { verifyPortalAccessToken, signPortalAccessToken } from '../../lib/jwt.js';
import { forbidden, unauthorized } from '../../lib/http-error.js';
import { generateRefreshToken, hashRefreshToken } from '../../lib/tokens.js';

/**
 * Authentification du portail OculoTrack (laboratoires, fournisseurs,
 * transporteurs). Totalement séparée des comptes magasin : jeton `typ: portal`,
 * cookie et chemin dédiés. Le contexte liste les SEULS accès actifs du compte
 * (un par magasin) : toute requête du portail est filtrée par ces accès.
 */
export interface PortalScope {
  accessId: string;
  tenantId: string;
  tenantName: string;
  /** Fiche fournisseur représentée (compte fournisseur), null pour un transporteur. */
  supplierId: string | null;
  supplierName: string | null;
}

export interface PortalContext {
  accountId: string;
  name: string;
  email: string;
  kind: 'SUPPLIER' | 'CARRIER';
  scopes: PortalScope[];
}

export const PORTAL_REFRESH_COOKIE = 'oculo_portal_rt';
const cookieDomain = env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {};

export function setPortalCookie(reply: FastifyReply, token: string) {
  reply.setCookie(PORTAL_REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAMESITE,
    ...cookieDomain,
    path: '/portal/auth',
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 86_400,
  });
}

export function clearPortalCookie(reply: FastifyReply) {
  reply.clearCookie(PORTAL_REFRESH_COOKIE, { path: '/portal/auth', ...cookieDomain });
}

export async function issuePortalSession(accountId: string, req: FastifyRequest) {
  const accessToken = await signPortalAccessToken(accountId);
  const refreshToken = generateRefreshToken();
  await prisma.portalSession.create({
    data: {
      accountId,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000),
      ipAddress: req.ip,
      userAgent: (req.headers['user-agent'] ?? '').slice(0, 240),
    },
  });
  await prisma.portalAccount.update({ where: { id: accountId }, data: { lastLoginAt: new Date() } });
  return { accessToken, refreshToken };
}

export async function loadPortalContext(accountId: string): Promise<PortalContext> {
  const acc = await prisma.portalAccount.findUnique({
    where: { id: accountId },
    include: {
      accesses: {
        where: { revokedAt: null, tenant: { status: { not: 'SUSPENDED' } } },
        include: { tenant: { select: { name: true } }, supplier: { select: { name: true } } },
      },
    },
  });
  if (!acc) throw unauthorized('Session invalide');
  if (!acc.isActive) throw forbidden('Compte désactivé');
  return {
    accountId: acc.id,
    name: acc.name,
    email: acc.email,
    kind: acc.kind as PortalContext['kind'],
    scopes: acc.accesses.map((a) => ({
      accessId: a.id,
      tenantId: a.tenantId,
      tenantName: a.tenant.name,
      supplierId: a.supplierId,
      supplierName: a.supplier?.name ?? null,
    })),
  };
}

export async function requirePortalAuth(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw unauthorized("Jeton d'accès manquant");
  let accountId: string;
  try {
    accountId = await verifyPortalAccessToken(header.slice(7).trim());
  } catch {
    throw unauthorized("Jeton d'accès invalide ou expiré");
  }
  req.portal = await loadPortalContext(accountId);
}
