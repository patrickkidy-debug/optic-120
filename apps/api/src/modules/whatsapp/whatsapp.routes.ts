import crypto from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { env } from '../../config/env.js';
import * as whatsapp from './whatsapp.service.js';

/** Récupère le corps brut capté par le parser (pour la signature Meta). */
function rawBodyOf(req: FastifyRequest): Buffer | undefined {
  return (req as unknown as { rawBody?: Buffer }).rawBody;
}

/**
 * Vérifie l'entête X-Hub-Signature-256 (HMAC SHA-256 du corps brut avec l'App
 * Secret Meta). Renvoie true si non configuré (App Secret vide → dev/local).
 */
function verifySignature(req: FastifyRequest): boolean {
  if (!env.WHATSAPP_APP_SECRET) return true;
  const raw = rawBodyOf(req);
  const header = req.headers['x-hub-signature-256'];
  if (!raw || typeof header !== 'string') return false;
  const expected =
    'sha256=' + crypto.createHmac('sha256', env.WHATSAPP_APP_SECRET).update(raw).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(header);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Webhook WhatsApp Cloud API (préfixe /webhooks → routes /webhooks/whatsapp).
 * Public (pas d'auth) : Meta l'appelle directement.
 */
export async function whatsappWebhookRoutes(app: FastifyInstance): Promise<void> {
  // Corps brut requis pour vérifier la signature. Ce parser est encapsulé à ce
  // plugin uniquement (n'affecte pas les autres webhooks / routes JSON).
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (req, body, done) => {
      (req as unknown as { rawBody?: Buffer }).rawBody = body as Buffer;
      try {
        const buf = body as Buffer;
        done(null, buf.length ? JSON.parse(buf.toString('utf8')) : {});
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );

  // Diagnostic (protégé par le verify token) : état de config + activité, sans
  // exposer aucun secret. Ex : /webhooks/whatsapp/debug?key=oculosaas-verify-token
  app.get('/whatsapp/debug', async (req, reply) => {
    const q = req.query as Record<string, string | undefined>;
    if (q.key !== env.WHATSAPP_VERIFY_TOKEN) {
      return reply.code(403).send({ error: 'forbidden' });
    }
    return reply.send(await whatsapp.getDebugInfo());
  });

  // Handshake de vérification de l'abonnement (Meta appelle en GET une fois).
  app.get('/whatsapp', async (req, reply) => {
    const q = req.query as Record<string, string | undefined>;
    if (
      q['hub.mode'] === 'subscribe' &&
      q['hub.verify_token'] === env.WHATSAPP_VERIFY_TOKEN
    ) {
      return reply.code(200).type('text/plain').send(q['hub.challenge'] ?? '');
    }
    return reply.code(403).send('Forbidden');
  });

  // Réception des messages entrants. On répond 200 tout de suite (Meta réessaie
  // si la réponse tarde) puis on traite en tâche de fond.
  app.post('/whatsapp', async (req, reply) => {
    whatsapp.recordWebhookHit();
    if (!verifySignature(req)) {
      return reply.code(401).send({ error: 'invalid signature' });
    }
    const body = req.body;
    setImmediate(() => {
      void whatsapp.processWebhook(body).catch((err) => {
        // eslint-disable-next-line no-console
        console.error('[whatsapp] traitement du webhook échoué :', err);
      });
    });
    return reply.code(200).send({ received: true });
  });
}
