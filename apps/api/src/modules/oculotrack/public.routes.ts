import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { notFound } from '../../lib/http-error.js';

/**
 * Suivi public (lien partagé au client, QR scanné par un tiers) : le jeton
 * opaque ne contient rien ; la réponse se limite au strict nécessaire —
 * numéro, étape, dernière mise à jour. Ni prescription, ni identité du
 * client, ni nom du laboratoire (« Laboratoire partenaire »).
 */
export async function trackPublicRoutes(app: FastifyInstance): Promise<void> {
  const limit = { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } };

  app.get('/:token', limit, async (req, reply) => {
    const { token } = req.params as { token: string };
    if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) throw notFound('Lien de suivi invalide');

    const order = await prisma.lensOrder.findFirst({
      where: { publicToken: token },
      select: { id: true, tenantId: true, trackCode: true, trackStage: true, expectedAt: true, updatedAt: true, tenant: { select: { name: true } } },
    });
    if (order) {
      const steps = await prisma.trackEvent.findMany({
        where: { tenantId: order.tenantId, lensOrderId: order.id, stage: { not: null }, type: { in: ['ORDER_TRACKING_STARTED', 'STAGE_CHANGED'] } },
        orderBy: { occurredAt: 'asc' },
        select: { stage: true, occurredAt: true },
      });
      return reply.send({
        kind: 'order',
        code: order.trackCode,
        stage: order.trackStage,
        store: order.tenant.name,
        lab: 'Laboratoire partenaire',
        expectedAt: order.expectedAt,
        updatedAt: steps.at(-1)?.occurredAt ?? order.updatedAt,
        steps,
      });
    }

    const pkg = await prisma.trackPackage.findFirst({
      where: { token },
      select: { number: true, status: true, direction: true, updatedAt: true, expectedAt: true, tenant: { select: { name: true } }, _count: { select: { items: true } } },
    });
    if (!pkg) throw notFound('Lien de suivi invalide');
    return reply.send({
      kind: 'package',
      code: pkg.number,
      status: pkg.status,
      direction: pkg.direction,
      store: pkg.tenant.name,
      items: pkg._count.items,
      expectedAt: pkg.expectedAt,
      updatedAt: pkg.updatedAt,
    });
  });
}
