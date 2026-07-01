import type { FastifyInstance } from 'fastify';
import {
  signupSchema,
  loginSchema,
  loginSelectSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  verifyPasswordSchema,
  profileUpdateSchema,
  twoFactorEnableSchema,
  twoFactorDisableSchema,
  twoFactorLoginSchema,
  googleLoginSchema,
  googleSignupSchema,
} from '@oculo/shared-types';
import * as authService from './auth.service.js';
import { REFRESH_COOKIE, setRefreshCookie, clearRefreshCookie } from './cookies.js';
import { requireAuth } from '../../middlewares/auth-guard.js';
import { requestMeta } from '../../lib/audit.js';
import { unauthorized } from '../../lib/http-error.js';
import { sendConversionEvent } from '../../lib/meta-capi.js';
import { appOrigin } from '../../config/env.js';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // Limiteur renforcé sur les routes sensibles (anti brute-force).
  const strictLimit = { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } };
  // Limite modérée sur le rafraîchissement de session (anti abus de jeton).
  const refreshLimit = { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } };

  app.post('/signup', strictLimit, async (req, reply) => {
    const input = signupSchema.parse(req.body);
    const { accessToken, refreshToken, user } = await authService.signupTenant(
      input,
      requestMeta(req),
    );
    setRefreshCookie(reply, refreshToken);

    const cookies = req.cookies as Record<string, string | undefined>;
    void sendConversionEvent({
      eventName: 'CompleteRegistration',
      eventId: `registration_${user.id}`,
      eventSourceUrl: `${appOrigin}/signup`,
      user: {
        email: user.email,
        externalId: user.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        fbp: cookies._fbp,
        fbc: cookies._fbc,
      },
      customData: { content_name: input.plan ?? 'STARTER' },
    });

    return reply.status(201).send({ accessToken, user });
  });

  app.post('/login', strictLimit, async (req, reply) => {
    const input = loginSchema.parse(req.body);
    const result = await authService.login(input, requestMeta(req));
    // Multi-établissement : l'email correspond à plusieurs établissements.
    if ('chooseEstablishment' in result) {
      return reply.send({
        chooseEstablishment: result.chooseEstablishment,
        selectionToken: result.selectionToken,
      });
    }
    if ('twoFactorRequired' in result) {
      return reply.send({ twoFactorRequired: true, challenge: result.challenge });
    }
    setRefreshCookie(reply, result.refreshToken);
    return reply.send({ accessToken: result.accessToken, user: result.user });
  });

  // 2ᵉ étape multi-établissement : choix de l'établissement à activer.
  app.post('/login/select', strictLimit, async (req, reply) => {
    const input = loginSelectSchema.parse(req.body);
    const result = await authService.loginSelectTenant(
      input.selectionToken,
      input.tenantId,
      requestMeta(req),
    );
    if ('twoFactorRequired' in result) {
      return reply.send({ twoFactorRequired: true, challenge: result.challenge });
    }
    setRefreshCookie(reply, result.refreshToken);
    return reply.send({ accessToken: result.accessToken, user: result.user });
  });

  // « Se connecter avec Google ». Si l'email ne correspond à aucun compte,
  // renvoie needsSignup (le frontend bascule alors vers /auth/google/signup).
  app.post('/google/login', strictLimit, async (req, reply) => {
    const { idToken } = googleLoginSchema.parse(req.body);
    const result = await authService.loginWithGoogle(idToken, requestMeta(req));
    if ('needsSignup' in result) {
      return reply.send({ needsSignup: true, email: result.email, firstName: result.firstName, lastName: result.lastName });
    }
    if ('twoFactorRequired' in result) {
      return reply.send({ twoFactorRequired: true, challenge: result.challenge });
    }
    setRefreshCookie(reply, result.refreshToken);
    return reply.send({ accessToken: result.accessToken, user: result.user });
  });

  // Inscription d'un nouvel établissement via Google (identité déjà vérifiée).
  app.post('/google/signup', strictLimit, async (req, reply) => {
    const input = googleSignupSchema.parse(req.body);
    const { accessToken, refreshToken, user } = await authService.signupWithGoogle(
      input,
      requestMeta(req),
    );
    setRefreshCookie(reply, refreshToken);

    const cookies = req.cookies as Record<string, string | undefined>;
    void sendConversionEvent({
      eventName: 'CompleteRegistration',
      eventId: `registration_${user.id}`,
      eventSourceUrl: `${appOrigin}/signup`,
      user: {
        email: user.email,
        externalId: user.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        fbp: cookies._fbp,
        fbc: cookies._fbc,
      },
      customData: { content_name: input.plan ?? 'STARTER' },
    });

    return reply.status(201).send({ accessToken, user });
  });

  // 2ᵉ étape de connexion : code TOTP.
  app.post('/2fa/login', strictLimit, async (req, reply) => {
    const { challenge, code } = twoFactorLoginSchema.parse(req.body);
    const { accessToken, refreshToken, user } = await authService.loginTwoFactor(
      challenge,
      code,
      requestMeta(req),
    );
    setRefreshCookie(reply, refreshToken);
    return reply.send({ accessToken, user });
  });

  app.post('/refresh', refreshLimit, async (req, reply) => {
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

  app.post('/verify-email', strictLimit, async (req, reply) => {
    const { token } = verifyEmailSchema.parse(req.body);
    await authService.verifyEmail(token);
    return reply.send({ ok: true });
  });

  app.post('/resend-verification', { preHandler: requireAuth }, async (req, reply) => {
    await authService.resendVerification(req.auth!.userId);
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

  /* --- 2FA (compte connecté) --- */
  app.get('/2fa', { preHandler: requireAuth }, async (req, reply) => {
    return reply.send(await authService.getTwoFactorStatus(req.auth!.userId));
  });

  app.post('/2fa/setup', { preHandler: requireAuth }, async (req, reply) => {
    return reply.send(await authService.startTwoFactorSetup(req.auth!.userId));
  });

  app.post('/2fa/enable', { preHandler: requireAuth }, async (req, reply) => {
    const { code } = twoFactorEnableSchema.parse(req.body);
    await authService.enableTwoFactor(req.auth!.userId, code, requestMeta(req));
    return reply.send({ ok: true });
  });

  app.post('/2fa/disable', { preHandler: requireAuth }, async (req, reply) => {
    const { password, code } = twoFactorDisableSchema.parse(req.body);
    await authService.disableTwoFactor(req.auth!.userId, password, code, requestMeta(req));
    return reply.send({ ok: true });
  });
}
