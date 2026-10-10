import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  TRACK_STAGE_LOCATION,
  portalInviteSchema,
  trackAnomalyResolveSchema,
  trackAnomalySchema,
  trackAttachmentSchema,
  trackHandoverSchema,
  trackOrderUpdateSchema,
  trackPackageCreateSchema,
  trackReceiveSchema,
  trackStartSchema,
  trackStoreStageSchema,
  trackStageRank,
  type TrackStage,
} from '@oculo/shared-types';
import { requireAuth } from '../../middlewares/auth-guard.js';
import { requirePermission } from '../../middlewares/rbac-guard.js';
import { badRequest, conflict, notFound } from '../../lib/http-error.js';
import { prisma } from '../../lib/prisma.js';
import { appOrigin } from '../../config/env.js';
import { generateResetToken, hashRefreshToken } from '../../lib/tokens.js';
import {
  addAttachment,
  addEvent,
  confirmStoreReceipt,
  createOutboundPackage,
  detectLate,
  handover,
  lateDays,
  reportAnomaly,
  resolveAnomaly,
  setStage,
  startTracking,
  type Actor,
} from './track.service.js';

const VIEW = requirePermission('oculotrack.view');
const MANAGE = requirePermission('oculotrack.manage');
const PORTAL = requirePermission('oculotrack.portal');

async function staffActor(req: FastifyRequest): Promise<Actor> {
  const u = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { firstName: true, lastName: true } });
  return {
    type: 'STAFF',
    id: req.auth!.userId,
    name: u ? `${u.firstName} ${u.lastName}`.trim() : 'Magasin',
    ip: req.ip,
    userAgent: req.headers['user-agent'] ?? null,
  };
}

/** Champs d'une commande suivie, pour les listes (jamais la prescription). */
const ORDER_LIST = {
  id: true,
  number: true,
  trackCode: true,
  trackStage: true,
  trackStartedAt: true,
  description: true,
  frameRef: true,
  expectedAt: true,
  updatedAt: true,
  supplierId: true,
  supplierName: true,
  customer: { select: { id: true, firstName: true, lastName: true } },
  frameProduct: { select: { name: true, brand: true } },
  _count: { select: { trackAnomalies: { where: { status: 'OPEN' } } } },
} as const;

type ListedOrder = {
  expectedAt: Date | null;
  trackStage: string | null;
  _count: { trackAnomalies: number };
};
function withLate<T extends ListedOrder>(o: T) {
  const stage = (o.trackStage ?? 'CREATED') as TrackStage;
  const arrived = trackStageRank(stage) >= trackStageRank('ARRIVED_AT_STORE') || stage === 'CANCELLED';
  return { ...o, openAnomalies: o._count.trackAnomalies, lateDays: lateDays(o.expectedAt, arrived ? new Date() : null), location: TRACK_STAGE_LOCATION[stage] };
}

const PACKAGE_LIST = {
  id: true,
  number: true,
  direction: true,
  status: true,
  fromCity: true,
  toCity: true,
  carrierName: true,
  externalTracking: true,
  expectedAt: true,
  shippedAt: true,
  receivedAt: true,
  createdAt: true,
  supplier: { select: { id: true, name: true, city: true } },
  _count: { select: { items: true } },
} as const;

function searchOrderWhere(q?: string) {
  const s = q?.trim();
  if (!s) return {};
  return {
    OR: [
      { trackCode: { contains: s, mode: 'insensitive' as const } },
      { number: { contains: s, mode: 'insensitive' as const } },
      { frameRef: { contains: s, mode: 'insensitive' as const } },
      { supplierName: { contains: s, mode: 'insensitive' as const } },
      { customer: { OR: [{ firstName: { contains: s, mode: 'insensitive' as const } }, { lastName: { contains: s, mode: 'insensitive' as const } }] } },
      { packageItems: { some: { package: { OR: [{ number: { contains: s, mode: 'insensitive' as const } }, { externalTracking: { contains: s, mode: 'insensitive' as const } }] } } } },
    ],
  };
}

