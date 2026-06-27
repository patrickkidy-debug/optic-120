import type { FastifyInstance } from 'fastify';
import { stockAdjustSchema } from '@oculo/shared-types';
import { z } from 'zod';
import { requireAuth } from '../../middlewares/auth-guard.js';
import { requirePermission } from '../../middlewares/rbac-guard.js';
import { assertBranchAccess } from '../../middlewares/rbac-guard.js';
import { badRequest } from '../../lib/http-error.js';
import * as stockService from './stock.service.js';

const adjustBody = stockAdjustSchema.extend({
  productId: z.string().uuid(),
  branchId: z.string().uuid(),
});

export async function stockRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  app.get('/', { preHandler: requirePermission('optique.stock.view') }, async (req, reply) => {
    const q = req.query as { branchId?: string; lowStockOnly?: string };
    if (!q.branchId) throw badRequest('branchId requis');
    assertBranchAccess(req, q.branchId);
    const rows = await stockService.getStockForBranch(
      req.auth!.tenantId,
      q.branchId,
      q.lowStockOnly === 'true',
    );
    return reply.send({ rows });
  });

  app.get('/alerts/count', { preHandler: requirePermission('optique.stock.view') }, async (req, reply) => {
    const q = req.query as { branchId?: string };
    if (q.branchId) assertBranchAccess(req, q.branchId);
    const count = await stockService.getLowStockCount(req.auth!.tenantId, q.branchId);
    return reply.send({ count });
  });

  app.get('/movements', { preHandler: requirePermission('optique.stock.view') }, async (req, reply) => {
    const q = req.query as { productId?: string; branchId?: string };
    if (!q.productId || !q.branchId) throw badRequest('productId et branchId requis');
    assertBranchAccess(req, q.branchId);
    const movements = await stockService.getMovements(req.auth!.tenantId, q.productId, q.branchId);
    return reply.send({ movements });
  });

  app.post('/adjust', { preHandler: requirePermission('optique.stock.adjust') }, async (req, reply) => {
    const input = adjustBody.parse(req.body);
    assertBranchAccess(req, input.branchId);
    const item = await stockService.adjustStock(req.auth!.tenantId, input, req.auth!.userId);
    return reply.send({ item });
  });
}
