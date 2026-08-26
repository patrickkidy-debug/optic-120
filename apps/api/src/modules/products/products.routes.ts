import type { FastifyInstance } from 'fastify';
import { recordAudit, requestMeta } from '../../lib/audit.js';
import { ProductCategory } from '@prisma/client';
import {
  productCreateSchema,
  productUpdateSchema,
  productsRecategorizeSchema,
  lensProductSchema,
  computeLensPrice,
  lensSku,
  lensLabel,
  lensBaseOptions,
  DEFAULT_LENS_PRICING,
  type LensPricing,
} from '@oculo/shared-types';
import { requireAuth } from '../../middlewares/auth-guard.js';
import { requirePermission, requireAnyPermission } from '../../middlewares/rbac-guard.js';
import { notFound, conflict, badRequest } from '../../lib/http-error.js';
import { generateSku } from './products-import.service.js';

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

    // `photos` (secondaires) est volontairement exclu : ces data URLs pèsent
    // lourd et ne servent que sur la fiche produit, jamais dans la liste.
    const [items, total] = await Promise.all([
      req.db!.product.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          tenantId: true,
          sku: true,
          category: true,
          brand: true,
          name: true,
          attributes: true,
          photoUrl: true,
          buyPrice: true,
          sellPrice: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
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
      const sku = provided || (await generateSku(tx, input.category));
      const created = await tx.product.create({
        data: {
          tenantId,
          sku,
          category: input.category,
          brand: input.brand,
          name: input.name,
          attributes: input.attributes as object | undefined,
          photoUrl: input.photoUrl || null,
          photos: input.photos as object | undefined,
          buyPrice: input.buyPrice,
          sellPrice: input.sellPrice,
          createdAt: input.createdAt ? new Date(input.createdAt) : undefined,
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
    // Le type de base doit exister dans le barème (fixe ou personnalisé).
    if (!lensBaseOptions(pricing).some((o) => o.key === base)) {
      throw badRequest('Type de verre inconnu');
    }
    const price = computeLensPrice(pricing, base, treatments);
    const sku = lensSku(base, treatments);
    const name = lensLabel(pricing, base, treatments);
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
      data: {
        ...input,
        ...(sku ? { sku } : {}),
        attributes: input.attributes as object | undefined,
        // Chaîne vide = photo retirée par l'utilisateur.
        photoUrl: input.photoUrl === undefined ? undefined : input.photoUrl || null,
        photos: input.photos as object | undefined,
        createdAt: input.createdAt ? new Date(input.createdAt) : undefined,
      },
    });
    if (result.count === 0) throw notFound('Produit introuvable');
    const product = await req.db!.product.findFirst({ where: { id } });
    return reply.send({ product });
  });

  /**
   * Réattribution en masse : déplace tous les produits d'une catégorie vers une
   * autre. Sert notamment à corriger un import où la catégorie n'a pas été
   * détectée (tombée par défaut sur AUTRE) sans repasser produit par produit.
   */
  app.patch('/recategorize', { preHandler: requirePermission('optique.products.update') }, async (req, reply) => {
    const input = productsRecategorizeSchema.parse(req.body);
    const result = await req.db!.product.updateMany({
      where: { category: input.from },
      data: { category: input.to },
    });
    await recordAudit({
      tenantId: req.auth!.tenantId,
      userId: req.auth!.userId,
      action: 'PRODUCTS_RECATEGORIZED',
      entity: 'Product',
      metadata: { from: input.from, to: input.to, count: result.count },
      ...requestMeta(req),
    });
    return reply.send({ count: result.count });
  });

  /**
   * Suppression définitive du produit et de ses lignes de stock (cascade).
   * Un produit déjà vendu ne peut pas disparaître sans détruire les lignes des
   * factures passées : dans ce cas seulement, on le retire du catalogue en le
   * désactivant, et on le signale à l'appelant.
   */
  app.delete('/:id', { preHandler: requirePermission('optique.products.delete') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const product = await req.db!.product.findFirst({ where: { id } });
    if (!product) throw notFound('Produit introuvable');

    const soldLines = await req.db!.saleItem.count({ where: { productId: id } });
    if (soldLines > 0) {
      await req.db!.product.updateMany({ where: { id }, data: { isActive: false } });
      await recordAudit({
        tenantId: req.auth!.tenantId,
        userId: req.auth!.userId,
        action: 'PRODUCT_DEACTIVATED',
        entity: 'Product',
        entityId: id,
        metadata: { name: product.name, soldLines },
        ...requestMeta(req),
      });
      return reply.send({ ok: true, deleted: false, soldLines });
    }

    // Jamais vendu : suppression réelle (les StockItem et leurs mouvements
    // partent en cascade).
    await req.db!.product.deleteMany({ where: { id } });
    await recordAudit({
      tenantId: req.auth!.tenantId,
      userId: req.auth!.userId,
      action: 'PRODUCT_DELETED',
      entity: 'Product',
      entityId: id,
      metadata: { name: product.name, sku: product.sku },
      ...requestMeta(req),
    });
    return reply.send({ ok: true, deleted: true });
  });
}
