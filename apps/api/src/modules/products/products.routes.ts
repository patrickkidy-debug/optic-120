import type { FastifyInstance } from 'fastify';
import { ProductCategory } from '@prisma/client';
import {
  productCreateSchema,
  productUpdateSchema,
  lensProductSchema,
  computeLensPrice,
  lensSku,
  lensLabel,
  DEFAULT_LENS_PRICING,
  type LensPricing,
} from '@oculo/shared-types';
import { requireAuth } from '../../middlewares/auth-guard.js';
import { requirePermission, requireAnyPermission } from '../../middlewares/rbac-guard.js';
import { notFound, conflict } from '../../lib/http-error.js';

/** Préfixe de référence auto-générée par catégorie (quand aucune n'est saisie). */
const SKU_PREFIX: Record<string, string> = {
  MONTURE: 'MON',
  VERRE: 'VER',
  LENTILLE: 'LEN',
  ACCESSOIRE: 'ACC',
  SERVICE: 'SVC',
};

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
    const tenantId = req.auth!.tenantId;
    const provided = input.sku?.trim();

    // Alerte doublon (si une référence est saisie) : unique « à la lettre près ».
    if (provided) {
      const existing = await req.db!.product.findFirst({
        where: { tenantId, sku: { equals: provided, mode: 'insensitive' } },
        select: { name: true, sku: true },
      });
      if (existing) {
        throw conflict(
          `La référence « ${existing.sku} » est déjà enregistrée pour « ${existing.name} ». Chaque référence doit être unique.`,
        );
      }
    }

    // Création du produit + une ligne de stock (qté 0) par magasin, pour qu'il apparaisse
    // aussitôt dans Stock et soit ajustable partout.
    const product = await req.db!.$transaction(async (tx) => {
      // Référence auto-générée si non saisie (verres, accessoires…).
      let sku = provided ?? '';
      if (!sku) {
        const prefix = SKU_PREFIX[input.category] ?? 'PRD';
        for (let i = 0; i < 6 && !sku; i++) {
          const candidate = `${prefix}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
          const clash = await tx.product.findFirst({ where: { tenantId, sku: candidate }, select: { id: true } });
          if (!clash) sku = candidate;
        }
        if (!sku) sku = `${prefix}-${Date.now().toString(36).toUpperCase()}`;
      }
      const created = await tx.product.create({
        data: {
          tenantId,
          sku,
          category: input.category,
          brand: input.brand,
          name: input.name,
          attributes: input.attributes as object | undefined,
          buyPrice: input.buyPrice,
          sellPrice: input.sellPrice,
        },
      });
      const branches = await tx.branch.findMany({ where: { tenantId, isActive: true }, select: { id: true } });
      if (branches.length > 0) {
        await tx.stockItem.createMany({
          data: branches.map((b) => ({ tenantId, productId: created.id, branchId: b.id, quantity: 0, minAlert: 0 })),
          skipDuplicates: true,
        });
      }
      return created;
    });

    return reply.status(201).send({ product });
  });

  // Verre à la carte (caisse / ventes) : crée ou réutilise un produit VERRE
  // déterministe dont le prix vient du barème de l'établissement (Réglages).
  // Idempotent : même configuration = même produit, prix resynchronisé.
  app.post('/lens', { preHandler: requireAnyPermission('optique.sales.create', 'optique.quotes.create') }, async (req, reply) => {
    const { base, treatments } = lensProductSchema.parse(req.body);
    const tenantId = req.auth!.tenantId;
    const tenant = await req.db!.tenant.findUnique({ where: { id: tenantId }, select: { lensPricing: true } });
    const pricing = (tenant?.lensPricing as LensPricing | null) ?? DEFAULT_LENS_PRICING;
    const price = computeLensPrice(pricing, base, treatments);
    const sku = lensSku(base, treatments);
    const name = lensLabel(base, treatments);
    const attributes = { lensBase: base, treatments };
    const product = await req.db!.product.upsert({
      where: { tenantId_sku: { tenantId, sku } },
      update: { name, sellPrice: price, isActive: true, attributes },
      create: {
        tenantId,
        sku,
        category: ProductCategory.VERRE,
        name,
        sellPrice: price,
        buyPrice: 0,
        attributes,
      },
    });
    return reply.send({ product });
  });

  app.patch('/:id', { preHandler: requirePermission('optique.products.update') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const input = productUpdateSchema.parse(req.body);
    const sku = input.sku?.trim();

    // Si la référence change, elle doit rester unique (hors ce produit lui-même).
    if (sku) {
      const clash = await req.db!.product.findFirst({
        where: { tenantId: req.auth!.tenantId, id: { not: id }, sku: { equals: sku, mode: 'insensitive' } },
        select: { name: true, sku: true },
      });
      if (clash) {
        throw conflict(
          `La référence « ${clash.sku} » est déjà enregistrée pour « ${clash.name} ». Chaque référence doit être unique.`,
        );
      }
    }

    const result = await req.db!.product.updateMany({
      where: { id },
      data: { ...input, ...(sku ? { sku } : {}), attributes: input.attributes as object | undefined },
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
