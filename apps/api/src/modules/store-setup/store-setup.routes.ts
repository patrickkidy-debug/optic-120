import type { FastifyInstance } from 'fastify';
import { STORE_SETUP_STEPS, storeSetupStepOverrideSchema, type StoreSetupStepKey } from '@oculo/shared-types';
import { requireAuth } from '../../middlewares/auth-guard.js';
import { badRequest, forbidden } from '../../lib/http-error.js';
import { isOperatorEmail } from '../../lib/operators.js';
import * as storeSetupService from './store-setup.service.js';

function isValidStepKey(key: string): key is StoreSetupStepKey {
  return (STORE_SETUP_STEPS as readonly string[]).includes(key);
}

/** Assistant "Configuration de la boutique" : progression calculée depuis les
 * vraies données (voir store-setup.service.ts), lecture ouverte à toute
 * personne connectée, écriture (marquer fait/ignoré) gardée par la même
 * permission que l'action réelle correspondante. */
export async function storeSetupRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  app.get('/progress', async (req, reply) => {
    const progress = await storeSetupService.getProgress(req.auth!.tenantId);
    return reply.send({ progress });
  });

  app.patch('/steps/:key', async (req, reply) => {
    const { key } = req.params as { key: string };
    if (!isValidStepKey(key)) throw badRequest('Étape inconnue');
    const { status } = storeSetupStepOverrideSchema.parse(req.body);

    const required = storeSetupService.STORE_SETUP_STEP_PERMISSIONS[key];
    if (!isOperatorEmail(req.auth!.email) && !req.auth!.permissions.has(required)) {
      throw forbidden(`Permission requise : ${required}`);
    }

    const progress = await storeSetupService.setStepOverride(req.auth!.tenantId, key, status);
    return reply.send({ progress });
  });

  app.post('/finish', async (req, reply) => {
    const progress = await storeSetupService.finishSetup(req.auth!.tenantId);
    return reply.send({ progress });
  });
}
