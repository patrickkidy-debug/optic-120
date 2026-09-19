import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../../middlewares/auth-guard.js';
import * as service from './announcements.service.js';

/**
 * Nouveautés côté UTILISATEUR : lecture seule.
 *
 * Aucune permission RBAC : une annonce produit s'adresse à tout le monde, du
 * caissier au gérant. Exiger une permission reviendrait à cacher les nouveautés
 * à ceux qui utilisent le plus le logiciel. L'écriture vit ailleurs, dans les
 * routes plateforme réservées aux opérateurs.
 */
export async function announcementsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  app.get('/', async (req, reply) => {
    return reply.send({ announcements: await service.listForUser(req.auth!.userId) });
  });

  app.get('/unread-count', async (req, reply) => {
    return reply.send({ count: await service.unreadCount(req.auth!.userId) });
  });

  app.post('/:id/read', async (req, reply) => {
    const { id } = req.params as { id: string };
    await service.markRead(req.auth!.userId, id);
    return reply.send({ ok: true });
  });

  app.post('/read-all', async (req, reply) => {
    const marked = await service.markAllRead(req.auth!.userId);
    return reply.send({ ok: true, marked });
  });
}
