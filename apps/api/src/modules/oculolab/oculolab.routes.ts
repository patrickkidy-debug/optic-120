import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { frameTraceInputSchema, frameTraceUpdateSchema, shapeStats, type FrameTraceUpdate } from '@oculo/shared-types';
import { requireAuth } from '../../middlewares/auth-guard.js';
import { requirePermission } from '../../middlewares/rbac-guard.js';
import { notFound } from '../../lib/http-error.js';
import { recordAudit, requestMeta } from '../../lib/audit.js';
import { prisma } from '../../lib/prisma.js';
import { nextCounterNumber } from '../../lib/document-number.js';

const CUSTOMER = { select: { id: true, firstName: true, lastName: true, phone: true } } as const;
const SUPPLIER = { select: { id: true, name: true, phone: true, whatsapp: true, email: true } } as const;

/**
 * Vérifie que chaque lien (client, fournisseur, commande, mesure, ordonnance)
 * appartient bien à l'établissement : req.db filtre par tenant, un
 * identifiant étranger est donc simplement introuvable.
 */
async function assertLinks(db: NonNullable<import('fastify').FastifyRequest['db']>, input: FrameTraceUpdate) {
  const checks: [unknown, () => Promise<unknown>, string][] = [
    [input.customerId, () => db.customer.findFirst({ where: { id: input.customerId! }, select: { id: true } }), 'Client introuvable'],
    [input.supplierId, () => db.supplier.findFirst({ where: { id: input.supplierId! }, select: { id: true } }), 'Fournisseur introuvable'],
    [input.lensOrderId, () => db.lensOrder.findFirst({ where: { id: input.lensOrderId! }, select: { id: true } }), 'Commande introuvable'],
    [input.measurementId, () => db.opticalMeasurement.findFirst({ where: { id: input.measurementId! }, select: { id: true } }), 'Mesure introuvable'],
    [input.prescriptionId, () => db.opticalPrescription.findFirst({ where: { id: input.prescriptionId! }, select: { id: true } }), 'Ordonnance introuvable'],
  ];
  for (const [value, find, message] of checks) {
    if (value && !(await find())) throw notFound(message);
  }
}

/** Champs Prisma depuis une saisie ; les cotes sont TOUJOURS recalculées depuis le tracé. */
function toData(input: FrameTraceUpdate) {
  const data: Record<string, unknown> = {};
  const copy = [
    'customerId', 'supplierId', 'lensOrderId', 'measurementId', 'prescriptionId',
    'source', 'frameType', 'frameRef', 'dbl', 'confidence', 'photoUrl',
  ] as const;
  for (const k of copy) if (k in input) data[k] = input[k] ?? null;
  if ('label' in input) data.label = input.label || null;
  if (input.radii) {
    const st = shapeStats(input.radii);
    Object.assign(data, { radii: input.radii, boxA: st.a, boxB: st.b, ed: st.ed, circumference: st.circumference });
  }
  if (input.precal) data.precal = input.precal as Prisma.InputJsonValue;
  if (input.status) {
    data.status = input.status;
    if (input.status === 'SENT') data.sentAt = new Date();
  }
  return data;
}

/**
 * OculoLab : tracés de forme de monture et fiches précal pour le laboratoire.
 * Mêmes droits que les mesures de centrage (données de santé du client).
 */
export async function oculolabRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  // Liste légère : ni photo ni tracé complet (une vignette suffit côté client).
  app.get('/traces', { preHandler: requirePermission('optique.prescriptions.view') }, async (req, reply) => {
    const q = req.query as { customerId?: string };
    const traces = await req.db!.frameTrace.findMany({
      where: q.customerId ? { customerId: q.customerId } : {},
      orderBy: { createdAt: 'desc' },
      take: 200,
      omit: { photoUrl: true },
      include: { customer: CUSTOMER, supplier: SUPPLIER },
    });
    return reply.send({ traces });
  });

  app.get('/traces/:id', { preHandler: requirePermission('optique.prescriptions.view') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const trace = await req.db!.frameTrace.findFirst({ where: { id }, include: { customer: CUSTOMER, supplier: SUPPLIER } });
    if (!trace) throw notFound('Fiche introuvable');
    return reply.send({ trace });
  });

  app.post('/traces', { preHandler: requirePermission('optique.prescriptions.create') }, async (req, reply) => {
    const input = frameTraceInputSchema.parse(req.body);
    await assertLinks(req.db!, input);
    const tenantId = req.auth!.tenantId;
    const year = new Date().getFullYear();
    // Compteur hors transaction (voir document-number.ts) : jamais deux fois le même numéro.
    const number = await nextCounterNumber(prisma, tenantId, 'PCL', year, async () =>
      (await req.db!.frameTrace.findMany({ select: { number: true } })).map((t) => t.number),
    );
    const trace = await req.db!.frameTrace.create({
      data: {
        ...(toData(input) as object),
        tenantId,
        number,
        createdById: req.auth!.userId,
      } as Prisma.FrameTraceUncheckedCreateInput,
      omit: { photoUrl: true },
      include: { customer: CUSTOMER, supplier: SUPPLIER },
    });
    await recordAudit({
      tenantId,
      userId: req.auth!.userId,
      action: 'PRECAL_CREATED',
      entity: 'FrameTrace',
      entityId: trace.id,
      metadata: { number, source: input.source, customerId: input.customerId ?? null },
      ...requestMeta(req),
    });
    return reply.status(201).send({ trace });
  });

  app.patch('/traces/:id', { preHandler: requirePermission('optique.prescriptions.create') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const input = frameTraceUpdateSchema.parse(req.body);
    await assertLinks(req.db!, input);
    const res = await req.db!.frameTrace.updateMany({ where: { id }, data: toData(input) });
    if (res.count === 0) throw notFound('Fiche introuvable');
    const trace = await req.db!.frameTrace.findFirst({ where: { id }, omit: { photoUrl: true }, include: { customer: CUSTOMER, supplier: SUPPLIER } });
    if (input.status === 'SENT') {
      await recordAudit({
        tenantId: req.auth!.tenantId,
        userId: req.auth!.userId,
        action: 'PRECAL_SENT',
        entity: 'FrameTrace',
        entityId: id,
        metadata: { supplierId: trace?.supplierId ?? null },
        ...requestMeta(req),
      });
    }
    return reply.send({ trace });
  });

  app.delete('/traces/:id', { preHandler: requirePermission('optique.prescriptions.create') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const res = await req.db!.frameTrace.deleteMany({ where: { id } });
    if (res.count === 0) throw notFound('Fiche introuvable');
    return reply.send({ ok: true });
  });
}
