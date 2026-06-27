import type { FastifyInstance } from 'fastify';
import { saleCreateSchema, paymentCreateSchema, SaleType } from '@oculo/shared-types';
import { requireAuth } from '../../middlewares/auth-guard.js';
import { requirePermission, assertBranchAccess } from '../../middlewares/rbac-guard.js';
import { forbidden, notFound } from '../../lib/http-error.js';
import { recordAudit, requestMeta } from '../../lib/audit.js';
import * as salesService from './sales.service.js';

export async function salesRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  app.get('/', { preHandler: requirePermission('optique.sales.view') }, async (req, reply) => {
    const q = req.query as {
      branchId?: string;
      status?: string;
      type?: string;
      page?: string;
      pageSize?: string;
    };
    const page = Math.max(1, parseInt(q.page ?? '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(q.pageSize ?? '25', 10)));
    const where: Record<string, unknown> = {};
    if (q.branchId) where.branchId = q.branchId;
    if (q.status) where.status = q.status;
    if (q.type) where.type = q.type;

    const [items, total] = await Promise.all([
      req.db!.sale.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { customer: true, branch: true, _count: { select: { items: true } } },
      }),
      req.db!.sale.count({ where }),
    ]);
    return reply.send({ items, total, page, pageSize });
  });

  app.get('/:id', { preHandler: requirePermission('optique.sales.view') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const sale = await req.db!.sale.findFirst({
      where: { id },
      include: {
        items: { include: { product: true } },
        customer: true,
        branch: true,
        payments: true,
        cashier: { select: { firstName: true, lastName: true } },
      },
    });
    if (!sale) throw notFound('Vente introuvable');
    return reply.send({ sale });
  });

  app.post('/', async (req, reply) => {
    const input = saleCreateSchema.parse(req.body);
    const needed =
      input.type === SaleType.QUOTE ? 'optique.quotes.create' : 'optique.sales.create';
    if (!req.auth!.permissions.has(needed)) throw forbidden(`Permission requise : ${needed}`);
    assertBranchAccess(req, input.branchId);

    const sale = await salesService.createSale(req.auth!.tenantId, req.auth!.userId, input);
    await recordAudit({
      tenantId: req.auth!.tenantId,
      userId: req.auth!.userId,
      action: input.type === SaleType.QUOTE ? 'QUOTE_CREATED' : 'SALE_CREATED',
      entity: 'Sale',
      entityId: sale.id,
      metadata: { number: sale.number, total: Number(sale.totalAmount) },
      ...requestMeta(req),
    });
    return reply.status(201).send({ sale });
  });

  app.patch('/:id/cancel', { preHandler: requirePermission('optique.sales.cancel') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const sale = await salesService.cancelSale(req.auth!.tenantId, id, req.auth!.userId);
    await recordAudit({
      tenantId: req.auth!.tenantId,
      userId: req.auth!.userId,
      action: 'SALE_CANCELLED',
      entity: 'Sale',
      entityId: id,
      ...requestMeta(req),
    });
    return reply.send({ sale });
  });

  app.post('/:id/convert-quote', { preHandler: requirePermission('optique.quotes.convert') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const sale = await salesService.convertQuote(req.auth!.tenantId, id, req.auth!.userId);
    return reply.send({ sale });
  });

  app.post('/:id/payments', { preHandler: requirePermission('optique.sales.create') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const input = paymentCreateSchema.parse(req.body);
    const result = await salesService.addPayment(req.auth!.tenantId, req.auth!.userId, id, input);
    return reply.status(201).send(result);
  });
}
