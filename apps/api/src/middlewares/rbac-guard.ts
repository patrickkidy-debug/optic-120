import type { FastifyReply, FastifyRequest } from 'fastify';
import { forbidden, unauthorized } from '../lib/http-error.js';
import { isOperatorEmail } from '../lib/operators.js';

/** Le fondateur / opérateur plateforme passe toutes les vérifications de permission. */
function isUnrestricted(req: FastifyRequest): boolean {
  return !!req.auth && isOperatorEmail(req.auth.email);
}

/**
 * Fabrique un preHandler qui exige une permission précise ("module.action").
 * À utiliser APRÈS requireAuth.
 */
export function requirePermission(permission: string) {
  return async function permissionGuard(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
    if (!req.auth) throw unauthorized();
    if (isUnrestricted(req)) return;
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
    if (isUnrestricted(req)) return;
    if (!permissions.some((p) => req.auth!.permissions.has(p))) {
      throw forbidden(`Permission requise : ${permissions.join(' ou ')}`);
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
  if (req.auth.allBranches || isUnrestricted(req)) return;
  if (!req.auth.branchIds.includes(branchId)) {
    throw forbidden("Accès non autorisé à cette succursale");
  }
}
