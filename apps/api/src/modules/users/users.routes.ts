import type { FastifyInstance } from 'fastify';
import { userCreateSchema } from '@oculo/shared-types';
import { requireAuth } from '../../middlewares/auth-guard.js';
import { requirePermission } from '../../middlewares/rbac-guard.js';
import { recordAudit, requestMeta } from '../../lib/audit.js';
import * as usersService from './users.service.js';

export async function usersRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  app.get('/', { preHandler: requirePermission('rbac.users.view') }, async (req, reply) => {
    const users = await usersService.listUsers(req.auth!.tenantId);
    return reply.send({ users });
  });

  app.post('/', { preHandler: requirePermission('rbac.users.create') }, async (req, reply) => {
    const input = userCreateSchema.parse(req.body);
    const result = await usersService.createUser(req.auth!.tenantId, input);
    await recordAudit({
      tenantId: req.auth!.tenantId,
      userId: req.auth!.userId,
      action: 'USER_CREATED',
      entity: 'User',
      entityId: result.id,
      ...requestMeta(req),
    });
    return reply.status(201).send({ user: result });
  });

  app.patch('/:id', { preHandler: requirePermission('rbac.users.update') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const input = userCreateSchema.partial().parse(req.body);
    const result = await usersService.updateUser(req.auth!.tenantId, id, input);
    return reply.send({ user: result });
  });

  app.post('/:id/deactivate', { preHandler: requirePermission('rbac.users.deactivate') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await usersService.deactivateUser(req.auth!.tenantId, id, req.auth!.userId);
    await recordAudit({
      tenantId: req.auth!.tenantId,
      userId: req.auth!.userId,
      action: 'USER_DEACTIVATED',
      entity: 'User',
      entityId: id,
      ...requestMeta(req),
    });
    return reply.send({ ok: true });
  });
}
