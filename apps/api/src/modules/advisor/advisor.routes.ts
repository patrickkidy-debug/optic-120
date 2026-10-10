import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../../middlewares/auth-guard.js';
import { badRequest, forbidden, notFound } from '../../lib/http-error.js';
import { getOperatorEmails } from '../../lib/operators.js';
import { prisma } from '../../lib/prisma.js';
import * as advisor from './advisor.service.js';

/**
 * Conseiller commercial IA — routes PUBLIQUES (avant tout compte).
 *
 * La seule clé est l'identifiant de conversation, tiré au hasard. Il ne donne
 * accès qu'à sa propre conversation, jamais aux données d'un établissement.
 * Débit limité par IP ; tours et durée bornés côté serveur.
 */
const startSchema = z.object({
  page: z.string().max(40).default('landing'),
  mode: z.enum(['VOICE', 'TEXT']).default('VOICE'),
  lang: z.enum(advisor.LANGS).default('fr'),
  activationToken: z.string().max(200).optional(),
});
const chatSchema = z.object({
  turns: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(advisor.LIMITS.maxMessageChars * 2) }))
    .min(1)
    .max(80),
});

async function own(req: FastifyRequest) {
  const { id } = req.params as { id: string };
  const conv = await prisma.advisorConversation.findUnique({ where: { id }, select: { id: true, ipHash: true } });
  if (!conv) throw notFound('Conversation introuvable');
  return conv;
}

export async function advisorPublicRoutes(app: FastifyInstance): Promise<void> {
  app.get('/status', async (_req, reply) => reply.send({ enabled: advisor.isEnabled() }));

  app.post('/conversations', { config: { rateLimit: { max: 10, timeWindow: '10 minutes' } } }, async (req, reply) => {
    if (!advisor.isEnabled()) return reply.status(503).send({ error: 'Conseiller indisponible' });
    const input = startSchema.parse(req.body ?? {});
    const r = await advisor.startConversation({ ...input, ip: req.ip });
    if ('error' in r) return reply.status(429).send({ error: 'Limite de conversations atteinte pour aujourd’hui' });
    return reply.status(201).send({ id: r.conversation.id, limits: { maxTurns: advisor.LIMITS.maxTurns, maxMinutes: advisor.LIMITS.maxMinutes } });
  });

  /**
   * Réponse en flux (Server-Sent Events) : texte au fil de l'eau, actions
   * d'interface (forfaits, démo, bouton d'inscription), puis fin.
   */
  app.post('/conversations/:id/reply', { config: { rateLimit: { max: 40, timeWindow: '5 minutes' } } }, async (req, reply) => {
    const conv = await own(req);
    const { turns } = chatSchema.parse(req.body);
    const abort = new AbortController();
    req.raw.on('close', () => abort.abort());

    reply.hijack();
    reply.raw.writeHead(200, {
      ...(reply.getHeaders() as Record<string, string>),
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    });
    const send = (obj: object) => {
      if (!reply.raw.writableEnded) reply.raw.write(`data: ${JSON.stringify(obj)}\n\n`);
    };
    try {
      const r = await advisor.reply({
        conversationId: conv.id,
        turns,
        signal: abort.signal,
        onText: (d) => send({ t: 'text', d }),
        onUi: (e) => send({ t: 'ui', e }),
      });
      if (r.limited) send({ t: 'limit', reason: r.limited });
      send({ t: 'done' });
    } catch (err) {
      if (!abort.signal.aborted) {
        req.log.error({ err }, 'Conseiller IA : réponse en échec');
        send({ t: 'error' });
      }
    } finally {
      reply.raw.end();
    }
  });

  app.post('/conversations/:id/events', { config: { rateLimit: { max: 60, timeWindow: '5 minutes' } } }, async (req, reply) => {
    const conv = await own(req);
    const { name } = (req.body ?? {}) as { name?: string };
    if (!name || !(advisor.CLIENT_EVENTS as readonly string[]).includes(name)) throw badRequest('Événement inconnu');
    await advisor.clientEvent(conv.id, name as (typeof advisor.CLIENT_EVENTS)[number]);
    return reply.send({ ok: true });
  });

  app.post('/conversations/:id/link', async (req, reply) => {
    const conv = await own(req);
    const { token } = (req.body ?? {}) as { token?: string };
    if (!token) throw badRequest('Parcours manquant');
    return reply.send({ linked: await advisor.linkActivation(conv.id, token) });
  });

  /** Suppression par le visiteur : conversation, résumé et événements. */
  app.delete('/conversations/:id', async (req, reply) => {
    const conv = await own(req);
    await advisor.deleteConversation(conv.id);
    return reply.send({ deleted: true });
  });
}

/** Tableau de bord du conseiller — fondateur uniquement (garde serveur). */
export async function advisorPlatformRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);
  app.addHook('preHandler', async (req) => {
    const email = req.auth?.email?.toLowerCase();
    if (!email || !getOperatorEmails().has(email)) throw forbidden('Réservé aux opérateurs de la plateforme');
  });
  app.get('/stats', async (req, reply) => {
    const days = Math.min(365, Math.max(1, Number((req.query as { days?: string }).days ?? 30) || 30));
    return reply.send(await advisor.stats(days));
  });
}
