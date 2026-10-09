import type { FastifyInstance } from 'fastify';
import { measurementCreateSchema } from '@oculo/shared-types';
import { requireAuth } from '../../middlewares/auth-guard.js';
import { requirePermission } from '../../middlewares/rbac-guard.js';
import { badRequest, notFound } from '../../lib/http-error.js';
import { recordAudit, requestMeta } from '../../lib/audit.js';

/**
 * Mesures de centrage (écarts pupillaires, hauteurs, cotes de monture…).
 * Prises au magasin par photo calibrée ou saisies, rattachées au client si
 * connu. Mêmes droits que les ordonnances : ce sont des données de santé.
 */
export async function measurementsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  app.get('/', { preHandler: requirePermission('optique.prescriptions.view') }, async (req, reply) => {
    const q = req.query as { customerId?: string };
    const measurements = await req.db!.opticalMeasurement.findMany({
      where: q.customerId ? { customerId: q.customerId } : {},
      orderBy: { takenAt: 'desc' },
      take: q.customerId ? 50 : 100,
      include: { customer: { select: { id: true, firstName: true, lastName: true, phone: true } } },
    });
    return reply.send({ measurements });
  });

  app.post('/', { preHandler: requirePermission('optique.prescriptions.create') }, async (req, reply) => {
    const input = measurementCreateSchema.parse(req.body);
    const customerId = input.customerId || null;
    if (customerId) {
      const c = await req.db!.customer.findFirst({ where: { id: customerId }, select: { id: true } });
      if (!c) throw notFound('Client introuvable');
    }
    const values = [
      input.pdTotal, input.odMonoPd, input.ogMonoPd, input.odHeight, input.ogHeight, input.nearPd,
      input.lensWidth, input.lensHeight, input.bridge, input.vertex, input.pantoTilt, input.wrapAngle,
    ];
    if (values.every((v) => v == null)) throw badRequest('Aucune mesure à enregistrer');
    const r1 = (v: number | null | undefined) => (v == null ? null : Math.round(v * 10) / 10);
    const measurement = await req.db!.opticalMeasurement.create({
      data: {
        tenantId: req.auth!.tenantId,
        customerId,
        method: input.method,
        pdTotal: r1(input.pdTotal),
        odMonoPd: r1(input.odMonoPd),
        ogMonoPd: r1(input.ogMonoPd),
        odHeight: r1(input.odHeight),
        ogHeight: r1(input.ogHeight),
        nearPd: r1(input.nearPd),
        lensWidth: r1(input.lensWidth),
        lensHeight: r1(input.lensHeight),
        bridge: r1(input.bridge),
        vertex: r1(input.vertex),
        pantoTilt: r1(input.pantoTilt),
        wrapAngle: r1(input.wrapAngle),
        frameLabel: input.frameLabel || null,
        frameProductId: input.frameProductId || null,
        notes: input.notes || null,
        createdById: req.auth!.userId,
      },
      include: { customer: { select: { id: true, firstName: true, lastName: true, phone: true } } },
    });
    await recordAudit({
      tenantId: req.auth!.tenantId,
      userId: req.auth!.userId,
      action: 'MEASUREMENT_CREATED',
      entity: 'OpticalMeasurement',
      entityId: measurement.id,
      metadata: { customerId, method: input.method },
      ...requestMeta(req),
    });
    return reply.status(201).send({ measurement });
  });

  app.delete('/:id', { preHandler: requirePermission('optique.prescriptions.create') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const res = await req.db!.opticalMeasurement.deleteMany({ where: { id } });
    if (res.count === 0) throw notFound('Mesure introuvable');
    return reply.send({ ok: true });
  });
}
