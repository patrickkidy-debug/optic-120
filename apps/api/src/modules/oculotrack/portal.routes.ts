import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  LAB_SETTABLE_STAGES,
  portalLoginSchema,
  portalSetPasswordSchema,
  trackAnomalySchema,
  trackAttachmentSchema,
  trackLabStageSchema,
  trackProofSchema,
  trackReceiveSchema,
  trackReturnSchema,
} from '@oculo/shared-types';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { forTenant } from '../../lib/prisma-tenant.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import { hashRefreshToken } from '../../lib/tokens.js';
import { badRequest, forbidden, notFound, unauthorized } from '../../lib/http-error.js';
import {
  PORTAL_REFRESH_COOKIE,
  clearPortalCookie,
  issuePortalSession,
  loadPortalContext,
  requirePortalAuth,
  setPortalCookie,
  type PortalScope,
} from './portal-auth.js';
import {
  addAttachment,
  addEvent,
  alreadyApplied,
  carrierCheckpoint,
  carrierPickup,
  createReturn,
  notifyLabStage,
  receivePackage,
  reportAnomaly,
  setStage,
  type Actor,
} from './track.service.js';

function actorOf(req: FastifyRequest, scope?: PortalScope): Actor {
  const p = req.portal!;
  return {
    type: p.kind === 'CARRIER' ? 'CARRIER' : 'SUPPLIER',
    id: p.accountId,
    // « Laboratoire XYZ (Awa) » : le nom du fournisseur de la fiche magasin, puis la personne.
    name: scope?.supplierName && scope.supplierName !== p.name ? `${scope.supplierName} (${p.name})` : p.name,
    ip: req.ip,
    userAgent: req.headers['user-agent'] ?? null,
  };
}

/** Initiales du client : le laboratoire n'a pas besoin de son identité complète. */
function initials(c: { firstName: string; lastName: string } | null) {
  if (!c) return null;
  return `${c.firstName.charAt(0)}. ${c.lastName.charAt(0)}.`.toUpperCase();
}

/** Filtre Prisma des commandes visibles par un compte FOURNISSEUR. */
function supplierOrderWhere(scopes: PortalScope[]) {
  const s = scopes.filter((x) => x.supplierId);
  return { trackCode: { not: null }, OR: s.length ? s.map((x) => ({ tenantId: x.tenantId, supplierId: x.supplierId! })) : [{ id: '__none__' }] };
}

/** Filtre Prisma des colis visibles : ceux du fournisseur, ou ceux confiés au transporteur. */
function packageWhere(req: FastifyRequest) {
  const p = req.portal!;
  if (p.kind === 'CARRIER') {
    const ids = p.scopes.map((s) => s.accessId);
    return { carrierAccessId: { in: ids.length ? ids : ['__none__'] } };
  }
  const s = p.scopes.filter((x) => x.supplierId);
  return { OR: s.length ? s.map((x) => ({ tenantId: x.tenantId, supplierId: x.supplierId! })) : [{ id: '__none__' }] };
}

function scopeFor(req: FastifyRequest, tenantId: string, supplierId?: string | null, carrierAccessId?: string | null) {
  const p = req.portal!;
  const scope = p.kind === 'CARRIER'
    ? p.scopes.find((s) => s.tenantId === tenantId && s.accessId === carrierAccessId)
    : p.scopes.find((s) => s.tenantId === tenantId && s.supplierId === supplierId);
  if (!scope) throw forbidden('Accès non autorisé');
  return scope;
}

async function loadOrderInScope(req: FastifyRequest, id: string) {
  if (req.portal!.kind !== 'SUPPLIER') throw forbidden('Réservé aux fournisseurs');
  const o = await prisma.lensOrder.findFirst({ where: { id, ...supplierOrderWhere(req.portal!.scopes) }, select: { id: true, tenantId: true, supplierId: true } });
  if (!o) throw notFound('Commande introuvable');
  return { order: o, scope: scopeFor(req, o.tenantId, o.supplierId), db: forTenant(o.tenantId) };
}

