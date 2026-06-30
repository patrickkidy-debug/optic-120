import type { FastifyReply, FastifyRequest } from 'fastify';
import { planHasFeature, type PremiumFeature } from '@oculo/shared-types';
import { forbidden, unauthorized } from '../lib/http-error.js';

/**
 * Fabrique un preHandler qui exige une permission précise ("module.action").
 * À utiliser APRÈS requireAuth.
 */
export function requirePermission(permission: string) {
  return async function permissionGuard(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
    if (!req.auth) throw unauthorized();
    if (!req.auth.permissions.has(permission)) {
      throw forbidden(`Permission requise : ${permission}`);
    }
  };
}

/** Exige au moins une des permissions fournies. */
export function requireAnyPermission(...permissions: string[]) {
  return async function anyPermissionGuard(
    req: FastifyRequest,
    _reply: FastifyReply,
  ): Promise<void> {
    if (!req.auth) throw unauthorized();
    if (!permissions.some((p) => req.auth!.permissions.has(p))) {
      throw forbidden(`Permission requise : ${permissions.join(' ou ')}`);
    }
  };
}

/**
 * Fabrique un preHandler qui exige une fonctionnalité réservée aux offres
 * payantes (Standard/Premium). Renvoie 403 (et NON 402 : un 402 déclenche
 * côté frontend la suspension globale de tout l'espace, pas le verrouillage
 * d'une seule section). À utiliser APRÈS requireAuth.
 */
export function requirePlanFeature(feature: PremiumFeature) {
  return async function planFeatureGuard(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
    if (!req.auth) throw unauthorized();
    if (!planHasFeature(req.auth.planCode ?? 'TRIAL', feature)) {
      throw forbidden("Fonctionnalité réservée à l'offre Standard ou supérieure");
    }
  };
}

/**
 * Vérifie que l'utilisateur a accès à la succursale ciblée.
 * Les rôles `allBranches` (admin, gestionnaire…) passent toujours.
 * Renvoie 403 sinon. `branchId` est lu dans le body, la query ou les params.
 */
export function assertBranchAccess(req: FastifyRequest, branchId: string | undefined): void {
  if (!req.auth) throw unauthorized();
  if (!branchId) return;
  if (req.auth.allBranches) return;
  if (!req.auth.branchIds.includes(branchId)) {
    throw forbidden("Accès non autorisé à cette succursale");
  }
}
