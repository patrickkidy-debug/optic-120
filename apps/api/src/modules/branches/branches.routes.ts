import type { FastifyInstance } from 'fastify';
import { branchCreateSchema } from '@oculo/shared-types';
import { requireAuth } from '../../middlewares/auth-guard.js';
import { requirePermission } from '../../middlewares/rbac-guard.js';
import { notFound } from '../../lib/http-error.js';

export async function branchesRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  // Liste : un utilisateur non-allBranches ne voit que ses succursales.
  app.get('/', async (req, reply) => {
    const where = req.auth!.allBranches ? {} : { id: { in: req.auth!.branchIds } };
    const branches = await req.db!.branch.findMany({ where, orderBy: { createdAt: 'asc' } });
    return reply.send({ branches });
  });

  app.post('/', { preHandler: requirePermission('settings.branches.create') }, async (req, reply) => {
    const input = branchCreateSchema.parse(req.body);
    const branch = await req.db!.branch.create({
      data: { tenantId: req.auth!.tenantId, name: input.name, city: input.city ?? '' },
    });
    return reply.status(201).send({ branch });
  });

  app.patch('/:id', { preHandler: requirePermission('settings.branches.update') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const input = branchCreateSchema.partial().parse(req.body);
    const result = await req.db!.branch.updateMany({ where: { id }, data: input });
    if (result.count === 0) throw notFound('Succursale introuvable');
    const branch = await req.db!.branch.findFirst({ where: { id } });
    return reply.send({ branch });
  });
}
