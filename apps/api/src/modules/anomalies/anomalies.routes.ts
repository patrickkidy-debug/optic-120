import type { FastifyInstance } from 'fastify';
import {
  anomalyDeclareSchema,
  anomalyModifySchema,
  anomalyApproveSchema,
  anomalyRejectSchema,
  anomalyCancelSchema,
  anomalyApplyPermission,
  type AnomalyListFilter,
} from '@oculo/shared-types';
import { requireAuth } from '../../middlewares/auth-guard.js';
import { requirePermission } from '../../middlewares/rbac-guard.js';
import { forbidden } from '../../lib/http-error.js';
import { recordAudit, requestMeta } from '../../lib/audit.js';
import * as anomaliesService from './anomalies.service.js';

/**
 * Module transverse "Anomalies & corrections" : déclaration, validation,
 * approbation et application tracée de correction, sur les modules
 * existants (ventes, stock, caisse, paiements, produits, clients, commandes
 * de verres, SAV, assurances). Ne remplace aucune route existante — voir
 * anomalies.service.ts pour le détail de la réutilisation.
 */
export async function anomaliesRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  app.get('/', { preHandler: requirePermission('anomalies.view') }, async (req, reply) => {
    const q = req.query as Record<string, string>;
    const filter: AnomalyListFilter = {
      category: (q.category as AnomalyListFilter['category']) || undefined,
      status: (q.status as AnomalyListFilter['status']) || undefined,
      declaredById: q.declaredById || undefined,
      from: q.from || undefined,
      to: q.to || undefined,
      hasFinancialImpact: q.hasFinancialImpact === 'true',
      hasStockImpact: q.hasStockImpact === 'true',
      page: q.page ? Number(q.page) : undefined,
    };
    const result = await anomaliesService.listAnomalies(req.auth!.tenantId, filter);
    return reply.send(result);
  });

  app.get('/dashboard', { preHandler: requirePermission('anomalies.view') }, async (req, reply) => {
    const q = req.query as Record<string, string>;
    const filter: AnomalyListFilter = {
      category: (q.category as AnomalyListFilter['category']) || undefined,
      declaredById: q.declaredById || undefined,
      from: q.from || undefined,
      to: q.to || undefined,
    };
    const dashboard = await anomaliesService.getAnomalyDashboard(req.auth!.tenantId, filter);
    return reply.send(dashboard);
  });

  // Journal d'activité du module : mêmes entrées AuditLog que le journal
  // général, filtrées sur entity='Anomaly' — même mécanisme que le journal
  // général (parametres/journal), voir apps/web/src/pages/settings/AuditPage.tsx.
  app.get('/journal', { preHandler: requirePermission('anomalies.journal') }, async (req, reply) => {
    const q = req.query as { page?: string };
    const page = Math.max(1, parseInt(q.page ?? '1', 10));
    const pageSize = 50;
    const [items, total] = await Promise.all([
      req.db!.auditLog.findMany({
        where: { entity: 'Anomaly' },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { user: { select: { firstName: true, lastName: true, email: true } } },
      }),
      req.db!.auditLog.count({ where: { entity: 'Anomaly' } }),
    ]);
    return reply.send({ items, total, page, pageSize });
  });

  app.get('/:id', { preHandler: requirePermission('anomalies.view') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const anomaly = await anomaliesService.getAnomaly(req.auth!.tenantId, id);
    return reply.send({ anomaly });
  });

  // Chronologie d'une anomalie — même motif que GET /lens-orders/:id/timeline.
  app.get('/:id/timeline', { preHandler: requirePermission('anomalies.journal') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const events = await req.db!.auditLog.findMany({
      where: { entity: 'Anomaly', entityId: id },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { firstName: true, lastName: true } } },
    });
    return reply.send({
      events: events.map((e) => ({
        id: e.id,
        action: e.action,
        metadata: e.metadata,
        createdAt: e.createdAt,
        userName: e.user ? `${e.user.firstName} ${e.user.lastName}` : null,
      })),
    });
  });

  app.post('/', { preHandler: requirePermission('anomalies.declare') }, async (req, reply) => {
    const input = anomalyDeclareSchema.parse(req.body);
    const anomaly = await anomaliesService.declareAnomaly(req.auth!.tenantId, req.auth!.userId, input);
    await recordAudit({
      tenantId: req.auth!.tenantId,
      userId: req.auth!.userId,
      action: 'ANOMALY_DECLARED',
      entity: 'Anomaly',
      entityId: anomaly.id,
      metadata: { number: anomaly.number, category: anomaly.category, correctionType: anomaly.correctionType },
      ...requestMeta(req),
    });
    return reply.status(201).send({ anomaly });
  });

  app.patch('/:id', { preHandler: requirePermission('anomalies.modify') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const input = anomalyModifySchema.parse(req.body);
    const anomaly = await anomaliesService.updateDeclaredAnomaly(req.auth!.tenantId, id, input);
    await recordAudit({
      tenantId: req.auth!.tenantId,
      userId: req.auth!.userId,
      action: 'ANOMALY_MODIFIED',
      entity: 'Anomaly',
      entityId: id,
      ...requestMeta(req),
    });
    return reply.send({ anomaly });
  });

  app.post('/:id/submit', { preHandler: requirePermission('anomalies.declare') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const anomaly = await anomaliesService.submitAnomaly(req.auth!.tenantId, id);
    await recordAudit({
      tenantId: req.auth!.tenantId,
      userId: req.auth!.userId,
      action: 'ANOMALY_SUBMITTED',
      entity: 'Anomaly',
      entityId: id,
      ...requestMeta(req),
    });
    return reply.send({ anomaly });
  });

  app.post('/:id/approve', { preHandler: requirePermission('anomalies.approve') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { approvalNote } = anomalyApproveSchema.parse(req.body ?? {});
    const anomaly = await anomaliesService.approveAnomaly(req.auth!.tenantId, req.auth!.userId, id, approvalNote || undefined);
    await recordAudit({
      tenantId: req.auth!.tenantId,
      userId: req.auth!.userId,
      action: 'ANOMALY_APPROVED',
      entity: 'Anomaly',
      entityId: id,
      metadata: { approvalNote },
      ...requestMeta(req),
    });
    return reply.send({ anomaly });
  });

  app.post('/:id/reject', { preHandler: requirePermission('anomalies.reject') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { rejectionReason } = anomalyRejectSchema.parse(req.body);
    const anomaly = await anomaliesService.rejectAnomaly(req.auth!.tenantId, req.auth!.userId, id, rejectionReason);
    await recordAudit({
      tenantId: req.auth!.tenantId,
      userId: req.auth!.userId,
      action: 'ANOMALY_REJECTED',
      entity: 'Anomaly',
      entityId: id,
      metadata: { rejectionReason },
      ...requestMeta(req),
    });
    return reply.send({ anomaly });
  });

  app.post('/:id/cancel', { preHandler: requirePermission('anomalies.cancel') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { cancellationReason } = anomalyCancelSchema.parse(req.body);
    const anomaly = await anomaliesService.cancelAnomaly(req.auth!.tenantId, req.auth!.userId, id, cancellationReason);
    await recordAudit({
      tenantId: req.auth!.tenantId,
      userId: req.auth!.userId,
      action: 'ANOMALY_CANCELLED',
      entity: 'Anomaly',
      entityId: id,
      metadata: { cancellationReason },
      ...requestMeta(req),
    });
    return reply.send({ anomaly });
  });

  // Appliquer est doublement gardé : anomalies.apply + la permission du
  // domaine réellement touché (table ANOMALY_APPLY_PERMISSION_BY_CATEGORY,
  // partagée avec le frontend — jamais deux listes qui divergent).
  app.post('/:id/apply', { preHandler: requirePermission('anomalies.apply') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const current = await anomaliesService.getAnomaly(req.auth!.tenantId, id);
    const domainPermission = anomalyApplyPermission(current.category as never, current.correctionType as never);
    if (!req.auth!.permissions.has(domainPermission)) {
      throw forbidden(`Permission requise : ${domainPermission}`);
    }
    const anomaly = await anomaliesService.applyCorrection(req.auth!.tenantId, req.auth!.userId, id);
    await recordAudit({
      tenantId: req.auth!.tenantId,
      userId: req.auth!.userId,
      action: 'ANOMALY_CORRECTION_APPLIED',
      entity: 'Anomaly',
      entityId: id,
      metadata: {
        category: anomaly!.category,
        correctionType: anomaly!.correctionType,
        financialImpact: Number(anomaly!.financialImpact),
        stockImpact: anomaly!.stockImpact,
      },
      ...requestMeta(req),
    });
    return reply.send({ anomaly });
  });
}