export async function oculotrackRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  /* ------------------------------ Tableau de bord ------------------------------ */
  app.get('/dashboard', { preHandler: VIEW }, async (req, reply) => {
    const db = req.db!;
    await detectLate(db);
    const now = new Date();
    const tracked = await db.lensOrder.findMany({
      where: { trackCode: { not: null }, trackStage: { notIn: ['COMPLETED', 'CANCELLED'] } },
      select: ORDER_LIST,
      orderBy: { updatedAt: 'desc' },
      take: 500,
    });
    const orders = tracked.map(withLate);
    const by = (stages: TrackStage[]) => orders.filter((o) => stages.includes(o.trackStage as TrackStage)).length;
    const activePkgs = await db.trackPackage.findMany({
      where: { status: { in: ['PREPARING', 'HANDED_TO_CARRIER', 'IN_TRANSIT'] } },
      select: PACKAGE_LIST,
      orderBy: { createdAt: 'desc' },
    });
    const latePackages = activePkgs.filter((p) => p.expectedAt && p.expectedAt < now && p.status !== 'PREPARING');
    const [openAnomalies, events] = await Promise.all([
      db.trackAnomaly.count({ where: { status: 'OPEN' } }),
      db.trackEvent.findMany({
        orderBy: { occurredAt: 'desc' },
        take: 12,
        select: { id: true, type: true, stage: true, actorType: true, actorName: true, message: true, occurredAt: true, lensOrder: { select: { id: true, trackCode: true } }, package: { select: { id: true, number: true } } },
      }),
    ]);
    // Flux : colis actifs regroupés par trajet (« Daloa → Abidjan »).
    const flows = new Map<string, { from: string; to: string; direction: string; count: number }>();
    for (const p of activePkgs) {
      if (p.status === 'PREPARING') continue;
      const from = p.fromCity || (p.direction === 'OUTBOUND' ? 'Magasin' : p.supplier?.name ?? 'Fournisseur');
      const to = p.toCity || (p.direction === 'OUTBOUND' ? p.supplier?.name ?? 'Fournisseur' : 'Magasin');
      const key = `${from}→${to}`;
      const f = flows.get(key) ?? { from, to, direction: p.direction, count: 0 };
      f.count += p._count.items;
      flows.set(key, f);
    }
    return reply.send({
      kpis: {
        inTransit: by(['HANDED_TO_CARRIER', 'IN_TRANSIT_TO_LAB', 'RETURN_HANDED', 'IN_TRANSIT_TO_STORE']),
        atSupplier: by(['RECEIVED_BY_LAB', 'REGISTERED_BY_LAB', 'MOUNT_PENDING', 'QUALITY_CHECK']),
        mounting: by(['MOUNTING', 'MOUNTED']),
        readyToReturn: by(['READY_FOR_RETURN']),
        inStore: by(['CREATED', 'FRAME_PREPARED', 'PACKED', 'ARRIVED_AT_STORE', 'RECEIPT_CONFIRMED']),
        late: new Set([...orders.filter((o) => o.lateDays > 0).map((o) => o.id)]).size + latePackages.length,
        anomalies: openAnomalies,
      },
      flows: [...flows.values()],
      latePackages: latePackages.map((p) => ({ ...p, lateDays: lateDays(p.expectedAt, null) })),
      lateOrders: orders.filter((o) => o.lateDays > 0).slice(0, 20),
      events,
    });
  });

  /* --------------------------------- Commandes -------------------------------- */
  app.get('/orders', { preHandler: VIEW }, async (req, reply) => {
    const q = req.query as { q?: string; stage?: string; supplierId?: string; done?: string };
    const where = {
      trackCode: { not: null },
      ...(q.stage ? { trackStage: q.stage } : q.done === '1' ? {} : { trackStage: { notIn: ['COMPLETED', 'CANCELLED'] } }),
      ...(q.supplierId ? { supplierId: q.supplierId } : {}),
      ...searchOrderWhere(q.q),
    };
    const orders = await req.db!.lensOrder.findMany({ where, select: ORDER_LIST, orderBy: { updatedAt: 'desc' }, take: 200 });
    return reply.send({ orders: orders.map(withLate) });
  });

  /** Commandes de verres pas encore suivies (pour « Activer le suivi »). */
  app.get('/orders/candidates', { preHandler: VIEW }, async (req, reply) => {
    const orders = await req.db!.lensOrder.findMany({
      where: { trackCode: null, status: { notIn: ['DELIVERED', 'CANCELLED'] } },
      select: { id: true, number: true, description: true, supplierName: true, supplierId: true, customerId: true, frameRef: true, expectedAt: true, createdAt: true, customer: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return reply.send({ orders });
  });

  app.get('/orders/:id', { preHandler: VIEW }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const db = req.db!;
    const order = await db.lensOrder.findFirst({
      where: { id },
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
        frameProduct: { select: { id: true, name: true, brand: true, photoUrl: true } },
        supplier: { select: { id: true, name: true, phone: true, whatsapp: true, city: true } },
        packageItems: { include: { package: { select: PACKAGE_LIST } }, orderBy: { package: { createdAt: 'asc' } } },
        trackAttachments: { select: { id: true, kind: true, name: true, mime: true, sizeBytes: true, uploadedByName: true, uploadedByType: true, createdAt: true }, orderBy: { createdAt: 'desc' } },
        trackAnomalies: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!order) throw notFound('Commande introuvable');
    const pkgIds = order.packageItems.map((i) => i.packageId);
    const events = await db.trackEvent.findMany({
      where: { OR: [{ lensOrderId: id }, { packageId: { in: pkgIds }, lensOrderId: null }] },
      orderBy: { occurredAt: 'asc' },
    });
    const measurement = order.measurementId
      ? await db.opticalMeasurement.findFirst({ where: { id: order.measurementId }, omit: { photoUrl: true, markers: true } })
      : null;
    const audit = await prisma.auditLog.findMany({
      where: { tenantId: req.auth!.tenantId, entity: 'LensOrder', entityId: id },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { firstName: true, lastName: true } } },
    });
    return reply.send({
      order: { ...order, cost: order.cost == null ? null : Number(order.cost), publicUrl: order.publicToken ? `${appOrigin}/track/${order.publicToken}` : null },
      events,
      measurement,
      audit: audit.map((a) => ({ id: a.id, action: a.action, metadata: a.metadata, createdAt: a.createdAt, userName: a.user ? `${a.user.firstName} ${a.user.lastName}` : null })),
    });
  });

  app.post('/orders/:id/start', { preHandler: MANAGE }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const input = trackStartSchema.parse(req.body);
    const code = await startTracking(req.db!, req.auth!.tenantId, id, input, await staffActor(req));
    return reply.status(201).send({ trackCode: code });
  });

  app.patch('/orders/:id', { preHandler: MANAGE }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const input = trackOrderUpdateSchema.parse(req.body);
    const db = req.db!;
    const o = await db.lensOrder.findFirst({ where: { id, trackCode: { not: null } }, select: { id: true } });
    if (!o) throw notFound('Commande introuvable');
    if (input.measurementId) {
      const m = await db.opticalMeasurement.findFirst({ where: { id: input.measurementId }, select: { id: true } });
      if (!m) throw notFound('Prise de mesures introuvable');
    }
    await db.lensOrder.updateMany({
      where: { id },
      data: {
        ...('frameRef' in input ? { frameRef: input.frameRef || null } : {}),
        ...('measurementId' in input ? { measurementId: input.measurementId || null } : {}),
        ...(input.expectedAt ? { expectedAt: new Date(input.expectedAt) } : {}),
      },
    });
    await addEvent(db, { lensOrderId: id, type: 'ORDER_UPDATED', actor: await staffActor(req), meta: { fields: Object.keys(input) } });
    return reply.send({ ok: true });
  });

  app.post('/orders/:id/stage', { preHandler: MANAGE }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { stage, note } = trackStoreStageSchema.parse(req.body);
    const db = req.db!;
    const o = await db.lensOrder.findFirst({ where: { id, trackCode: { not: null } }, select: { trackStage: true } });
    if (!o) throw notFound('Commande introuvable');
    const cur = (o.trackStage ?? 'CREATED') as TrackStage;
    if (stage === 'FRAME_PREPARED' && trackStageRank(cur) > trackStageRank('FRAME_PREPARED')) throw badRequest('La monture a déjà été expédiée');
    if (stage === 'COMPLETED' && trackStageRank(cur) < trackStageRank('ARRIVED_AT_STORE')) throw badRequest("La commande n'est pas encore revenue au magasin");
    if (cur === 'COMPLETED' || cur === 'CANCELLED') throw badRequest('Commande clôturée');
    await setStage(db, [id], stage, await staffActor(req), { message: note || undefined });
    return reply.send({ ok: true });
  });

  app.post('/orders/:id/attachments', { preHandler: MANAGE, bodyLimit: 6 * 1024 * 1024 }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const input = trackAttachmentSchema.parse(req.body);
    const db = req.db!;
    const o = await db.lensOrder.findFirst({ where: { id }, select: { id: true } });
    if (!o) throw notFound('Commande introuvable');
    const actor = await staffActor(req);
    const att = await addAttachment(db, { lensOrderId: id, kind: input.kind, name: input.name || null, data: input.data, actor });
    await addEvent(db, { lensOrderId: id, type: 'ATTACHMENT_ADDED', actor, message: input.name || null, meta: { kind: input.kind, attachmentId: att.id } });
    return reply.status(201).send({ attachment: att });
  });

  app.get('/attachments/:id', { preHandler: VIEW }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const a = await req.db!.trackAttachment.findFirst({ where: { id } });
    if (!a) throw notFound('Pièce jointe introuvable');
    return reply.send({ attachment: a });
  });

  /* ----------------------------------- Colis ---------------------------------- */
  app.get('/packages', { preHandler: VIEW }, async (req, reply) => {
    const q = req.query as { q?: string; status?: string };
    const s = q.q?.trim();
    const packages = await req.db!.trackPackage.findMany({
      where: {
        ...(q.status ? { status: q.status } : {}),
        ...(s
          ? {
              OR: [
                { number: { contains: s, mode: 'insensitive' } },
                { externalTracking: { contains: s, mode: 'insensitive' } },
                { carrierName: { contains: s, mode: 'insensitive' } },
                { supplier: { name: { contains: s, mode: 'insensitive' } } },
                { items: { some: { lensOrder: { trackCode: { contains: s, mode: 'insensitive' } } } } },
              ],
            }
          : {}),
      },
      select: PACKAGE_LIST,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return reply.send({ packages: packages.map((p) => ({ ...p, lateDays: lateDays(p.expectedAt, p.receivedAt ?? (p.status === 'PREPARING' ? new Date() : null)) })) });
  });

  app.get('/packages/:id', { preHandler: VIEW }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const db = req.db!;
    const pkg = await db.trackPackage.findFirst({
      where: { id },
      include: {
        supplier: { select: { id: true, name: true, phone: true, whatsapp: true, city: true } },
        items: { include: { lensOrder: { select: { id: true, number: true, trackCode: true, trackStage: true, frameRef: true, description: true, customer: { select: { firstName: true, lastName: true } } } } } },
        attachments: { select: { id: true, kind: true, name: true, mime: true, sizeBytes: true, uploadedByName: true, createdAt: true } },
        anomalies: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!pkg) throw notFound('Colis introuvable');
    const events = await db.trackEvent.findMany({ where: { packageId: id }, orderBy: { occurredAt: 'asc' } });
    return reply.send({
      package: { ...pkg, lateDays: lateDays(pkg.expectedAt, pkg.receivedAt ?? (pkg.status === 'PREPARING' ? new Date() : null)), scanUrl: `${appOrigin}/s/${pkg.token}` },
      events,
    });
  });

  app.post('/packages', { preHandler: MANAGE }, async (req, reply) => {
    const input = trackPackageCreateSchema.parse(req.body);
    const pkg = await createOutboundPackage(req.db!, req.auth!.tenantId, input, await staffActor(req));
    return reply.status(201).send({ package: { id: pkg.id, number: pkg.number } });
  });

  app.post('/packages/:id/handover', { preHandler: MANAGE, bodyLimit: 6 * 1024 * 1024 }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const input = trackHandoverSchema.parse(req.body);
    const db = req.db!;
    const pkg = await db.trackPackage.findFirst({ where: { id }, select: { direction: true } });
    if (!pkg) throw notFound('Colis introuvable');
    if (pkg.direction !== 'OUTBOUND') throw badRequest('Le retour est expédié par le fournisseur');
    await handover(db, id, input, await staffActor(req));
    return reply.send({ ok: true });
  });

  /** Réception par le magasin d'un colis retour (scan ou bouton). */
  app.post('/packages/:id/receive', { preHandler: MANAGE, bodyLimit: 6 * 1024 * 1024 }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const input = trackReceiveSchema.parse(req.body);
    await confirmStoreReceipt(req.db!, id, input, await staffActor(req));
    return reply.send({ ok: true });
  });

  /** Un colis en préparation peut être annulé : ses commandes reviennent à « Monture préparée ». */
  app.post('/packages/:id/cancel', { preHandler: MANAGE }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const db = req.db!;
    const pkg = await db.trackPackage.findFirst({ where: { id }, include: { items: { select: { lensOrderId: true } } } });
    if (!pkg) throw notFound('Colis introuvable');
    if (pkg.status !== 'PREPARING') throw badRequest('Seul un colis en préparation peut être annulé');
    const actor = await staffActor(req);
    await db.trackPackage.updateMany({ where: { id }, data: { status: 'CANCELLED' } });
    await addEvent(db, { packageId: id, type: 'PACKAGE_CANCELLED', stage: 'CANCELLED', actor });
    await setStage(db, pkg.items.map((i) => i.lensOrderId), 'FRAME_PREPARED', actor, { packageId: id, message: `Colis ${pkg.number} annulé` });
    return reply.send({ ok: true });
  });

  /** Scan d'un QR par le magasin : retrouve le colis de l'établissement. */
  app.get('/resolve/:token', { preHandler: VIEW }, async (req, reply) => {
    const { token } = req.params as { token: string };
    const pkg = await req.db!.trackPackage.findFirst({ where: { token }, select: { id: true } });
    if (!pkg) throw notFound("Ce colis n'appartient pas à votre établissement");
    return reply.send({ packageId: pkg.id });
  });

  /* --------------------------------- Anomalies -------------------------------- */
  app.get('/anomalies', { preHandler: VIEW }, async (req, reply) => {
    const q = req.query as { status?: string };
    const anomalies = await req.db!.trackAnomaly.findMany({
      where: q.status ? { status: q.status } : {},
      include: { lensOrder: { select: { id: true, trackCode: true } }, package: { select: { id: true, number: true } }, attachments: { select: { id: true, kind: true, mime: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return reply.send({ anomalies });
  });

  app.post('/anomalies', { preHandler: MANAGE, bodyLimit: 6 * 1024 * 1024 }, async (req, reply) => {
    const input = trackAnomalySchema.parse(req.body);
    if (!input.lensOrderId && !input.packageId) throw badRequest('Précisez la commande ou le colis concerné');
    const db = req.db!;
    if (input.lensOrderId && !(await db.lensOrder.findFirst({ where: { id: input.lensOrderId }, select: { id: true } }))) throw notFound('Commande introuvable');
    if (input.packageId && !(await db.trackPackage.findFirst({ where: { id: input.packageId }, select: { id: true } }))) throw notFound('Colis introuvable');
    const a = await reportAnomaly(db, input, await staffActor(req));
    return reply.status(201).send({ anomaly: a });
  });

  app.post('/anomalies/:id/resolve', { preHandler: MANAGE }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { resolution } = trackAnomalyResolveSchema.parse(req.body ?? {});
    await resolveAnomaly(req.db!, id, resolution || null, await staffActor(req));
    return reply.send({ ok: true });
  });

  /* ------------------------------- Notifications ------------------------------ */
  app.get('/notifications', async (req, reply) => {
    const db = req.db!;
    const [notifications, unread] = await Promise.all([
      db.tenantNotification.findMany({ orderBy: { createdAt: 'desc' }, take: 40 }),
      db.tenantNotification.count({ where: { readAt: null } }),
    ]);
    return reply.send({ notifications, unread });
  });

  app.post('/notifications/read', async (req, reply) => {
    const { ids } = (req.body ?? {}) as { ids?: string[] };
    await req.db!.tenantNotification.updateMany({ where: { readAt: null, ...(ids?.length ? { id: { in: ids } } : {}) }, data: { readAt: new Date() } });
    return reply.send({ ok: true });
  });

  /* ------------------------------ Accès au portail ----------------------------- */
  app.get('/portal-accesses', { preHandler: PORTAL }, async (req, reply) => {
    const accesses = await req.db!.portalAccess.findMany({
      where: { revokedAt: null },
      include: { account: { select: { id: true, name: true, email: true, phone: true, kind: true, lastLoginAt: true, passwordHash: true } }, supplier: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return reply.send({
      accesses: accesses.map(({ account: { passwordHash, ...acc }, ...a }) => ({ ...a, account: { ...acc, activated: Boolean(passwordHash) } })),
    });
  });

  /**
   * Invite un fournisseur ou un transporteur. Le compte est global (un
   * laboratoire peut travailler pour plusieurs magasins) ; l'accès à CE
   * magasin est cloisonné par PortalAccess. Renvoie le lien d'activation à
   * transmettre (WhatsApp) tant que le compte n'a pas de mot de passe.
   */
  app.post('/portal-invite', { preHandler: PORTAL }, async (req, reply) => {
    const input = portalInviteSchema.parse(req.body);
    const db = req.db!;
    if (input.kind === 'SUPPLIER') {
      if (!input.supplierId) throw badRequest('Choisissez le fournisseur que ce compte représente');
      const s = await db.supplier.findFirst({ where: { id: input.supplierId }, select: { id: true } });
      if (!s) throw notFound('Fournisseur introuvable');
    }
    let account = await prisma.portalAccount.findUnique({ where: { email: input.email } });
    if (account && account.kind !== input.kind) throw conflict(`Cette adresse est déjà un compte ${account.kind === 'SUPPLIER' ? 'fournisseur' : 'transporteur'}`);
    let inviteUrl: string | null = null;
    if (!account || !account.passwordHash) {
      const token = generateResetToken();
      const data = { inviteTokenHash: hashRefreshToken(token), inviteExpiresAt: new Date(Date.now() + 14 * 86_400_000) };
      account = account
        ? await prisma.portalAccount.update({ where: { id: account.id }, data })
        : await prisma.portalAccount.create({ data: { email: input.email, name: input.name, phone: input.phone || null, kind: input.kind, ...data } });
      inviteUrl = `${appOrigin}/portail/invitation/${token}`;
    }
    const supplierId = input.kind === 'SUPPLIER' ? input.supplierId! : null;
    const existing = await db.portalAccess.findFirst({ where: { accountId: account.id, supplierId } });
    const access = existing
      ? await db.portalAccess.update({ where: { id: existing.id }, data: { revokedAt: null } })
      : await db.portalAccess.create({ data: { accountId: account.id, supplierId, createdById: req.auth!.userId } as never });
    return reply.status(201).send({ access: { id: access.id }, inviteUrl, accountActivated: Boolean(account.passwordHash) });
  });

  app.post('/portal-accesses/:id/revoke', { preHandler: PORTAL }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const res = await req.db!.portalAccess.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: new Date() } });
    if (res.count === 0) throw notFound('Accès introuvable');
    return reply.send({ ok: true });
  });

  /** Confie un colis à un compte transporteur (il le verra dans son portail). */
  app.post('/packages/:id/carrier', { preHandler: MANAGE }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { accessId } = (req.body ?? {}) as { accessId?: string | null };
    const db = req.db!;
    if (accessId) {
      const acc = await db.portalAccess.findFirst({ where: { id: accessId, revokedAt: null, account: { kind: 'CARRIER' } }, include: { account: { select: { name: true } } } });
      if (!acc) throw notFound('Transporteur introuvable');
      await db.trackPackage.updateMany({ where: { id }, data: { carrierAccessId: accessId, carrierName: acc.account.name } });
    } else {
      await db.trackPackage.updateMany({ where: { id }, data: { carrierAccessId: null } });
    }
    await addEvent(db, { packageId: id, type: 'CARRIER_ASSIGNED', actor: await staffActor(req), meta: { accessId: accessId ?? null } });
    return reply.send({ ok: true });
  });
}
