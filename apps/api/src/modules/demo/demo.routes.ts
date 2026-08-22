import type { FastifyInstance } from 'fastify';
import { signupDemoSchema, demoProgressUpdateSchema, demoEventSchema } from '@oculo/shared-types';
import * as authService from '../auth/auth.service.js';
import { setRefreshCookie } from '../auth/cookies.js';
import { requireAuth } from '../../middlewares/auth-guard.js';
import { requestMeta, recordAudit } from '../../lib/audit.js';
import { sendConversionEvent } from '../../lib/meta-capi.js';
import { appOrigin } from '../../config/env.js';
import * as demoService from './demo.service.js';
import * as demoVideo from './demo-video.service.js';
import { badRequest } from '../../lib/http-error.js';

export async function demoRoutes(app: FastifyInstance): Promise<void> {
  // Limiteur renforcé, alignée sur /auth/signup (anti brute-force / anti-spam de tenants démo).
  const strictLimit = { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } };

  // "Découvrir OculoSaaS" : crée un établissement démo pré-rempli et connecte
  // immédiatement le prospect, comme une inscription classique.
  app.post('/signup', strictLimit, async (req, reply) => {
    const input = signupDemoSchema.parse(req.body);
    const { accessToken, refreshToken, user } = await authService.signupDemoTenant(
      input,
      requestMeta(req),
    );
    setRefreshCookie(reply, refreshToken);

    const cookies = req.cookies as Record<string, string | undefined>;
    void sendConversionEvent({
      eventName: 'CompleteRegistration',
      eventId: `registration_demo_${user.id}`,
      eventSourceUrl: `${appOrigin}/signup`,
      user: {
        email: user.email,
        externalId: user.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        fbp: cookies._fbp,
        fbc: cookies._fbc,
      },
      customData: { content_name: 'demo' },
    });

    return reply.status(201).send({ accessToken, user });
  });

  // Routes suivantes : exigent une session (progression/tracking du tenant courant).
  // `seedManifest` est un détail d'implémentation interne (identifiants des
  // données d'exemple à purger) — jamais utile côté client, jamais renvoyé.
  app.get('/progress', { preHandler: requireAuth }, async (req, reply) => {
    const { seedManifest: _seedManifest, ...progress } = (await demoService.getDemoProgress(req.auth!.tenantId)) ?? {};
    return reply.send({ progress: Object.keys(progress).length ? progress : null });
  });

  app.put('/progress', { preHandler: requireAuth }, async (req, reply) => {
    const input = demoProgressUpdateSchema.parse(req.body);
    const { seedManifest: _seedManifest, ...progress } = await demoService.saveDemoProgress(req.auth!.tenantId, {
      currentStepId: input.currentStepId,
      completedAt: input.completedAt === undefined ? undefined : input.completedAt ? new Date(input.completedAt) : null,
      skipped: input.skipped,
    });
    // Visite terminée ou passée : efface les données d'exemple pré-remplies à
    // l'inscription (no-op idempotent si le compte n'en a jamais eu, ou déjà purgé).
    if (input.completedAt || input.skipped) {
      await demoService.purgeSampleData(req.auth!.tenantId);
    }
    return reply.send({ progress });
  });

  // Suivi du tunnel démo (recordAudit → visible dans la console fondateur, AuditPage).
  app.post('/events', { preHandler: requireAuth }, async (req, reply) => {
    const input = demoEventSchema.parse(req.body);
    await recordAudit({
      tenantId: req.auth!.tenantId,
      userId: req.auth!.userId,
      action: `DEMO_${input.event.toUpperCase()}`,
      entity: 'Tenant',
      entityId: req.auth!.tenantId,
      metadata: input.metadata,
      ...requestMeta(req),
    });
    return reply.status(201).send({ ok: true });
  });

  /* ---------------- Vidéos de démonstration commerciale ---------------- */
  // Aucune permission dédiée : tout utilisateur connecté peut voir la démo.

  app.get('/videos/progress', { preHandler: requireAuth }, async (req, reply) => {
    const progress = await demoVideo.getMyProgress(req.auth!.tenantId, req.auth!.userId);
    return reply.send({ progress });
  });

  app.put('/videos/:key/progress', { preHandler: requireAuth }, async (req, reply) => {
    const { key } = req.params as { key: string };
    if (!demoVideo.isValidVideoKey(key)) throw badRequest('Vidéo inconnue');
    const body = req.body as { positionSeconds?: number; durationSeconds?: number; isNewView?: boolean };
    if (typeof body.positionSeconds !== 'number' || !Number.isFinite(body.positionSeconds)) {
      throw badRequest('positionSeconds requis');
    }
    const row = await demoVideo.saveProgress(req.auth!.tenantId, req.auth!.userId, key, {
      positionSeconds: body.positionSeconds,
      durationSeconds: body.durationSeconds,
      isNewView: body.isNewView,
    });
    return reply.send({ maxPercent: row.maxPercent, completedAt: row.completedAt });
  });

  app.post('/videos/:key/feedback', { preHandler: requireAuth }, async (req, reply) => {
    const { key } = req.params as { key: string };
    if (!demoVideo.isValidVideoKey(key)) throw badRequest('Vidéo inconnue');
    const { understood } = req.body as { understood?: string };
    if (!understood || !['YES', 'UNSURE', 'NO'].includes(understood)) {
      throw badRequest('Réponse invalide');
    }
    await demoVideo.saveFeedback(req.auth!.tenantId, req.auth!.userId, key, understood);
    return reply.status(201).send({ ok: true });
  });
}
