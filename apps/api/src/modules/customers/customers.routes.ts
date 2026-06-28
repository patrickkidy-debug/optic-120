import type { FastifyInstance } from 'fastify';
import { customerCreateSchema, prescriptionCreateSchema } from '@oculo/shared-types';
import { requireAuth } from '../../middlewares/auth-guard.js';
import { requirePermission } from '../../middlewares/rbac-guard.js';
import { notFound } from '../../lib/http-error.js';

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
      },
    });
    return reply.status(201).send({ customer });
  });

  app.patch('/:id', { preHandler: requirePermission('optique.customers.update') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const input = customerCreateSchema.partial().parse(req.body);
    const result = await req.db!.customer.updateMany({ where: { id }, data: input });
    if (result.count === 0) throw notFound('Client introuvable');
    const customer = await req.db!.customer.findFirst({ where: { id } });
    return reply.send({ customer });
  });

  // Fiche client + historique des ventes et ordonnances.
  app.get('/:id', { preHandler: requirePermission('optique.customers.view') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const customer = await req.db!.customer.findFirst({
      where: { id },
      include: {
        prescriptions: { orderBy: { date: 'desc' } },
        sales: { orderBy: { createdAt: 'desc' }, take: 20 },
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
      const { date, ...rest } = input;
      const prescription = await req.db!.opticalPrescription.create({
        data: {
          tenantId: req.auth!.tenantId,
          customerId: id,
          date: toDate(date) ?? new Date(),
          createdById: req.auth!.userId,
          ...rest,
        },
      });
      return reply.status(201).send({ prescription });
    },
  );
}
