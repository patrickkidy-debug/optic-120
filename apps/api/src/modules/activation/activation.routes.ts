import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  activationActivitySchema,
  activationInformationSchema,
  activationNeedsSchema,
  activationPlanSchema,
  callbackRequestSchema,
  paymentMethodEnum,
  ACTIVATION_EVENTS,
  type ActivationEventName,
} from '@oculo/shared-types';
import { badRequest } from '../../lib/http-error.js';
import { setRefreshCookie } from '../auth/cookies.js';
import * as service from './activation.service.js';

/**
 * Tunnel d'activation — routes PUBLIQUES.
 *
 * Aucune authentification : le parcours commence avant tout compte. La seule
 * clé d'accès est le jeton de parcours, opaque et tiré au hasard ; il ne
 * donne accès qu'à son propre parcours, jamais à l'application.
 *
 * Rien ici n'ouvre d'accès : l'espace ne s'ouvre qu'une fois l'abonnement
 * passé ACTIVE par le webhook de paiement.
 */
export async function activationRoutes(app: FastifyInstance): Promise<void> {
  const tokenOf = (req: FastifyRequest): string => {
    const { token } = req.params as { token?: string };
    if (!token) throw badRequest('Parcours manquant');
    return token;
  };

  app.post('/', async (req, reply) => {
    const q = req.query as { utm_source?: string; utm_medium?: string; utm_campaign?: string };
    const session = await service.startSession({
      source: q.utm_source,
      medium: q.utm_medium,
      campaign: q.utm_campaign,
    });
    return reply.status(201).send({ session });
  });

  app.get('/:token', async (req, reply) => {
    return reply.send({ session: await service.getSession(tokenOf(req)) });
  });

  app.post('/:token/activity', async (req, reply) => {
    const input = activationActivitySchema.parse(req.body);
    return reply.send({ session: await service.saveActivity(tokenOf(req), input) });
  });

  app.post('/:token/needs', async (req, reply) => {
    const input = activationNeedsSchema.parse(req.body);
    return reply.send({ session: await service.saveNeeds(tokenOf(req), input) });
  });

  app.post('/:token/plan', async (req, reply) => {
    const input = activationPlanSchema.parse(req.body);
    return reply.send({ session: await service.savePlan(tokenOf(req), input) });
  });

  app.post('/:token/information', async (req, reply) => {
    const input = activationInformationSchema.parse(req.body);
    return reply.send({ session: await service.saveInformation(tokenOf(req), input) });
  });

  app.post('/:token/payment', async (req, reply) => {
    const { method } = (req.body ?? {}) as { method?: string };
    const parsed = paymentMethodEnum.safeParse(method);
    if (!parsed.success) throw badRequest('Moyen de paiement invalide');
    return reply.send(await service.startPayment(tokenOf(req), parsed.data));
  });

  /**
   * État du paiement, interrogé au retour du checkout.
   *
   * Quand l'abonnement est actif, une session est ouverte : le client arrive
   * connecté sur son tableau de bord sans ressaisir son mot de passe. Le
   * jeton de rafraîchissement part en cookie, jamais dans le corps, comme
   * pour toute connexion.
   */
  app.get('/:token/status', async (req: FastifyRequest, reply: FastifyReply) => {
    const status = await service.getActivationStatus(tokenOf(req), {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    if (status.refreshToken) setRefreshCookie(reply, status.refreshToken);
    return reply.send({ activated: status.activated, accessToken: status.accessToken });
  });

  /** Suivi marketing : mesure des abandons et des clics WhatsApp. */
  app.post('/:token/event', async (req, reply) => {
    const { name } = (req.body ?? {}) as { name?: string };
    if (!name || !(ACTIVATION_EVENTS as readonly string[]).includes(name)) {
      throw badRequest('Événement inconnu');
    }
    await service.recordEvent(tokenOf(req), name as ActivationEventName);
    return reply.send({ ok: true });
  });

  app.post('/callback', async (req, reply) => {
    const input = callbackRequestSchema.parse(req.body);
    const { token } = (req.body ?? {}) as { token?: string };
    await service.requestCallback({ ...input, token });
    return reply.status(201).send({ ok: true });
  });
}
