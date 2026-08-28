import type { FastifyInstance } from 'fastify';
import { customerCreateSchema, prescriptionCreateSchema, type Gender } from '@oculo/shared-types';
import { requireAuth } from '../../middlewares/auth-guard.js';
import { requirePermission } from '../../middlewares/rbac-guard.js';
import { notFound } from '../../lib/http-error.js';
import { getOpticalSettings, addMonths } from '../../lib/optical-settings.js';

function toDate(v?: string | null): Date | null {
  return v ? new Date(v) : null;
}
function clean<T extends Record<string, unknown>>(obj: T): T {
  const out = { ...obj };
  for (const k of Object.keys(out)) {
    if (out[k] === '') (out as Record<string, unknown>)[k] = null;
  }
  return out;
}

export async function customersRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  app.get('/', { preHandler: requirePermission('optique.customers.view') }, async (req, reply) => {
    const q = req.query as { search?: string };
    const where = q.search
      ? {
          OR: [
            { firstName: { contains: q.search, mode: 'insensitive' as const } },
            { lastName: { contains: q.search, mode: 'insensitive' as const } },
            { phone: { contains: q.search } },
          ],
        }
      : {};
    const customers = await req.db!.customer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return reply.send({ customers });
  });

  app.post('/', { preHandler: requirePermission('optique.customers.create') }, async (req, reply) => {
    const input = customerCreateSchema.parse(req.body);
    const customer = await req.db!.customer.create({
      data: {
        tenantId: req.auth!.tenantId,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        email: input.email || null,
        dateOfBirth: toDate(input.dateOfBirth),
        gender: input.gender || null,
        address: input.address || null,
        profession: input.profession || null,
        notes: input.notes || null,
      },
    });
    return reply.status(201).send({ customer });
  });

  app.patch('/:id', { preHandler: requirePermission('optique.customers.update') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const input = customerCreateSchema.partial().parse(req.body);
    // `clean` remplace les chaînes vides par null (champ effacé) ; la date de
    // naissance et le genre demandent une conversion explicite.
    const { dateOfBirth, gender, ...rest } = clean(input);
    const result = await req.db!.customer.updateMany({
      where: { id },
      data: {
        ...rest,
        ...(dateOfBirth === undefined ? {} : { dateOfBirth: toDate(dateOfBirth as string | null) }),
        ...(gender === undefined ? {} : { gender: (gender as Gender | null) || null }),
      },
    });
    if (result.count === 0) throw notFound('Client introuvable');
    const customer = await req.db!.customer.findFirst({ where: { id } });
    // Quand la fiche est liée à la clinique, les coordonnées communes restent
    // cohérentes sans toucher aux données médicales du patient.
    if (customer) {
      await req.db!.patient.updateMany({
        where: { customerId: customer.id },
        data: {
          firstName: customer.firstName,
          lastName: customer.lastName,
          gender: customer.gender,
          dateOfBirth: customer.dateOfBirth,
          phone: customer.phone,
          email: customer.email,
          address: customer.address,
        },
      });
    }
    return reply.send({ customer });
  });

  // Fiche client complète : ordonnances, achats (avec articles), commandes
  // de verres et réparations — tout ce qui est rattaché au client.
  app.get('/:id', { preHandler: requirePermission('optique.customers.view') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const customer = await req.db!.customer.findFirst({
      where: { id },
      include: {
        prescriptions: { orderBy: { date: 'desc' } },
        sales: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: {
            items: { include: { product: { select: { name: true, sku: true, category: true } } } },
            branch: { select: { name: true } },
          },
        },
        lensOrders: { orderBy: { createdAt: 'desc' }, take: 20 },
        repairs: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!customer) throw notFound('Client introuvable');
    return reply.send({ customer });
  });

  // Ordonnances optiques d'un client.
  app.get(
    '/:id/prescriptions',
    { preHandler: requirePermission('optique.prescriptions.view') },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const prescriptions = await req.db!.opticalPrescription.findMany({
        where: { customerId: id },
        orderBy: { date: 'desc' },
      });
      return reply.send({ prescriptions });
    },
  );

  app.post(
    '/:id/prescriptions',
    { preHandler: requirePermission('optique.prescriptions.create') },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const customer = await req.db!.customer.findFirst({ where: { id } });
      if (!customer) throw notFound('Client introuvable');
      const input = clean(prescriptionCreateSchema.parse(req.body));
      const { date, expiresAt, ...rest } = input;
      const issuedAt = toDate(date) ?? new Date();
      // Fin de validité : celle saisie, sinon calculée depuis les réglages.
      const settings = await getOpticalSettings(req.auth!.tenantId);
      const prescription = await req.db!.opticalPrescription.create({
        data: {
          tenantId: req.auth!.tenantId,
          customerId: id,
          date: issuedAt,
          expiresAt: toDate(expiresAt) ?? addMonths(issuedAt, settings.prescriptionValidityMonths),
          createdById: req.auth!.userId,
          ...rest,
        },
      });
      return reply.status(201).send({ prescription });
    },
  );

  app.patch(
    '/:id/prescriptions/:prescriptionId',
    { preHandler: requirePermission('optique.prescriptions.create') },
    async (req, reply) => {
      const { id, prescriptionId } = req.params as { id: string; prescriptionId: string };
      const existing = await req.db!.opticalPrescription.findFirst({
        where: { id: prescriptionId, customerId: id },
      });
      if (!existing) throw notFound('Ordonnance introuvable');
      const input = clean(prescriptionCreateSchema.partial().parse(req.body));
      const { date, expiresAt, ...rest } = input;
      const result = await req.db!.opticalPrescription.updateMany({
        where: { id: prescriptionId },
        data: {
          ...(date ? { date: new Date(date) } : {}),
          ...(expiresAt !== undefined ? { expiresAt: toDate(expiresAt) } : {}),
          ...rest,
        },
      });
      if (result.count === 0) throw notFound('Ordonnance introuvable');
      const prescription = await req.db!.opticalPrescription.findFirst({
        where: { id: prescriptionId },
      });
      return reply.send({ prescription });
    },
  );

  app.delete(
    '/:id/prescriptions/:prescriptionId',
    { preHandler: requirePermission('optique.prescriptions.create') },
    async (req, reply) => {
      const { id, prescriptionId } = req.params as { id: string; prescriptionId: string };
      const existing = await req.db!.opticalPrescription.findFirst({
        where: { id: prescriptionId, customerId: id },
      });
      if (!existing) throw notFound('Ordonnance introuvable');
      const result = await req.db!.opticalPrescription.deleteMany({ where: { id: prescriptionId } });
      if (result.count === 0) throw notFound('Ordonnance introuvable');
      return reply.send({ ok: true });
    },
  );
}
