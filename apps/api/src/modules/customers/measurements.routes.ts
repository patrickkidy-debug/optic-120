import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { measurementCreateSchema, measurementUpdateSchema, type MeasurementUpdateInput } from '@oculo/shared-types';
import { requireAuth } from '../../middlewares/auth-guard.js';
import { requirePermission } from '../../middlewares/rbac-guard.js';
import { badRequest, notFound } from '../../lib/http-error.js';
import { recordAudit, requestMeta } from '../../lib/audit.js';

const CUSTOMER = { select: { id: true, firstName: true, lastName: true, phone: true } } as const;

/** Champs numériques d'une mesure, arrondis au dixième à l'enregistrement. */
const NUMERIC = [
  'pdTotal', 'odMonoPd', 'ogMonoPd', 'odHeight', 'ogHeight', 'nearPd',
  'lensWidth', 'lensHeight', 'bridge', 'vertex', 'pantoTilt', 'wrapAngle', 'frameWidth', 'ed',
] as const;

const r1 = (v: number | null | undefined) => (v == null ? null : Math.round(v * 10) / 10);

/** Données Prisma à partir d'une saisie (création ou mise à jour partielle). */
function toData(input: MeasurementUpdateInput, partial: boolean) {
  const data: Record<string, unknown> = {};
  for (const k of NUMERIC) {
    if (!partial || k in input) data[k] = r1(input[k]);
  }
  const text = (k: 'frameLabel' | 'frameProductId' | 'notes') => {
    if (!partial || k in input) data[k] = input[k] || null;
  };
  text('frameLabel');
  text('frameProductId');
  text('notes');
  if (!partial || 'method' in input) data.method = input.method ?? 'MANUAL';
  if (!partial || 'confidence' in input) data.confidence = input.confidence ?? null;
  if (!partial || 'calibration' in input) data.calibration = input.calibration ?? null;
  if (!partial || 'photoUrl' in input) data.photoUrl = input.photoUrl ?? null;
  if (!partial || 'markers' in input) data.markers = input.markers ? (input.markers as Prisma.InputJsonValue) : Prisma.DbNull;
  if (!partial || 'autoValues' in input) data.autoValues = input.autoValues ? (input.autoValues as Prisma.InputJsonValue) : Prisma.DbNull;
  return data;
}

/**
 * Mesures de centrage (écarts pupillaires, hauteurs, cotes de monture…).
 * Prises au magasin par photo calibrée ou saisies, rattachées au client si
 * connu. Mêmes droits que les ordonnances : ce sont des données de santé.
 */
export async function measurementsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  // Liste légère : la photo (lourde) n'est renvoyée que par la fiche détaillée.
  app.get('/', { preHandler: requirePermission('optique.prescriptions.view') }, async (req, reply) => {
    const q = req.query as { customerId?: string };
    const where = q.customerId ? { customerId: q.customerId } : {};
    const [measurements, withPhoto] = await Promise.all([
      req.db!.opticalMeasurement.findMany({
        where,
        orderBy: { takenAt: 'desc' },
        take: q.customerId ? 50 : 100,
        omit: { photoUrl: true, markers: true },
        include: { customer: CUSTOMER },
      }),
      req.db!.opticalMeasurement.findMany({ where: { ...where, photoUrl: { not: null } }, select: { id: true }, take: 500 }),
    ]);
    const photos = new Set(withPhoto.map((m) => m.id));
    return reply.send({ measurements: measurements.map((m) => ({ ...m, hasPhoto: photos.has(m.id) })) });
  });

  app.get('/:id', { preHandler: requirePermission('optique.prescriptions.view') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const measurement = await req.db!.opticalMeasurement.findFirst({ where: { id }, include: { customer: CUSTOMER } });
    if (!measurement) throw notFound('Mesure introuvable');
    return reply.send({ measurement });
  });

  app.post('/', { preHandler: requirePermission('optique.prescriptions.create') }, async (req, reply) => {
    const input = measurementCreateSchema.parse(req.body);
    const customerId = input.customerId || null;
    if (customerId) {
      const c = await req.db!.customer.findFirst({ where: { id: customerId }, select: { id: true } });
      if (!c) throw notFound('Client introuvable');
    }
    if (NUMERIC.every((k) => input[k] == null)) throw badRequest('Aucune mesure à enregistrer');
    const measurement = await req.db!.opticalMeasurement.create({
      data: {
        ...(toData(input, false) as object),
        tenantId: req.auth!.tenantId,
        customerId,
        createdById: req.auth!.userId,
      } as Prisma.OpticalMeasurementUncheckedCreateInput,
      omit: { photoUrl: true, markers: true },
      include: { customer: CUSTOMER },
    });
    await recordAudit({
      tenantId: req.auth!.tenantId,
      userId: req.auth!.userId,
      action: 'MEASUREMENT_CREATED',
      entity: 'OpticalMeasurement',
      entityId: measurement.id,
      metadata: { customerId, method: input.method, confidence: input.confidence ?? null },
      ...requestMeta(req),
    });
    return reply.status(201).send({ measurement });
  });

  // Correction d'une mesure existante (repères déplacés, paramètres saisis).
  app.patch('/:id', { preHandler: requirePermission('optique.prescriptions.create') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const input = measurementUpdateSchema.parse(req.body);
    const res = await req.db!.opticalMeasurement.updateMany({ where: { id }, data: toData(input, true) });
    if (res.count === 0) throw notFound('Mesure introuvable');
    const measurement = await req.db!.opticalMeasurement.findFirst({
      where: { id },
      omit: { photoUrl: true, markers: true },
      include: { customer: CUSTOMER },
    });
    await recordAudit({
      tenantId: req.auth!.tenantId,
      userId: req.auth!.userId,
      action: 'MEASUREMENT_UPDATED',
      entity: 'OpticalMeasurement',
      entityId: id,
      ...requestMeta(req),
    });
    return reply.send({ measurement });
  });

  app.delete('/:id', { preHandler: requirePermission('optique.prescriptions.create') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const res = await req.db!.opticalMeasurement.deleteMany({ where: { id } });
    if (res.count === 0) throw notFound('Mesure introuvable');
    return reply.send({ ok: true });
  });
}
