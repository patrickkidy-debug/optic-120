import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { supportTicketSchema } from '@oculo/shared-types';
import { requireAuth } from '../../middlewares/auth-guard.js';
import * as support from './support.service.js';

const deletionSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(160),
  phone: z.string().trim().max(30).optional().default(''),
  establishment: z.string().trim().min(2).max(160),
  scope: z.enum(['ALL', 'USER']).default('ALL'),
  message: z.string().trim().max(2000).optional().default(''),
});

/**
 * Demande de suppression du compte et des données — PUBLIQUE (exigence Google
 * Play : possible sans l'application). Crée un ticket dans la console
 * fondateur ; rien n'est supprimé automatiquement, l'identité est vérifiée d'abord.
 */
export async function accountDeletionRoutes(app: FastifyInstance): Promise<void> {
  app.post('/', { config: { rateLimit: { max: 5, timeWindow: '1 hour' } } }, async (req, reply) => {
    const input = deletionSchema.parse(req.body);
    const ticket = await support.createDeletionRequest(input);
    return reply.status(201).send({ ok: true, id: ticket.id });
  });
}

/** Routes de support accessibles à tout utilisateur connecté (préfixe /support). */
export async function supportRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  app.post('/', async (req, reply) => {
    const input = supportTicketSchema.parse(req.body);
    const ticket = await support.createTicket(req.auth!.tenantId, req.auth!.userId, input);
    return reply.status(201).send({ ok: true, id: ticket.id });
  });
}
