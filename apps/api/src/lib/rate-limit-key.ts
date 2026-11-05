import type { FastifyRequest } from 'fastify';
import { verifyAccessToken } from './jwt.js';

/**
 * Clé de quota : `user:<id>` uniquement si le jeton d'accès est AUTHENTIQUE
 * (signature vérifiée), sinon l'IP. Les routes publiques /auth/* sont toujours
 * comptées par IP (anti force brute), même si un en-tête Authorization est envoyé.
 */
export async function rateLimitKey(req: FastifyRequest): Promise<string> {
  const path = req.url.split('?')[0] ?? '';
  const header = req.headers.authorization;
  if (!path.startsWith('/auth/') && header?.startsWith('Bearer ')) {
    try {
      const claims = await verifyAccessToken(header.slice(7));
      if (claims.sub) return `user:${claims.sub}`;
    } catch {
      /* jeton invalide ou expiré : quota par IP */
    }
  }
  return `ip:${req.ip}`;
}

/**
 * Opérations sensibles d'un compte connecté (vérification / changement de mot
 * de passe, activation 2FA) : quota par compte ET par IP, pour qu'un jeton
 * volé ne serve pas d'oracle de mot de passe, quel que soit le nombre d'IP.
 */
export async function sensitiveKey(req: FastifyRequest): Promise<string> {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      const claims = await verifyAccessToken(header.slice(7));
      return `sensitive:user:${claims.sub}`;
    } catch {
      /* jeton invalide : refusé ensuite par requireAuth */
    }
  }
  return `sensitive:ip:${req.ip}`;
}