async function loadPackageInScope(req: FastifyRequest, id: string) {
  const pkg = await prisma.trackPackage.findFirst({ where: { id, ...packageWhere(req) }, select: { id: true, tenantId: true, supplierId: true, carrierAccessId: true, direction: true, status: true } });
  if (!pkg) throw notFound('Colis introuvable');
  return { pkg, scope: scopeFor(req, pkg.tenantId, pkg.supplierId, pkg.carrierAccessId), db: forTenant(pkg.tenantId) };
}

const ORDER_PORTAL = {
  id: true,
  tenantId: true,
  number: true,
  trackCode: true,
  trackStage: true,
  description: true,
  frameRef: true,
  expectedAt: true,
  updatedAt: true,
  customer: { select: { firstName: true, lastName: true } },
  frameProduct: { select: { name: true, brand: true } },
  _count: { select: { trackAnomalies: { where: { status: 'OPEN' } } } },
} as const;

const PROCESSING = ['RECEIVED_BY_LAB', 'REGISTERED_BY_LAB', 'MOUNTING', 'MOUNTED', 'QUALITY_CHECK'];

export async function portalRoutes(app: FastifyInstance): Promise<void> {
  const strict = { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } };

  /* ------------------------------- Authentification ------------------------------ */
  app.get('/auth/invite/:token', strict, async (req, reply) => {
    const { token } = req.params as { token: string };
    const acc = await prisma.portalAccount.findUnique({ where: { inviteTokenHash: hashRefreshToken(token) } });
    if (!acc || !acc.inviteExpiresAt || acc.inviteExpiresAt < new Date()) throw notFound('Invitation invalide ou expirée');
    return reply.send({ name: acc.name, email: acc.email, kind: acc.kind });
  });

  app.post('/auth/accept-invite', strict, async (req, reply) => {
    const { token, password } = portalSetPasswordSchema.parse(req.body);
    const acc = await prisma.portalAccount.findUnique({ where: { inviteTokenHash: hashRefreshToken(token) } });
    if (!acc || !acc.inviteExpiresAt || acc.inviteExpiresAt < new Date()) throw notFound('Invitation invalide ou expirée');
    await prisma.portalAccount.update({
      where: { id: acc.id },
      data: { passwordHash: await hashPassword(password), inviteTokenHash: null, inviteExpiresAt: null },
    });
    const { accessToken, refreshToken } = await issuePortalSession(acc.id, req);
    setPortalCookie(reply, refreshToken);
    return reply.send({ accessToken, account: await loadPortalContext(acc.id) });
  });

  app.post('/auth/login', strict, async (req, reply) => {
    const { email, password } = portalLoginSchema.parse(req.body);
    const acc = await prisma.portalAccount.findUnique({ where: { email } });
    if (!acc || !acc.passwordHash || !(await verifyPassword(acc.passwordHash, password))) throw unauthorized('Email ou mot de passe incorrect');
    if (!acc.isActive) throw forbidden('Compte désactivé');
    const { accessToken, refreshToken } = await issuePortalSession(acc.id, req);
    setPortalCookie(reply, refreshToken);
    return reply.send({ accessToken, account: await loadPortalContext(acc.id) });
  });

  app.post('/auth/refresh', async (req, reply) => {
    const token = req.cookies[PORTAL_REFRESH_COOKIE];
    if (!token) throw unauthorized('Aucune session');
    const s = await prisma.portalSession.findUnique({ where: { tokenHash: hashRefreshToken(token) } });
    if (!s || s.revokedAt || s.expiresAt < new Date()) throw unauthorized('Session expirée, reconnectez-vous');
    await prisma.portalSession.update({ where: { id: s.id }, data: { revokedAt: new Date() } });
    const { accessToken, refreshToken } = await issuePortalSession(s.accountId, req);
    setPortalCookie(reply, refreshToken);
    return reply.send({ accessToken, account: await loadPortalContext(s.accountId) });
  });

  app.post('/auth/logout', async (req, reply) => {
    const token = req.cookies[PORTAL_REFRESH_COOKIE];
    if (token) await prisma.portalSession.updateMany({ where: { tokenHash: hashRefreshToken(token) }, data: { revokedAt: new Date() } });
    clearPortalCookie(reply);
    return reply.send({ ok: true });
  });

  /* --------------------------------- Espace portail ------------------------------- */
  await app.register(async (p) => {
    p.addHook('preHandler', requirePortalAuth);

    p.get('/me', async (req, reply) => reply.send({ account: req.portal }));

    p.get('/dashboard', async (req, reply) => {
      const portal = req.portal!;
      const since = new Date(Date.now() - 30 * 86_400_000);
      if (portal.kind === 'CARRIER') {
        const where = packageWhere(req);
        const [toPickup, inTransit, delivered] = await Promise.all([
          prisma.trackPackage.count({ where: { ...where, status: { in: ['PREPARING', 'HANDED_TO_CARRIER'] } } }),
          prisma.trackPackage.count({ where: { ...where, status: 'IN_TRANSIT' } }),
          prisma.trackPackage.count({ where: { ...where, status: 'RECEIVED', receivedAt: { gte: since } } }),
        ]);
        return reply.send({ kind: 'CARRIER', counts: { toPickup, inTransit, delivered } });
      }
      const ow = supplierOrderWhere(portal.scopes);
      const pw = packageWhere(req);
      const [toReceive, processing, waiting, ready, done, anomalies] = await Promise.all([
        prisma.trackPackage.count({ where: { ...pw, direction: 'OUTBOUND', status: { in: ['HANDED_TO_CARRIER', 'IN_TRANSIT'] } } }),
        prisma.lensOrder.count({ where: { ...ow, trackStage: { in: PROCESSING } } }),
        prisma.lensOrder.count({ where: { ...ow, trackStage: 'MOUNT_PENDING' } }),
        prisma.lensOrder.count({ where: { ...ow, trackStage: 'READY_FOR_RETURN' } }),
        prisma.lensOrder.count({ where: { ...ow, trackStage: { in: ['RETURN_HANDED', 'IN_TRANSIT_TO_STORE', 'ARRIVED_AT_STORE', 'RECEIPT_CONFIRMED', 'COMPLETED'] }, updatedAt: { gte: since } } }),
        prisma.trackAnomaly.count({ where: { status: 'OPEN', OR: [{ lensOrder: ow }, { package: pw }] } }),
      ]);
      return reply.send({ kind: 'SUPPLIER', counts: { toReceive, processing, waiting, ready, done, anomalies } });
    });

    p.get('/orders', async (req, reply) => {
      const q = req.query as { filter?: string; q?: string };
      if (req.portal!.kind !== 'SUPPLIER') return reply.send({ orders: [] });
      const stageFilter =
        q.filter === 'processing' ? { trackStage: { in: PROCESSING } }
        : q.filter === 'waiting' ? { trackStage: 'MOUNT_PENDING' }
        : q.filter === 'ready' ? { trackStage: 'READY_FOR_RETURN' }
        : q.filter === 'done' ? { trackStage: { in: ['RETURN_HANDED', 'IN_TRANSIT_TO_STORE', 'ARRIVED_AT_STORE', 'RECEIPT_CONFIRMED', 'COMPLETED'] } }
        : q.filter === 'incoming' ? { trackStage: { in: ['PACKED', 'HANDED_TO_CARRIER', 'IN_TRANSIT_TO_LAB'] } }
        : { trackStage: { notIn: ['COMPLETED', 'CANCELLED', 'CREATED', 'FRAME_PREPARED'] } };
      const s = q.q?.trim();
      const orders = await prisma.lensOrder.findMany({
        where: {
          ...supplierOrderWhere(req.portal!.scopes),
          ...stageFilter,
          ...(s ? { OR: [{ trackCode: { contains: s, mode: 'insensitive' } }, { frameRef: { contains: s, mode: 'insensitive' } }] } : {}),
        },
        select: ORDER_PORTAL,
        orderBy: { updatedAt: 'desc' },
        take: 200,
      });
      const names = new Map(req.portal!.scopes.map((x) => [x.tenantId, x.tenantName]));
      return reply.send({
        orders: orders.map(({ customer, _count, ...o }) => ({ ...o, store: names.get(o.tenantId) ?? '', client: initials(customer), openAnomalies: _count.trackAnomalies })),
      });
    });

    /** Fiche commande côté laboratoire : tout ce qu'il faut pour monter, sans l'identité du client. */
    p.get('/orders/:id', async (req, reply) => {
      const { id } = req.params as { id: string };
      const { scope, db } = await loadOrderInScope(req, id);
      const o = await db.lensOrder.findFirst({
        where: { id },
        select: {
          ...ORDER_PORTAL,
          lensConfig: true,
          odLens: true,
          ogLens: true,
          notes: true,
          measurementId: true,
          trackAttachments: { select: { id: true, kind: true, name: true, mime: true, sizeBytes: true, uploadedByName: true, createdAt: true }, orderBy: { createdAt: 'desc' } },
          trackAnomalies: { orderBy: { createdAt: 'desc' } },
          packageItems: { select: { package: { select: { id: true, number: true, direction: true, status: true } } } },
        },
      });
      if (!o) throw notFound('Commande introuvable');
      const measurement = o.measurementId
        ? await db.opticalMeasurement.findFirst({
            where: { id: o.measurementId },
            select: { pdTotal: true, odMonoPd: true, ogMonoPd: true, odHeight: true, ogHeight: true, nearPd: true, lensWidth: true, lensHeight: true, bridge: true, frameWidth: true, vertex: true, pantoTilt: true, wrapAngle: true, frameLabel: true, takenAt: true },
          })
        : null;
      const events = await db.trackEvent.findMany({ where: { lensOrderId: id }, orderBy: { occurredAt: 'asc' }, select: { id: true, type: true, stage: true, actorType: true, actorName: true, message: true, occurredAt: true } });
      const { customer, _count, ...rest } = o;
      return reply.send({ order: { ...rest, store: scope.tenantName, client: initials(customer), openAnomalies: _count.trackAnomalies }, measurement, events });
    });

    p.get('/packages', async (req, reply) => {
      const q = req.query as { filter?: string };
      const statusFilter =
        q.filter === 'incoming' ? { direction: 'OUTBOUND', status: { in: ['HANDED_TO_CARRIER', 'IN_TRANSIT'] } }
        : q.filter === 'pickup' ? { status: { in: ['PREPARING', 'HANDED_TO_CARRIER'] } }
        : q.filter === 'transit' ? { status: 'IN_TRANSIT' }
        : { status: { not: 'CANCELLED' } };
      const packages = await prisma.trackPackage.findMany({
        where: { ...packageWhere(req), ...statusFilter },
        select: { id: true, tenantId: true, number: true, direction: true, status: true, fromCity: true, toCity: true, carrierName: true, externalTracking: true, expectedAt: true, shippedAt: true, receivedAt: true, _count: { select: { items: true } } },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      const names = new Map(req.portal!.scopes.map((x) => [x.tenantId, x.tenantName]));
      return reply.send({ packages: packages.map((x) => ({ ...x, store: names.get(x.tenantId) ?? '' })) });
    });

    async function packageDetail(req: FastifyRequest, id: string) {
      const { scope, db } = await loadPackageInScope(req, id);
      const pkg = await db.trackPackage.findFirst({
        where: { id },
        select: {
          id: true, number: true, direction: true, status: true, fromCity: true, toCity: true, carrierName: true, externalTracking: true,
          expectedAt: true, shippedAt: true, receivedAt: true, note: true,
          items: { select: { lensOrderId: true, checks: true, lensOrder: { select: { id: true, trackCode: true, trackStage: true, frameRef: true, description: true, frameProduct: { select: { name: true, brand: true } } } } } },
        },
      });
      const events = await db.trackEvent.findMany({ where: { packageId: id }, orderBy: { occurredAt: 'asc' }, select: { id: true, type: true, stage: true, actorType: true, actorName: true, message: true, occurredAt: true } });
      return { package: { ...pkg!, store: scope.tenantName }, events };
    }

    p.get('/packages/:id', async (req, reply) => {
      const { id } = req.params as { id: string };
      return reply.send(await packageDetail(req, id));
    });

    /** Scan d'un QR : le colis n'est renvoyé que s'il relève de ce compte. */
    p.get('/scan/:token', async (req, reply) => {
      const { token } = req.params as { token: string };
      const pkg = await prisma.trackPackage.findFirst({ where: { token, ...packageWhere(req) }, select: { id: true } });
      if (!pkg) throw notFound("Ce colis ne vous est pas destiné ou n'existe pas");
      return reply.send(await packageDetail(req, pkg.id));
    });

    p.post('/packages/:id/receive', { bodyLimit: 8 * 1024 * 1024 }, async (req, reply) => {
      const { id } = req.params as { id: string };
      const input = trackReceiveSchema.parse(req.body);
      if (await alreadyApplied(input.clientEventId)) return reply.send({ ok: true, duplicate: true });
      const { pkg, scope, db } = await loadPackageInScope(req, id);
      if (req.portal!.kind === 'SUPPLIER' && pkg.direction !== 'OUTBOUND') throw badRequest('Ce colis est un retour vers le magasin');
      await receivePackage(db, id, input, actorOf(req, scope));
      return reply.send({ ok: true });
    });

    /* --------- Transporteur --------- */
    p.post('/packages/:id/pickup', async (req, reply) => {
      const { id } = req.params as { id: string };
      const proof = trackProofSchema.parse(req.body ?? {});
      if (req.portal!.kind !== 'CARRIER') throw forbidden('Réservé aux transporteurs');
      if (await alreadyApplied(proof.clientEventId)) return reply.send({ ok: true, duplicate: true });
      const { scope, db } = await loadPackageInScope(req, id);
      await carrierPickup(db, id, proof, actorOf(req, scope));
      return reply.send({ ok: true });
    });

    p.post('/packages/:id/checkpoint', async (req, reply) => {
      const { id } = req.params as { id: string };
      const input = trackProofSchema.extend({ message: z.string().trim().min(2).max(200) }).parse(req.body);
      if (req.portal!.kind !== 'CARRIER') throw forbidden('Réservé aux transporteurs');
      if (await alreadyApplied(input.clientEventId)) return reply.send({ ok: true, duplicate: true });
      const { scope, db } = await loadPackageInScope(req, id);
      await carrierCheckpoint(db, id, input.message, input, actorOf(req, scope));
      return reply.send({ ok: true });
    });

    /** Le transporteur dépose le colis : au laboratoire (aller, réception confirmée ensuite par le labo) ou au magasin (retour). */
    p.post('/packages/:id/deliver', { bodyLimit: 8 * 1024 * 1024 }, async (req, reply) => {
      const { id } = req.params as { id: string };
      const proof = trackProofSchema.parse(req.body ?? {});
      if (req.portal!.kind !== 'CARRIER') throw forbidden('Réservé aux transporteurs');
      if (await alreadyApplied(proof.clientEventId)) return reply.send({ ok: true, duplicate: true });
      const { pkg, scope, db } = await loadPackageInScope(req, id);
      if (pkg.status !== 'IN_TRANSIT') throw badRequest("Confirmez d'abord la prise en charge");
      const actor = actorOf(req, scope);
      if (pkg.direction === 'RETURN') {
        await receivePackage(db, id, proof, actor);
      } else {
        const ev = await addEvent(db, { packageId: id, type: 'CARRIER_DELIVERED', actor, message: 'Déposé au laboratoire', meta: { gps: proof.gps ?? null }, clientEventId: proof.clientEventId, occurredAt: proof.occurredAt });
        if (proof.photo) await addAttachment(db, { packageId: id, eventId: ev.id, kind: 'PACKAGE_PHOTO', data: proof.photo, actor });
      }
      return reply.send({ ok: true });
    });

    /* --------- Laboratoire : traitement --------- */
    p.post('/orders/stage', { bodyLimit: 8 * 1024 * 1024 }, async (req, reply) => {
      const input = trackLabStageSchema.extend({ lensOrderIds: z.array(z.string().uuid()).min(1).max(50) }).parse(req.body);
      if (await alreadyApplied(input.clientEventId)) return reply.send({ ok: true, duplicate: true });
      if (!(LAB_SETTABLE_STAGES as readonly string[]).includes(input.stage)) throw badRequest('Étape non autorisée');
      // Toutes les commandes doivent relever du même magasin et de ce compte.
      const first = await loadOrderInScope(req, input.lensOrderIds[0]!);
      for (const oid of input.lensOrderIds.slice(1)) {
        const o = await loadOrderInScope(req, oid);
        if (o.order.tenantId !== first.order.tenantId) throw badRequest('Commandes de magasins différents');
      }
      const orders = await first.db.lensOrder.findMany({ where: { id: { in: input.lensOrderIds } }, select: { trackStage: true, trackCode: true } });
      const early = orders.find((o) => ['CREATED', 'FRAME_PREPARED', 'PACKED', 'HANDED_TO_CARRIER', 'IN_TRANSIT_TO_LAB'].includes(o.trackStage ?? ''));
      if (early) throw badRequest(`Confirmez d'abord la réception du colis de ${early.trackCode}`);
      const late = orders.find((o) => ['RETURN_HANDED', 'IN_TRANSIT_TO_STORE', 'ARRIVED_AT_STORE', 'RECEIPT_CONFIRMED', 'COMPLETED', 'CANCELLED'].includes(o.trackStage ?? ''));
      if (late) throw badRequest(`La commande ${late.trackCode} a déjà été renvoyée`);
      const actor = actorOf(req, first.scope);
      await setStage(first.db, input.lensOrderIds, input.stage, actor, { proof: input, message: input.note || undefined });
      if (input.photo) {
        for (const oid of input.lensOrderIds) await addAttachment(first.db, { lensOrderId: oid, kind: 'MOUNT_PROOF', data: input.photo, actor });
      }
      await notifyLabStage(first.db, input.lensOrderIds, input.stage);
      return reply.send({ ok: true });
    });

    p.post('/orders/:id/attachments', { bodyLimit: 8 * 1024 * 1024 }, async (req, reply) => {
      const { id } = req.params as { id: string };
      const input = trackAttachmentSchema.parse(req.body);
      const { scope, db } = await loadOrderInScope(req, id);
      const actor = actorOf(req, scope);
      const att = await addAttachment(db, { lensOrderId: id, kind: input.kind === 'MOUNT_PROOF' ? 'MOUNT_PROOF' : 'OTHER', name: input.name || null, data: input.data, actor });
      await addEvent(db, { lensOrderId: id, type: 'ATTACHMENT_ADDED', actor, message: input.name || null, meta: { kind: att.kind, attachmentId: att.id } });
      return reply.status(201).send({ attachment: att });
    });

    p.get('/attachments/:id', async (req, reply) => {
      const { id } = req.params as { id: string };
      const a = await prisma.trackAttachment.findUnique({ where: { id } });
      if (!a) throw notFound('Pièce jointe introuvable');
      // Accessible seulement si la commande ou le colis relève du compte.
      if (a.lensOrderId) await loadOrderInScope(req, a.lensOrderId);
      else if (a.packageId) await loadPackageInScope(req, a.packageId);
      else throw forbidden('Accès non autorisé');
      return reply.send({ attachment: a });
    });

    p.post('/anomalies', { bodyLimit: 8 * 1024 * 1024 }, async (req, reply) => {
      const input = trackAnomalySchema.parse(req.body);
      if (await alreadyApplied(input.clientEventId)) return reply.send({ ok: true, duplicate: true });
      let ctx;
      if (input.lensOrderId) ctx = await loadOrderInScope(req, input.lensOrderId);
      else if (input.packageId) ctx = await loadPackageInScope(req, input.packageId);
      else throw badRequest('Précisez la commande ou le colis concerné');
      await reportAnomaly(ctx.db, input, actorOf(req, ctx.scope));
      return reply.status(201).send({ ok: true });
    });

    /** « Expédier vers le magasin » : crée le colis retour et le remet au transporteur. */
    p.post('/returns', { bodyLimit: 8 * 1024 * 1024 }, async (req, reply) => {
      const input = trackReturnSchema.parse(req.body);
      if (await alreadyApplied(input.clientEventId)) return reply.send({ ok: true, duplicate: true });
      const first = await loadOrderInScope(req, input.lensOrderIds[0]!);
      for (const oid of input.lensOrderIds.slice(1)) {
        const o = await loadOrderInScope(req, oid);
        if (o.order.tenantId !== first.order.tenantId) throw badRequest('Un colis retour ne concerne qu’un seul magasin');
      }
      const pkg = await createReturn(first.db, first.order.tenantId, first.scope.supplierId!, input, actorOf(req, first.scope));
      return reply.status(201).send({ package: { id: pkg.id, number: pkg.number } });
    });
  });
}
