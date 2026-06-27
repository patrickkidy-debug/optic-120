import type { FastifyInstance } from 'fastify';
import { productCreateSchema, productUpdateSchema } from '@oculo/shared-types';
import { requireAuth } from '../../middlewares/auth-guard.js';
import { requirePermission } from '../../middlewares/rbac-guard.js';
import { notFound } from '../../lib/http-error.js';

export async function productsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  app.get('/', { preHandler: requirePermission('optique.products.view') }, async (req, reply) => {
    const q = req.query as { search?: string; category?: string; page?: string; pageSize?: string };
    const page = Math.max(1, parseInt(q.page ?? '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(q.pageSize ?? '50', 10)));

    const where: Record<string, unknown> = {};
    if (q.category) where.category = q.category;
    if (q.search) {
      where.OR = [
        { name: { contains: q.search, mode: 'insensitive' } },
        { sku: { contains: q.search, mode: 'insensitive' } },
        { brand: { contains: q.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      req.db!.product.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      req.db!.product.count({ where }),
    ]);

    return reply.send({ items, total, page, pageSize });
  });

  app.get('/:id', { preHandler: requirePermission('optique.products.view') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const product = await req.db!.product.findFirst({
      where: { id },
      include: { stockItems: { include: { branch: true } } },
    });
    if (!product) throw notFound('Produit introuvable');
    return reply.send({ product });
  });

  app.post('/', { preHandler: requirePermission('optique.products.create') }, async (req, reply) => {
    const input = productCreateSchema.parse(req.body);
    const product = await req.db!.product.create({
      data: {
        tenantId: req.auth!.tenantId,
        sku: input.sku,
        category: input.category,
        brand: input.brand,
        name: input.name,
        attributes: input.attributes as object | undefined,
        buyPrice: input.buyPrice,
        sellPrice: input.sellPrice,
      },
    });
    return reply.status(201).send({ product });
  });

  app.patch('/:id', { preHandler: requirePermission('optique.products.update') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const input = productUpdateSchema.parse(req.body);
    const result = await req.db!.product.updateMany({
      where: { id },
      data: { ...input, attributes: input.attributes as object | undefined },
    });
    if (result.count === 0) throw notFound('Produit introuvable');
    const product = await req.db!.product.findFirst({ where: { id } });
    return reply.send({ product });
  });

  // Suppression douce (désactivation) pour préserver l'historique des ventes.
  app.delete('/:id', { preHandler: requirePermission('optique.products.delete') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const result = await req.db!.product.updateMany({ where: { id }, data: { isActive: false } });
    if (result.count === 0) throw notFound('Produit introuvable');
    return reply.send({ ok: true });
  });
}
