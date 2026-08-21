import type { FastifyInstance } from 'fastify';
import { signupDemoSchema, demoProgressUpdateSchema, demoEventSchema } from '@oculo/shared-types';
import * as authService from '../auth/auth.service.js';
import { setRefreshCookie } from '../auth/cookies.js';
import { requireAuth } from '../../middlewares/auth-guard.js';
import { requestMeta, recordAudit } from '../../lib/audit.js';
import { sendConversionEvent } from '../../lib/meta-capi.js';
import { appOrigin } from '../../config/env.js';
import * as demoService from './demo.service.js';

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
  app.get('/progress', { preHandler: requireAuth }, async (req, reply) => {
    const progress = await demoService.getDemoProgress(req.auth!.tenantId);
    return reply.send({ progress });
  });

  app.put('/progress', { preHandler: requireAuth }, async (req, reply) => {
    const input = demoProgressUpdateSchema.parse(req.body);
    const progress = await demoService.saveDemoProgress(req.auth!.tenantId, {
      currentStepId: input.currentStepId,
      completedAt: input.completedAt === undefined ? undefined : input.completedAt ? new Date(input.completedAt) : null,
      skipped: input.skipped,
    });
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
}
