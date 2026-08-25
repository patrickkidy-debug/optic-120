import type { FastifyReply } from 'fastify';
import { env } from '../../config/env.js';

/**
 * Cookie de session partenaire — distinct de `oculo_rt` (magasins) : chemin et
 * nom séparés pour qu'un navigateur connecté aux deux espaces (fondateur qui
 * teste OculoPartners depuis son propre magasin, par exemple) ne mélange
 * jamais les deux sessions.
 */
export const PARTNER_REFRESH_COOKIE = 'oculo_partner_rt';

const maxAgeSeconds = () => env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60;
const cookieDomain = env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {};

export function setPartnerRefreshCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(PARTNER_REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAMESITE,
    ...cookieDomain,
    path: '/partners/auth',
    maxAge: maxAgeSeconds(),
  });
}

export function clearPartnerRefreshCookie(reply: FastifyReply): void {
  reply.clearCookie(PARTNER_REFRESH_COOKIE, { path: '/partners/auth', ...cookieDomain });
}
