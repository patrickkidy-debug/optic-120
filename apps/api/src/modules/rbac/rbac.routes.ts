import type { FastifyInstance } from 'fastify';
import { roleCreateSchema, roleUpdateSchema, PERMISSIONS } from '@oculo/shared-types';
import { requireAuth } from '../../middlewares/auth-guard.js';
import { requirePermission, requirePlanFeature } from '../../middlewares/rbac-guard.js';
import { recordAudit, requestMeta } from '../../lib/audit.js';
import * as rbac from './rbac.service.js';

export async function rbacRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);
  app.addHook('preHandler', requirePlanFeature('rolesPermissions'));

  // Catalogue des permissions (groupé par module pour l'UI).
  app.get('/permissions', { preHandler: requirePermission('rbac.roles.view') }, async (_req, reply) => {
    const grouped: Record<string, { key: string; action: string; label: string }[]> = {};
    for (const p of PERMISSIONS) {
      (grouped[p.module] ??= []).push({
        key: `${p.module}.${p.action}`,
        action: p.action,
        label: p.label,
      });
    }
    return reply.send({ permissions: PERMISSIONS, grouped });
  });

  app.get('/roles', { preHandler: requirePermission('rbac.roles.view') }, async (req, reply) => {
    const roles = await rbac.listRoles(req.auth!.tenantId);
    return reply.send({ roles });
  });

  app.post('/roles', { preHandler: requirePermission('rbac.roles.create') }, async (req, reply) => {
    const input = roleCreateSchema.parse(req.body);
    const role = await rbac.createRole(req.auth!.tenantId, input.name, input.permissions);
    await recordAudit({
      tenantId: req.auth!.tenantId,
      userId: req.auth!.userId,
      action: 'ROLE_CREATED',
      entity: 'Role',
      entityId: role.id,
      ...requestMeta(req),
    });
    return reply.status(201).send({ role });
  });

  app.patch('/roles/:id', { preHandler: requirePermission('rbac.roles.update') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const input = roleUpdateSchema.parse(req.body);
    const role = await rbac.updateRole(req.auth!.tenantId, id, input);
    return reply.send({ role });
  });

  app.delete('/roles/:id', { preHandler: requirePermission('rbac.roles.delete') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await rbac.deleteRole(req.auth!.tenantId, id);
    return reply.send({ ok: true });
  });
}
