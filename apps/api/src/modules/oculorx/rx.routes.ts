import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import {
  RX_NEXT_STATUSES,
  rxChecks,
  rxImportSchema,
  rxLensUpdateSchema,
  rxIsLoss,
  rxOrderCreateSchema,
  rxSettingsSchema,
  rxStatementPaySchema,
  rxStatusSchema,
  rxSupplierSchema,
  type RxStatus,
} from '@oculo/shared-types';
import { requireAuth } from '../../middlewares/auth-guard.js';
import { requirePermission } from '../../middlewares/rbac-guard.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/http-error.js';
import { prisma } from '../../lib/prisma.js';
import {
  OPEN,
  canSeeMargins,
  computeStatement,
  emailOrder,
  getRxSettings,
  monthOf,
  monthRange,
  nextOrderNumber,
  orderSheetHtml,
} from './rx.service.js';
import { clearRxDemo, seedRxDemo } from './rx.demo.js';
import { createLinkedLensOrder, syncLensOrderFromRx } from './rx.link.js';
import { createOutboundPackage } from '../oculotrack/track.service.js';

const VIEW = requirePermission('oculorx.view');
const ORDER = requirePermission('oculorx.order');
const MANAGE = requirePermission('oculorx.manage');

/** Relevés fournisseurs (montants d'achat) : administrateurs uniquement. */
async function ADMIN(req: FastifyRequest) {
  if (!canSeeMargins(req)) throw forbidden("Réservé aux administrateurs : les prix d'achat ne sont visibles que par eux.");
}

async function userName(req: FastifyRequest): Promise<string> {
  const u = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { firstName: true, lastName: true } });
  return u ? `${u.firstName} ${u.lastName}`.trim() : 'Magasin';
}

type OrderRow = Prisma.RxOrderGetPayload<{ include: { supplier: { select: { id: true; name: true; code: true } } } }>;

/** Commande telle que vue par l'écran ; sans les prix d'achat pour un vendeur. */
type LensLink = { id: string; number: string; trackCode: string | null; trackStage: string | null; status: string };

/** Commandes de verres liées (n° Kanban, code OculoTrack), par id. */
async function lensLinks(db: NonNullable<FastifyRequest['db']>, ids: (string | null)[]): Promise<Map<string, LensLink>> {
  const wanted = ids.filter((x): x is string => Boolean(x));
  if (!wanted.length) return new Map();
  const rows = await db.lensOrder.findMany({ where: { id: { in: wanted } }, select: { id: true, number: true, trackCode: true, trackStage: true, status: true } });
  return new Map(rows.map((r) => [r.id, r]));
}

function orderView(o: OrderRow, margins: boolean, link?: LensLink | null) {
  const base = {
    lensOrder: link ?? null,
    id: o.id,
    number: o.number,
    createdAt: o.createdAt,
    status: o.status,
    statusHistory: o.statusHistory,
    supplier: o.supplier,
    lens: o.lensSnapshot,
    customerId: o.customerId,
    patientName: o.patientName,
    fileNumber: o.fileNumber,
    od: o.od,
    og: o.og,
    addition: o.addition,
    pd: o.pd,
    height: o.height,
    frameType: o.frameType,
    mounted: o.mounted,
    urgent: o.urgent,
    comment: o.comment,
    salePrice: o.salePrice,
    saleId: o.saleId,
    userName: o.userName,
    emailSentAt: o.emailSentAt,
    isDemo: o.isDemo,
  };
  if (!margins) return base;
  return { ...base, purchasePrice: o.purchasePrice, supplements: o.supplements, margin: o.salePrice - o.purchasePrice };
}

const SUPPLIER_SELECT = { id: true, name: true, code: true, phone: true, whatsapp: true } as const;

