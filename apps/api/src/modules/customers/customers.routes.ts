import type { FastifyInstance } from 'fastify';
import { customerCreateSchema } from '@oculo/shared-types';
import { requireAuth } from '../../middlewares/auth-guard.js';
import { requirePermission } from '../../middlewares/rbac-guard.js';
import { notFound } from '../../lib/http-error.js';

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
}
