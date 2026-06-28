import type { FastifyInstance } from 'fastify';
import {
  signupSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyPasswordSchema,
  profileUpdateSchema,
} from '@oculo/shared-types';
import * as authService from './auth.service.js';
import { REFRESH_COOKIE, setRefreshCookie, clearRefreshCookie } from './cookies.js';
import { requireAuth } from '../../middlewares/auth-guard.js';
import { requestMeta } from '../../lib/audit.js';
import { unauthorized } from '../../lib/http-error.js';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // Limiteur renforcé sur les routes sensibles (anti brute-force).
  const strictLimit = { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } };

  app.post('/signup', strictLimit, async (req, reply) => {
    const input = signupSchema.parse(req.body);
    const { accessToken, refreshToken, user } = await authService.signupTenant(
      input,
      requestMeta(req),
    );
    setRefreshCookie(reply, refreshToken);
    return reply.status(201).send({ accessToken, user });
  });

  app.post('/login', strictLimit, async (req, reply) => {
    const input = loginSchema.parse(req.body);
    const { accessToken, refreshToken, user } = await authService.login(input, requestMeta(req));
    setRefreshCookie(reply, refreshToken);
    return reply.send({ accessToken, user });
  });

  app.post('/refresh', async (req, reply) => {
    const token = req.cookies[REFRESH_COOKIE];
    if (!token) throw unauthorized('Aucune session');
    const { accessToken, refreshToken, user } = await authService.refresh(token, requestMeta(req));
    setRefreshCookie(reply, refreshToken);
    return reply.send({ accessToken, user });
  });

  app.post('/logout', async (req, reply) => {
    await authService.logout(req.cookies[REFRESH_COOKIE]);
    clearRefreshCookie(reply);
    return reply.send({ ok: true });
  });

  app.post('/forgot-password', strictLimit, async (req, reply) => {
    const { email } = forgotPasswordSchema.parse(req.body);
    await authService.forgotPassword(email, requestMeta(req));
    // Toujours 200 (anti-énumération).
    return reply.send({ ok: true });
  });

  app.post('/reset-password', strictLimit, async (req, reply) => {
    const { token, newPassword } = resetPasswordSchema.parse(req.body);
    await authService.resetPassword(token, newPassword, requestMeta(req));
    return reply.send({ ok: true });
  });

  app.get('/me', { preHandler: requireAuth }, async (req, reply) => {
    const user = await authService.getCurrentAuthUser(req.auth!.userId);
    if (!user) throw unauthorized();
    return reply.send({ user });
  });

  app.patch('/me', { preHandler: requireAuth }, async (req, reply) => {
    const input = profileUpdateSchema.parse(req.body);
    const user = await authService.updateOwnProfile(req.auth!.userId, input);
    if (!user) throw unauthorized();
    return reply.send({ user });
  });

  app.post('/verify-password', { preHandler: requireAuth }, async (req, reply) => {
    const { password } = verifyPasswordSchema.parse(req.body);
    const ok = await authService.verifyUserPassword(req.auth!.userId, password);
    return reply.send({ ok });
  });
}