export async function oculorxRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  /* ------------------------------ Réglages ------------------------------ */

  app.get('/settings', { preHandler: VIEW }, async (req, reply) => {
    return reply.send({ settings: await getRxSettings(req.db!), canSeeMargins: canSeeMargins(req) });
  });

  app.put('/settings', { preHandler: MANAGE }, async (req, reply) => {
    const input = rxSettingsSchema.parse(req.body);
    const tenantId = req.auth!.tenantId;
    await req.db!.rxSettings.upsert({
      where: { tenantId },
      create: { tenantId, ...input },
      update: input,
    });
    return reply.send({ settings: await getRxSettings(req.db!) });
  });

  /* ------------------------------ Fournisseurs ------------------------------ */

  app.get('/suppliers', { preHandler: VIEW }, async (req, reply) => {
    const db = req.db!;
    const suppliers = await db.supplier.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true, name: true, code: true, city: true, country: true, deliveryDays: true, contactName: true, phone: true, whatsapp: true,
        email: true, orderEmail: true, rxCoefficient: true, rxVatRate: true, rxDemo: true,
        _count: { select: { rxLenses: true, rxOrders: true } },
      },
    });
    return reply.send({ suppliers });
  });

  app.post('/suppliers', { preHandler: MANAGE }, async (req, reply) => {
    const input = rxSupplierSchema.parse(req.body);
    const supplier = await req.db!.supplier.create({
      data: { ...input, orderEmail: input.orderEmail || null, tenantId: req.auth!.tenantId, categories: ['VERRE'] } as never,
    });
    return reply.status(201).send({ supplier });
  });

  app.patch('/suppliers/:id', { preHandler: MANAGE }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const input = rxSupplierSchema.partial().parse(req.body);
    const res = await req.db!.supplier.updateMany({ where: { id }, data: { ...input, ...(input.orderEmail !== undefined ? { orderEmail: input.orderEmail || null } : {}) } });
    if (res.count === 0) throw notFound('Fournisseur introuvable');
    return reply.send({ ok: true });
  });

  /* ------------------------------ Catalogue ------------------------------ */

  app.get('/lenses', { preHandler: VIEW }, async (req, reply) => {
    const q = z
      .object({ supplierId: z.string().uuid().optional(), q: z.string().optional(), geometry: z.string().optional(), index: z.coerce.number().optional(), treatment: z.string().optional(), all: z.string().optional() })
      .parse(req.query);
    const db = req.db!;
    const settings = await getRxSettings(db);
    const margins = canSeeMargins(req);
    const text = q.q?.trim();
    const lenses = await db.rxLens.findMany({
      where: {
        ...(q.supplierId ? { supplierId: q.supplierId } : {}),
        ...(q.all ? {} : { isActive: true }),
        ...(q.geometry ? { geometry: q.geometry } : {}),
        ...(q.index ? { lensIndex: q.index } : {}),
        ...(q.treatment ? { treatment: { contains: q.treatment, mode: 'insensitive' as const } } : {}),
        ...(text ? { OR: [{ reference: { contains: text, mode: 'insensitive' as const } }, { designation: { contains: text, mode: 'insensitive' as const } }] } : {}),
      },
      include: { supplier: { select: SUPPLIER_SELECT } },
      orderBy: [{ supplierId: 'asc' }, { geometry: 'asc' }, { lensIndex: 'asc' }, { reference: 'asc' }],
      take: 1000,
    });
    return reply.send({
      lenses: lenses.map((l) => {
        // Prix de vente = prix du catalogue boutique uniquement (null tant qu'il n'est pas fixé).
        const suggested = l.shopPrice && l.shopPrice > 0 ? l.shopPrice : null;
        const { purchasePrice, priceHistory, ...rest } = l;
        return margins
          ? { ...rest, purchasePrice, priceHistory, suggestedPrice: suggested, margin: suggested != null ? suggested - purchasePrice : null }
          : { ...rest, suggestedPrice: suggested };
      }),
    });
  });

  app.post('/lenses/import', { preHandler: [MANAGE, ADMIN], bodyLimit: 8 * 1024 * 1024 }, async (req, reply) => {
    const input = rxImportSchema.parse(req.body);
    const db = req.db!;
    const tenantId = req.auth!.tenantId;
    const supplier = await db.supplier.findFirst({ where: { id: input.supplierId }, select: { id: true } });
    if (!supplier) throw notFound('Fournisseur introuvable');
    const existing = await db.rxLens.findMany({ where: { supplierId: supplier.id }, select: { id: true, reference: true, purchasePrice: true, priceHistory: true } });
    const byRef = new Map(existing.map((e) => [e.reference.toLowerCase(), e]));
    let added = 0;
    let updated = 0;
    let unchanged = 0;
    const seen = new Set<string>();
    const now = new Date();
    for (const row of input.rows) {
      const key = row.reference.toLowerCase();
      if (seen.has(key)) continue; // doublon dans le fichier : la première ligne fait foi
      seen.add(key);
      const prev = byRef.get(key);
      // Nom et prix boutique absents du fichier : on garde ceux déjà saisis.
      const { shopName, shopPrice, ...base } = row;
      const data = { ...base, ...(shopName ? { shopName } : {}), ...(shopPrice ? { shopPrice } : {}), isActive: true };
      if (!prev) {
        await db.rxLens.create({ data: { ...data, tenantId, supplierId: supplier.id } as never });
        added++;
      } else if (prev.purchasePrice !== row.purchasePrice) {
        // Prix modifié : l'ancien prix part dans l'historique, daté.
        const history = [...((prev.priceHistory as { price: number; until: string }[]) ?? []), { price: prev.purchasePrice, until: now.toISOString() }];
        await db.rxLens.updateMany({ where: { id: prev.id }, data: { ...data, priceHistory: history, priceUpdatedAt: now } });
        updated++;
      } else {
        await db.rxLens.updateMany({ where: { id: prev.id }, data });
        unchanged++;
      }
    }
    return reply.send({ added, updated, unchanged });
  });

  /**
   * Retire le catalogue importé d'un fournisseur (mauvais fichier, nouvelle
   * grille). Les verres déjà commandés sont seulement désactivés, pour garder
   * l'historique des commandes intact.
   */
  app.delete('/suppliers/:id/lenses', { preHandler: MANAGE }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const db = req.db!;
    const supplier = await db.supplier.findFirst({ where: { id }, select: { id: true } });
    if (!supplier) throw notFound('Fournisseur introuvable');
    const deactivated = await db.rxLens.updateMany({ where: { supplierId: id, orders: { some: {} } }, data: { isActive: false } });
    const deleted = await db.rxLens.deleteMany({ where: { supplierId: id, orders: { none: {} } } });
    return reply.send({ deleted: deleted.count, deactivated: deactivated.count });
  });

  app.patch('/lenses/:id', { preHandler: MANAGE }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const input = rxLensUpdateSchema.parse(req.body);
    if (input.shopPrice) {
      const lens = await req.db!.rxLens.findFirst({ where: { id }, select: { purchasePrice: true } });
      if (!lens) throw notFound('Verre introuvable');
      if (rxIsLoss(input.shopPrice, lens.purchasePrice)) {
        throw badRequest(`Vente à perte refusée : la paire s'achète ${(lens.purchasePrice * 2).toLocaleString('fr-FR')} FCFA, le prix boutique doit être au moins égal.`);
      }
    }
    const res = await req.db!.rxLens.updateMany({
      where: { id },
      data: {
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.shopName !== undefined ? { shopName: input.shopName || null } : {}),
        ...(input.shopPrice !== undefined ? { shopPrice: input.shopPrice || null } : {}),
      },
    });
    if (res.count === 0) throw notFound('Verre introuvable');
    return reply.send({ ok: true });
  });

  /* ------------------------------ Commandes ------------------------------ */

  app.get('/orders', { preHandler: VIEW }, async (req, reply) => {
    const q = z
      .object({ status: z.string().optional(), supplierId: z.string().uuid().optional(), from: z.string().optional(), to: z.string().optional(), q: z.string().optional(), limit: z.coerce.number().int().min(1).max(500).optional() })
      .parse(req.query);
    const text = q.q?.trim();
    const where: Prisma.RxOrderWhereInput = {
      ...(q.status === 'open' ? { status: { in: OPEN } } : q.status === 'delivered' ? { status: 'DELIVERED' } : q.status ? { status: q.status } : {}),
      ...(q.supplierId ? { supplierId: q.supplierId } : {}),
      ...(q.from || q.to ? { createdAt: { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lt: new Date(new Date(q.to).getTime() + 86_400_000) } : {}) } } : {}),
      ...(text ? { OR: [{ number: { contains: text, mode: 'insensitive' } }, { patientName: { contains: text, mode: 'insensitive' } }, { fileNumber: { contains: text, mode: 'insensitive' } }] } : {}),
    };
    const orders = await req.db!.rxOrder.findMany({ where, include: { supplier: { select: SUPPLIER_SELECT } }, orderBy: { createdAt: 'desc' }, take: q.limit ?? 300 });
    const margins = canSeeMargins(req);
    const links = await lensLinks(req.db!, orders.map((o) => o.lensOrderId));
    return reply.send({ orders: orders.map((o) => orderView(o, margins, o.lensOrderId ? links.get(o.lensOrderId) : null)) });
  });

  app.get('/orders/:id', { preHandler: VIEW }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const o = await req.db!.rxOrder.findFirst({ where: { id }, include: { supplier: { select: SUPPLIER_SELECT } } });
    if (!o) throw notFound('Commande introuvable');
    const links = await lensLinks(req.db!, [o.lensOrderId]);
    return reply.send({ order: orderView(o, canSeeMargins(req), o.lensOrderId ? links.get(o.lensOrderId) : null) });
  });

  app.post('/orders', { preHandler: ORDER }, async (req, reply) => {
    const input = rxOrderCreateSchema.parse(req.body);
    const db = req.db!;
    const tenantId = req.auth!.tenantId;
    const lens = await db.rxLens.findFirst({ where: { id: input.lensId, isActive: true }, include: { supplier: true } });
    if (!lens) throw notFound('Verre introuvable');
    let patientName = input.patientName?.trim() ?? '';
    const fileNumber = input.fileNumber?.trim() || null;
    if (input.customerId) {
      const c = await db.customer.findFirst({ where: { id: input.customerId }, select: { firstName: true, lastName: true } });
      if (!c) throw badRequest('Patient introuvable');
      patientName ||= `${c.firstName} ${c.lastName}`.trim();
    }
    // Mêmes contrôles qu'à l'écran : une commande hors fabrication est refusée.
    const failed = rxChecks(lens, { od: input.od, og: input.og, addition: input.addition, hasPatient: Boolean(patientName) }).filter((c) => !c.ok);
    if (failed.length) throw badRequest(`Commande impossible : ${failed.map((c) => `${c.label} (${c.detail})`).join(' ; ')}`);

    const settings = await getRxSettings(db);
    const supplements = [
      ...(input.mounted ? [{ label: 'Taillé-monté', amount: settings.mountedFee }] : []),
      ...(input.urgent ? [{ label: 'Urgence', amount: settings.urgentFee }] : []),
    ];
    const purchasePrice = lens.purchasePrice * 2 + supplements.reduce((s, x) => s + x.amount, 0);
    // Pas de vente à perte : le prix patient doit couvrir l'achat (verres + suppléments).
    if (rxIsLoss(input.salePrice, purchasePrice)) {
      throw badRequest(
        canSeeMargins(req)
          ? `Vente à perte refusée : le prix de vente (${input.salePrice.toLocaleString('fr-FR')} FCFA) est inférieur au prix d'achat (${purchasePrice.toLocaleString('fr-FR')} FCFA).`
          : 'Vente à perte refusée : ce prix de vente est trop bas pour ce verre. Utilisez le prix boutique.',
      );
    }
    const now = new Date();
    const by = await userName(req);
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });

    let order: OrderRow | null = null;
    for (let attempt = 0; attempt < 4 && !order; attempt++) {
      const number = await nextOrderNumber(db, now);
      try {
        order = await db.rxOrder.create({
          data: {
            tenantId,
            number,
            branchId: input.branchId ?? null,
            userId: req.auth!.userId,
            userName: by,
            supplierId: lens.supplierId,
            lensId: lens.id,
            lensSnapshot: { reference: lens.reference, designation: lens.designation, shopName: lens.shopName, fabrication: lens.fabrication, geometry: lens.geometry, lensIndex: lens.lensIndex, material: lens.material, treatment: lens.treatment, unitPrice: lens.purchasePrice },
            customerId: input.customerId ?? null,
            patientName,
            fileNumber,
            od: input.od,
            og: input.og,
            addition: input.addition ?? null,
            pd: input.pd ?? null,
            height: input.height ?? null,
            frameType: input.frameType ?? null,
            mounted: input.mounted,
            urgent: input.urgent,
            comment: input.comment || null,
            purchasePrice,
            supplements,
            salePrice: input.salePrice,
            status: 'SENT',
            statusHistory: [{ status: 'SENT', at: now.toISOString(), by }],
          } as never,
          include: { supplier: { select: SUPPLIER_SELECT } },
        });
      } catch (e) {
        if ((e as { code?: string }).code !== 'P2002') throw e; // numéro pris entre-temps : on réessaie
      }
    }
    if (!order) throw conflict('Numéro de commande indisponible, réessayez');

    // Commande de verres (Kanban) + suivi OculoTrack créés avec la commande.
    const link = await createLinkedLensOrder(db, tenantId, order, lens.supplier, { type: 'STAFF', id: req.auth!.userId, name: by, ip: req.ip, userAgent: req.headers['user-agent'] ?? null });
    const sent = await emailOrder(lens.supplier.orderEmail, orderSheetHtml(order, { name: tenant?.name ?? 'Magasin' }), order.number, tenant?.name ?? 'Magasin');
    if (sent) await db.rxOrder.updateMany({ where: { id: order.id }, data: { emailSentAt: new Date() } });
    const lensOrder = link ? { id: link.lensOrderId, number: link.number, trackCode: link.trackCode, trackStage: 'CREATED', status: 'ORDERED' } : null;
    return reply.status(201).send({ order: { ...orderView(order, canSeeMargins(req), lensOrder), emailSentAt: sent ? new Date() : null }, emailed: sent });
  });

  app.post('/orders/:id/status', { preHandler: ORDER }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const input = rxStatusSchema.parse(req.body);
    const db = req.db!;
    const o = await db.rxOrder.findFirst({ where: { id }, select: { status: true, statusHistory: true, lensOrderId: true } });
    if (!o) throw notFound('Commande introuvable');
    if (!RX_NEXT_STATUSES[o.status as RxStatus]?.includes(input.status)) throw badRequest('Changement de statut impossible depuis ce statut');
    await syncLensOrderFromRx(db, o.lensOrderId, input.status);
    const history = [...((o.statusHistory as unknown[]) ?? []), { status: input.status, at: new Date().toISOString(), by: await userName(req), note: input.note || undefined }];
    await db.rxOrder.updateMany({ where: { id }, data: { status: input.status, statusHistory: history as Prisma.InputJsonValue } });
    return reply.send({ ok: true });
  });

  /** À la livraison : rattache la commande à la facture patient (n° de vente). */
  app.post('/orders/:id/link-sale', { preHandler: ORDER }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { saleNumber } = z.object({ saleNumber: z.string().trim().min(1).max(40) }).parse(req.body);
    const db = req.db!;
    const sale = await db.sale.findFirst({ where: { number: saleNumber.toUpperCase() }, select: { id: true, number: true } });
    if (!sale) throw notFound('Facture introuvable');
    const res = await db.rxOrder.updateMany({ where: { id }, data: { saleId: sale.id } });
    if (res.count === 0) throw notFound('Commande introuvable');
    return reply.send({ sale });
  });

  app.post('/orders/:id/resend', { preHandler: ORDER }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const db = req.db!;
    const o = await db.rxOrder.findFirst({ where: { id }, include: { supplier: { select: { orderEmail: true } } } });
    if (!o) throw notFound('Commande introuvable');
    if (!o.supplier.orderEmail) throw badRequest("Ce fournisseur n'a pas d'email de commande");
    const tenant = await prisma.tenant.findUnique({ where: { id: req.auth!.tenantId }, select: { name: true } });
    const sent = await emailOrder(o.supplier.orderEmail, orderSheetHtml(o, { name: tenant?.name ?? 'Magasin' }), o.number, tenant?.name ?? 'Magasin');
    if (!sent) throw badRequest("L'email n'a pas pu être envoyé");
    await db.rxOrder.updateMany({ where: { id }, data: { emailSentAt: new Date() } });
    return reply.send({ ok: true });
  });

  /**
   * Ordonnances d'un patient : celles de son dossier (Clients) et celles de
   * ses « Commandes de verres », pour pré-remplir une commande OculoRX.
   */
  app.get('/patient-rx', { preHandler: ORDER }, async (req, reply) => {
    const { customerId } = z.object({ customerId: z.string().uuid() }).parse(req.query);
    const db = req.db!;
    const num = (v: unknown) => {
      if (v == null || v === '') return null;
      const n = Number(String(v).replace(',', '.').replace(/^plan$/i, '0'));
      return Number.isFinite(n) ? n : null;
    };
    const rxs = await db.opticalPrescription.findMany({ where: { customerId }, orderBy: { date: 'desc' }, take: 10 });
    const lensOrders = await db.lensOrder.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, number: true, createdAt: true, description: true, lensConfig: true },
    });
    type Eye = { sphere?: number; cylinder?: number; axis?: number; addition?: number };
    const fromRx = rxs.map((p) => ({
      source: 'PRESCRIPTION' as const,
      id: p.id,
      date: p.date,
      label: `Ordonnance du ${p.date.toLocaleDateString('fr-FR')}${p.prescriberName ? ` · ${p.prescriberName}` : ''}`,
      od: { sph: num(p.odSphere), cyl: num(p.odCylinder), axis: num(p.odAxis) },
      og: { sph: num(p.ogSphere), cyl: num(p.ogCylinder), axis: num(p.ogAxis) },
      addition: num(p.odAddition) ?? num(p.ogAddition),
      pd: num(p.pupillaryDistance),
      height: num((p as { odHeight?: unknown }).odHeight),
    }));
    const fromOrders = lensOrders
      .map((o) => {
        const cfg = o.lensConfig as { prescription?: { sameForBoth?: boolean; od?: Eye; og?: Eye } } | null;
        const rx = cfg?.prescription;
        if (!rx?.od) return null;
        const og = rx.sameForBoth ? rx.od : rx.og ?? {};
        return {
          source: 'LENS_ORDER' as const,
          id: o.id,
          date: o.createdAt,
          label: `Commande de verres ${o.number} · ${o.description}`,
          od: { sph: rx.od.sphere ?? null, cyl: rx.od.cylinder ?? null, axis: rx.od.axis ?? null },
          og: { sph: og.sphere ?? null, cyl: og.cylinder ?? null, axis: og.axis ?? null },
          addition: rx.od.addition ?? og.addition ?? null,
          pd: null,
          height: null,
        };
      })
      .filter(Boolean);
    return reply.send({ sources: [...fromRx, ...fromOrders] });
  });

  /**
   * Envoi groupé : les commandes de la journée d'un même fournisseur partent
   * dans un seul colis OculoTrack, visible aussitôt sur son portail.
   */
  app.post('/orders/package', { preHandler: ORDER }, async (req, reply) => {
    const { orderIds } = z.object({ orderIds: z.array(z.string().uuid()).min(1).max(50) }).parse(req.body);
    const db = req.db!;
    const orders = await db.rxOrder.findMany({ where: { id: { in: orderIds } }, select: { id: true, number: true, supplierId: true, lensOrderId: true, status: true } });
    if (orders.length !== orderIds.length) throw notFound('Commande introuvable');
    const suppliers = new Set(orders.map((o) => o.supplierId));
    if (suppliers.size > 1) throw badRequest('Un envoi groupé ne concerne qu\'un seul fournisseur');
    const missing = orders.find((o) => !o.lensOrderId);
    if (missing) throw badRequest(`La commande ${missing.number} n'a pas de suivi OculoTrack`);
    const pkg = await createOutboundPackage(
      db,
      req.auth!.tenantId,
      { lensOrderIds: orders.map((o) => o.lensOrderId!), supplierId: [...suppliers][0], note: `OculoRX : ${orders.map((o) => o.number).join(', ')}` },
      { type: 'STAFF', id: req.auth!.userId, name: await userName(req), ip: req.ip, userAgent: req.headers['user-agent'] ?? null },
    );
    return reply.send({ package: { id: pkg.id, number: pkg.number } });
  });

  /* ------------------------------ Tableau de bord ------------------------------ */

  app.get('/dashboard', { preHandler: VIEW }, async (req, reply) => {
    const db = req.db!;
    const margins = canSeeMargins(req);
    const now = new Date();
    const month = monthOf(now);
    const prevDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const prev = monthOf(prevDate);
    const stats = async (m: string) => {
      const { start, end } = monthRange(m);
      const rows = await db.rxOrder.findMany({
        where: { createdAt: { gte: start, lt: end }, status: { notIn: ['CANCELLED', 'RETURNED'] } },
        select: { purchasePrice: true, salePrice: true, supplierId: true },
      });
      const purchases = rows.reduce((s, r) => s + r.purchasePrice, 0);
      const sales = rows.reduce((s, r) => s + r.salePrice, 0);
      return { orders: rows.length, purchases, sales, margin: sales - purchases, marginPct: sales > 0 ? Math.round(((sales - purchases) / sales) * 1000) / 10 : 0, rows };
    };
    const [cur, before] = await Promise.all([stats(month), stats(prev)]);
    const open = await db.rxOrder.count({ where: { status: { in: OPEN } } });
    const suppliers = await db.supplier.findMany({ where: { id: { in: [...new Set(cur.rows.map((r) => r.supplierId))] } }, select: { id: true, name: true } });
    const bySupplier = suppliers
      .map((s) => ({ id: s.id, name: s.name, purchases: cur.rows.filter((r) => r.supplierId === s.id).reduce((a, r) => a + r.purchasePrice, 0), orders: cur.rows.filter((r) => r.supplierId === s.id).length }))
      .sort((a, b) => b.purchases - a.purchases);
    const recent = await db.rxOrder.findMany({ include: { supplier: { select: SUPPLIER_SELECT } }, orderBy: { createdAt: 'desc' }, take: 6 });
    const strip = ({ rows: _rows, ...s }: Awaited<ReturnType<typeof stats>>) =>
      margins ? s : { orders: s.orders, sales: s.sales };
    return reply.send({
      month,
      previousMonth: prev,
      current: strip(cur),
      previous: strip(before),
      open,
      bySupplier: margins ? bySupplier : bySupplier.map((s) => ({ id: s.id, name: s.name, orders: s.orders })),
      recent: recent.map((o) => orderView(o, margins)),
      canSeeMargins: margins,
    });
  });

  /* ------------------------------ Relevés mensuels ------------------------------ */

  app.get('/statements', { preHandler: [MANAGE, ADMIN] }, async (req, reply) => {
    const statements = await req.db!.rxStatement.findMany({ include: { supplier: { select: SUPPLIER_SELECT } }, orderBy: [{ month: 'desc' }, { generatedAt: 'desc' }] });
    return reply.send({ statements });
  });

  app.get('/statements/preview', { preHandler: [MANAGE, ADMIN] }, async (req, reply) => {
    const q = z.object({ supplierId: z.string().uuid(), month: z.string().regex(/^\d{4}-\d{2}$/) }).parse(req.query);
    const db = req.db!;
    const st = await computeStatement(db, q.supplierId, q.month, await getRxSettings(db));
    if (!st) throw notFound('Fournisseur introuvable');
    const saved = await db.rxStatement.findFirst({ where: { supplierId: q.supplierId, month: q.month } });
    return reply.send({ statement: st, saved });
  });

  app.post('/statements', { preHandler: [MANAGE, ADMIN] }, async (req, reply) => {
    const input = z.object({ supplierId: z.string().uuid(), month: z.string().regex(/^\d{4}-\d{2}$/) }).parse(req.body);
    const db = req.db!;
    const tenantId = req.auth!.tenantId;
    const st = await computeStatement(db, input.supplierId, input.month, await getRxSettings(db));
    if (!st) throw notFound('Fournisseur introuvable');
    const data = { number: st.number, totalHt: st.totalHt, vatRate: st.vatRate, vatAmount: st.vatAmount, totalTtc: st.totalTtc, orderCount: st.orderCount, dueDate: new Date(st.dueDate), generatedAt: new Date() };
    const saved = await db.rxStatement.upsert({
      where: { tenantId_supplierId_month: { tenantId, supplierId: input.supplierId, month: input.month } },
      create: { ...data, tenantId, supplierId: input.supplierId, month: input.month },
      update: data,
    });
    return reply.send({ statement: st, saved });
  });

  app.post('/statements/:id/pay', { preHandler: [MANAGE, ADMIN] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const input = rxStatementPaySchema.parse(req.body);
    const res = await req.db!.rxStatement.updateMany({
      where: { id },
      data: input.paid ? { paidAt: input.paidAt ? new Date(input.paidAt) : new Date(), paymentMethod: input.paymentMethod || null } : { paidAt: null, paymentMethod: null },
    });
    if (res.count === 0) throw notFound('Relevé introuvable');
    return reply.send({ ok: true });
  });

  /* ------------------------------ Démonstration ------------------------------ */

  app.post('/demo', { preHandler: MANAGE }, async (req, reply) => {
    const r = await seedRxDemo(req.db!, req.auth!.tenantId, await userName(req));
    return reply.send(r);
  });

  app.delete('/demo', { preHandler: MANAGE }, async (req, reply) => {
    return reply.send(await clearRxDemo(req.db!));
  });
}
