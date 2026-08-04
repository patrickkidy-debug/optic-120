import type { FastifyInstance } from 'fastify';
import {
  stockAdjustSchema,
  stockReceiveSchema,
  stockTransferSchema,
  stockCountSchema,
} from '@oculo/shared-types';
import { z } from 'zod';
import { requireAuth } from '../../middlewares/auth-guard.js';
import { requirePermission } from '../../middlewares/rbac-guard.js';
import { assertBranchAccess } from '../../middlewares/rbac-guard.js';
import { badRequest } from '../../lib/http-error.js';
import { recordAudit, requestMeta } from '../../lib/audit.js';
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

  // Réception d'une commande fournisseur : entrée de stock tracée avec coût.
  app.post('/receive', { preHandler: requirePermission('optique.stock.adjust') }, async (req, reply) => {
    const input = stockReceiveSchema.parse(req.body);
    assertBranchAccess(req, input.branchId);
    const result = await stockService.receiveStock(req.auth!.tenantId, req.auth!.userId, {
      ...input,
      reference: input.reference || undefined,
    });
    await recordAudit({
      tenantId: req.auth!.tenantId,
      userId: req.auth!.userId,
      action: 'STOCK_RECEIVED',
      entity: 'StockMovement',
      metadata: { branchId: input.branchId, ...result },
      ...requestMeta(req),
    });
    return reply.send(result);
  });

  // Transfert de stock entre deux magasins de l'établissement.
  app.post('/transfer', { preHandler: requirePermission('optique.stock.transfer') }, async (req, reply) => {
    const input = stockTransferSchema.parse(req.body);
    assertBranchAccess(req, input.fromBranchId);
    assertBranchAccess(req, input.toBranchId);
    const result = await stockService.transferStock(req.auth!.tenantId, req.auth!.userId, {
      ...input,
      reason: input.reason || undefined,
    });
    await recordAudit({
      tenantId: req.auth!.tenantId,
      userId: req.auth!.userId,
      action: 'STOCK_TRANSFERRED',
      entity: 'StockMovement',
      metadata: { from: input.fromBranchId, to: input.toBranchId, ...result },
      ...requestMeta(req),
    });
    return reply.send(result);
  });

  // Inventaire physique : régularise le stock sur les quantités comptées.
  app.post('/count', { preHandler: requirePermission('optique.stock.adjust') }, async (req, reply) => {
    const input = stockCountSchema.parse(req.body);
    assertBranchAccess(req, input.branchId);
    const result = await stockService.applyStockCount(req.auth!.tenantId, req.auth!.userId, {
      ...input,
      note: input.note || undefined,
    });
    await recordAudit({
      tenantId: req.auth!.tenantId,
      userId: req.auth!.userId,
      action: 'STOCK_COUNTED',
      entity: 'StockMovement',
      metadata: { branchId: input.branchId, ...result },
      ...requestMeta(req),
    });
    return reply.send(result);
  });
}
