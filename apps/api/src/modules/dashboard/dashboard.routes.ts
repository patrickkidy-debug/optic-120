import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../../middlewares/auth-guard.js';
import { requirePermission, assertBranchAccess } from '../../middlewares/rbac-guard.js';
import { getDashboard, getAdminDashboard, getSeries, getActivity, type DashboardRange } from './dashboard.service.js';
import { getForecast } from './forecast.service.js';

export async function dashboardRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  app.get('/', { preHandler: requirePermission('dashboard.view') }, async (req, reply) => {
    const q = req.query as { branchId?: string };
    if (q.branchId) assertBranchAccess(req, q.branchId);
    // Sans branchId : agrégat tous magasins (réservé aux rôles multi-magasin).
    const branchId = q.branchId ?? (req.auth!.allBranches ? undefined : req.auth!.branchIds[0]);
    const data = await getDashboard(req.auth!.tenantId, branchId);
    return reply.send({ dashboard: data });
  });

  const RANGES: DashboardRange[] = ['7d', '30d', '3m', '12m'];

  // Série multi-métrique (CA/ventes/encaissé/marge) pour le graphique interactif.
  app.get('/series', { preHandler: requirePermission('dashboard.view') }, async (req, reply) => {
    const q = req.query as { branchId?: string; range?: string };
    if (q.branchId) assertBranchAccess(req, q.branchId);
    const branchId = q.branchId ?? (req.auth!.allBranches ? undefined : req.auth!.branchIds[0]);
    const range = RANGES.includes(q.range as DashboardRange) ? (q.range as DashboardRange) : '7d';
    const series = await getSeries(req.auth!.tenantId, branchId, range);
    return reply.send({ series });
  });

  // Fil d'activité du jour (ventes, paiements, commandes labo, consultations, stock).
  app.get('/activity', { preHandler: requirePermission('dashboard.view') }, async (req, reply) => {
    const q = req.query as { branchId?: string };
    if (q.branchId) assertBranchAccess(req, q.branchId);
    const branchId = q.branchId ?? (req.auth!.allBranches ? undefined : req.auth!.branchIds[0]);
    const activity = await getActivity(req.auth!.tenantId, branchId);
    return reply.send({ activity });
  });

  // Analyse prédictive (prévision du CA, tendance, ruptures de stock à venir).
  app.get('/forecast', { preHandler: requirePermission('dashboard.view') }, async (req, reply) => {
    const q = req.query as { branchId?: string };
    if (q.branchId) assertBranchAccess(req, q.branchId);
    const branchId = q.branchId ?? (req.auth!.allBranches ? undefined : req.auth!.branchIds[0]);
    const forecast = await getForecast(req.auth!.tenantId, branchId);
    return reply.send({ forecast });
  });

  // Vue enrichie administrateur (par magasin, vendeurs, équipe, finance).
  app.get('/admin', { preHandler: requirePermission('finance.expenses.view') }, async (req, reply) => {
    const data = await getAdminDashboard(req.auth!.tenantId, {
      allBranches: req.auth!.allBranches,
      branchIds: req.auth!.branchIds,
    });
    return reply.send({ admin: data });
  });
}
