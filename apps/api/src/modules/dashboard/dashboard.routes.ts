import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../../middlewares/auth-guard.js';
import { requirePermission, assertBranchAccess } from '../../middlewares/rbac-guard.js';
import { getDashboard } from './dashboard.service.js';

export async function dashboardRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  app.get('/', { preHandler: requirePermission('dashboard.view') }, async (req, reply) => {
    const q = req.query as { branchId?: string };
    if (q.branchId) assertBranchAccess(req, q.branchId);
    // Sans branchId : agrégat tous magasins (réservé aux rôles multi-magasin).
    const branchId = q.branchId ?? (req.auth!.allBranches ? undefined : req.auth!.branchIds[0]);
    const data = await getDashboard(req.auth!.tenantId, branchId);
    return reply.send({ dashboard: data });
  });
}
