import type { FastifyInstance } from 'fastify';
import { syncPushSchema } from '@oculo/shared-types';
import { requireAuth } from '../../middlewares/auth-guard.js';
import { requirePermission } from '../../middlewares/rbac-guard.js';
import * as sync from './sync.service.js';

/**
 * Synchronisation hors-ligne.
 *
 * Aucune permission globale sur /push : chaque opération porte la sienne et
 * elle est vérifiée une par une, exactement comme sur la route d'origine.
 */
export async function syncRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  app.post('/push', async (req, reply) => {
    const { deviceId, operations } = syncPushSchema.parse(req.body);
    const results = await sync.applyBatch(req, deviceId, operations);
    return reply.send({ results, serverTime: new Date().toISOString() });
  });

  /**
   * Opérations refusées, pour le gérant : même droit que le journal
   * d'activité, dont c'est un prolongement.
   */
  app.get('/rejected', { preHandler: requirePermission('audit.logs.view') }, async (req, reply) => {
    return reply.send({ operations: await sync.listRejected(req.auth!.tenantId) });
  });
}
