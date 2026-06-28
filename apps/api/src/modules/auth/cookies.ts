import type { FastifyReply } from 'fastify';
import { env } from '../../config/env.js';

export const REFRESH_COOKIE = 'oculo_rt';

const maxAgeSeconds = () => env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60;

// En cross-domaine, COOKIE_DOMAIN est laissé vide : on omet alors l'attribut
// `domain` pour que la cookie reste « host-only » (rattachée au domaine de l'API).
const cookieDomain = env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {};

export function setRefreshCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAMESITE,
    ...cookieDomain,
    path: '/auth',
    maxAge: maxAgeSeconds(),
  });
}

export function clearRefreshCookie(reply: FastifyReply): void {
  reply.clearCookie(REFRESH_COOKIE, { path: '/auth', ...cookieDomain });
}
