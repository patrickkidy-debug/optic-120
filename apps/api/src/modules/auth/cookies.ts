import type { FastifyReply } from 'fastify';
import { env } from '../../config/env.js';

export const REFRESH_COOKIE = 'oculo_rt';

const maxAgeSeconds = () => env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60;

export function setRefreshCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'strict',
    domain: env.COOKIE_DOMAIN,
    path: '/auth',
    maxAge: maxAgeSeconds(),
  });
}

export function clearRefreshCookie(reply: FastifyReply): void {
  reply.clearCookie(REFRESH_COOKIE, { path: '/auth', domain: env.COOKIE_DOMAIN });
}
