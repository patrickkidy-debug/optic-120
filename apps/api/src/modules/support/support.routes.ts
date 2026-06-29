import type { FastifyInstance } from 'fastify';
import { supportTicketSchema } from '@oculo/shared-types';
import { requireAuth } from '../../middlewares/auth-guard.js';
import * as support from './support.service.js';

/** Routes de support accessibles à tout utilisateur connecté (préfixe /support). */
export async function supportRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  app.post('/', async (req, reply) => {
    const input = supportTicketSchema.parse(req.body);
    const ticket = await support.createTicket(req.auth!.tenantId, req.auth!.userId, input);
    return reply.status(201).send({ ok: true, id: ticket.id });
  });
}
