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
    const transfer = await stockService.transferStock(req.auth!.tenantId, req.auth!.userId, {
      ...input,
      reason: input.reason || undefined,
    });
    await recordAudit({
      tenantId: req.auth!.tenantId,
      userId: req.auth!.userId,
      action: 'STOCK_TRANSFER_INITIATED',
      entity: 'StockTransfer',
      entityId: transfer.id,
      metadata: { from: input.fromBranchId, to: input.toBranchId, number: transfer.number },
      ...requestMeta(req),
    });
    return reply.send({ transfer });
  });

  // Liste des demandes de transfert de stock (entrantes, sortantes ou toutes).
  app.get('/transfers', { preHandler: requirePermission('optique.stock.view') }, async (req, reply) => {
    const q = req.query as { branchId?: string; direction?: 'incoming' | 'outgoing' | 'all'; status?: 'PENDING' | 'CONFIRMED' | 'CANCELLED' };
    if (q.branchId) assertBranchAccess(req, q.branchId);
    const transfers = await stockService.listTransfers(req.auth!.tenantId, q);
    return reply.send({ transfers });
  });

  // Confirmation de réception d'un transfert par le magasin destinataire.
  app.post('/transfers/:id/confirm', { preHandler: requirePermission('optique.stock.transfer') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const transfer = await stockService.confirmTransfer(req.auth!.tenantId, req.auth!.userId, id);
    assertBranchAccess(req, transfer.toBranchId);
    await recordAudit({
      tenantId: req.auth!.tenantId,
      userId: req.auth!.userId,
      action: 'STOCK_TRANSFER_CONFIRMED',
      entity: 'StockTransfer',
      entityId: id,
      metadata: { number: transfer.number },
      ...requestMeta(req),
    });
    return reply.send({ transfer });
  });

  // Annulation d'un transfert en attente par la source.
  app.post('/transfers/:id/cancel', { preHandler: requirePermission('optique.stock.transfer') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const transfer = await stockService.cancelTransfer(req.auth!.tenantId, req.auth!.userId, id);
    assertBranchAccess(req, transfer.fromBranchId);
    await recordAudit({
      tenantId: req.auth!.tenantId,
      userId: req.auth!.userId,
      action: 'STOCK_TRANSFER_CANCELLED',
      entity: 'StockTransfer',
      entityId: id,
      metadata: { number: transfer.number },
      ...requestMeta(req),
    });
    return reply.send({ transfer });
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
