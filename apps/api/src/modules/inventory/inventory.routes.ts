import type { FastifyInstance } from 'fastify';
import {
  createInventoryCountSchema,
  updateInventoryCountLineSchema,
  scanInventoryCountSchema,
  regularizeInventoryCountSchema,
} from '@oculo/shared-types';
import { requireAuth } from '../../middlewares/auth-guard.js';
import { requirePermission, requireAnyPermission, assertBranchAccess } from '../../middlewares/rbac-guard.js';
import { badRequest, notFound } from '../../lib/http-error.js';
import { recordAudit, requestMeta } from '../../lib/audit.js';
import { prisma } from '../../lib/prisma.js';
import * as inventoryService from './inventory.service.js';

/** Vérifie que le tenant/succursale de la session correspondent avant toute action dessus. */
async function loadBranchId(tenantId: string, id: string): Promise<string> {
  const count = await prisma.inventoryCount.findFirst({ where: { id, tenantId }, select: { branchId: true } });
  if (!count) throw notFound('Inventaire introuvable');
  return count.branchId;
}

export async function inventoryRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  app.post('/', { preHandler: requirePermission('optique.inventory.create') }, async (req, reply) => {
    const input = createInventoryCountSchema.parse(req.body);
    assertBranchAccess(req, input.branchId);
    const count = await inventoryService.createInventoryCount(req.auth!.tenantId, req.auth!.userId, {
      ...input,
      note: input.note || undefined,
    });
    await recordAudit({
      tenantId: req.auth!.tenantId,
      userId: req.auth!.userId,
      action: 'INVENTORY_STARTED',
      entity: 'InventoryCount',
      entityId: count.id,
      metadata: { branchId: input.branchId },
      ...requestMeta(req),
    });
    return reply.status(201).send({ count });
  });

  app.get(
    '/',
    { preHandler: requireAnyPermission('optique.inventory.view', 'optique.inventory.history') },
    async (req, reply) => {
      const q = req.query as { branchId?: string; page?: string; pageSize?: string };
      if (q.branchId) assertBranchAccess(req, q.branchId);
      const result = await inventoryService.listInventoryCounts(req.auth!.tenantId, {
        branchId: q.branchId,
        page: q.page ? Number(q.page) : undefined,
        pageSize: q.pageSize ? Number(q.pageSize) : undefined,
      });
      return reply.send(result);
    },
  );

  // Session en cours pour la succursale (permet au frontend de proposer reprise vs démarrage) :
  // accessible dès qu'on peut au moins compter ou en créer une, pas seulement "view" pur.
  app.get(
    '/active',
    { preHandler: requireAnyPermission('optique.inventory.count', 'optique.inventory.create', 'optique.inventory.view') },
    async (req, reply) => {
      const q = req.query as { branchId?: string };
      if (!q.branchId) throw badRequest('branchId requis');
      assertBranchAccess(req, q.branchId);
      const count = await inventoryService.getActiveInventoryCount(req.auth!.tenantId, q.branchId);
      return reply.send({ count });
    },
  );

  app.get('/:id', { preHandler: requirePermission('optique.inventory.view') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const q = req.query as { status?: string; search?: string; page?: string; pageSize?: string };
    const branchId = await loadBranchId(req.auth!.tenantId, id);
    assertBranchAccess(req, branchId);
    const result = await inventoryService.getInventoryCount(req.auth!.tenantId, id, {
      status: q.status as inventoryService.InventoryLineFilter['status'],
      search: q.search,
      page: q.page ? Number(q.page) : undefined,
      pageSize: q.pageSize ? Number(q.pageSize) : undefined,
    });
    return reply.send(result);
  });

  app.patch(
    '/:id/lines/:lineId',
    { preHandler: requirePermission('optique.inventory.count') },
    async (req, reply) => {
      const { id, lineId } = req.params as { id: string; lineId: string };
      const input = updateInventoryCountLineSchema.parse(req.body);
      const branchId = await loadBranchId(req.auth!.tenantId, id);
      assertBranchAccess(req, branchId);
      const line = await inventoryService.updateCountedQty(
        req.auth!.tenantId,
        req.auth!.userId,
        lineId,
        input.countedQty,
      );
      return reply.send({ line });
    },
  );

  app.post('/:id/scan', { preHandler: requirePermission('optique.inventory.count') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const input = scanInventoryCountSchema.parse(req.body);
    const branchId = await loadBranchId(req.auth!.tenantId, id);
    assertBranchAccess(req, branchId);
    const line = await inventoryService.scanProduct(req.auth!.tenantId, req.auth!.userId, id, input.code);
    return reply.send({ line });
  });

  app.post(
    '/:id/validate',
    { preHandler: requirePermission('optique.inventory.validate') },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const branchId = await loadBranchId(req.auth!.tenantId, id);
      assertBranchAccess(req, branchId);
      const count = await inventoryService.validateInventoryCount(req.auth!.tenantId, id);
      await recordAudit({
        tenantId: req.auth!.tenantId,
        userId: req.auth!.userId,
        action: 'INVENTORY_VALIDATED',
        entity: 'InventoryCount',
        entityId: id,
        ...requestMeta(req),
      });
      return reply.send({ count });
    },
  );

  app.post(
    '/:id/regularize',
    { preHandler: requirePermission('optique.inventory.regularize') },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const input = regularizeInventoryCountSchema.parse(req.body);
      const branchId = await loadBranchId(req.auth!.tenantId, id);
      assertBranchAccess(req, branchId);
      const result = await inventoryService.regularizeInventoryCount(
        req.auth!.tenantId,
        req.auth!.userId,
        id,
        input.lines.map((l) => ({ ...l, note: l.note || undefined })),
      );
      await recordAudit({
        tenantId: req.auth!.tenantId,
        userId: req.auth!.userId,
        action: 'INVENTORY_REGULARIZED',
        entity: 'InventoryCount',
        entityId: id,
        metadata: { regularized: result.regularized, net: result.net, lines: input.lines },
        ...requestMeta(req),
      });
      return reply.send(result);
    },
  );

  app.post(
    '/:id/cancel',
    { preHandler: requirePermission('optique.inventory.validate') },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const branchId = await loadBranchId(req.auth!.tenantId, id);
      assertBranchAccess(req, branchId);
      const count = await inventoryService.cancelInventoryCount(req.auth!.tenantId, id);
      await recordAudit({
        tenantId: req.auth!.tenantId,
        userId: req.auth!.userId,
        action: 'INVENTORY_CANCELLED',
        entity: 'InventoryCount',
        entityId: id,
        ...requestMeta(req),
      });
      return reply.send({ count });
    },
  );
}
