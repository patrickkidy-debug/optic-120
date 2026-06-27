import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../../middlewares/auth-guard.js';
import { requirePermission } from '../../middlewares/rbac-guard.js';

export async function auditRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  app.get('/logs', { preHandler: requirePermission('audit.logs.view') }, async (req, reply) => {
    const q = req.query as { page?: string };
    const page = Math.max(1, parseInt(q.page ?? '1', 10));
    const pageSize = 50;
    const [items, total] = await Promise.all([
      req.db!.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { user: { select: { firstName: true, lastName: true, email: true } } },
      }),
      req.db!.auditLog.count({}),
    ]);
    return reply.send({ items, total, page, pageSize });
  });
}
