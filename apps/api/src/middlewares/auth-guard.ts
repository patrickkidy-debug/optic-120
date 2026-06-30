import type { FastifyReply, FastifyRequest } from 'fastify';
import { verifyAccessToken } from '../lib/jwt.js';
import { prisma } from '../lib/prisma.js';
import { forTenant } from '../lib/prisma-tenant.js';
import { unauthorized, paymentRequired } from '../lib/http-error.js';
import type { AuthContext } from '../types/auth.js';
import { getSubscriptionStatus } from '../modules/billing/billing.service.js';
import { isOperatorEmail as isOperator } from '../lib/operators.js';

/** Routes accessibles même quand l'abonnement est suspendu (paiement, auth, opérateur). */
function isBillingExempt(url: string): boolean {
  const path = url.split('?')[0];
  return path.startsWith('/billing') || path.startsWith('/auth') || path.startsWith('/platform');
}

/**
 * preHandler d'authentification. Vérifie le jeton d'accès (Bearer), charge le
 * contexte utilisateur (rôle, permissions, succursales) et attache à la requête :
 *  - request.auth : contexte d'autorisation
 *  - request.db   : client Prisma scopé au tenant de l'utilisateur
 */
export async function requireAuth(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw unauthorized('Jeton d\'accès manquant');
  }
  const token = header.slice('Bearer '.length).trim();

  let claims;
  try {
    claims = await verifyAccessToken(token);
  } catch {
    throw unauthorized('Jeton d\'accès invalide ou expiré');
  }

  const user = await prisma.user.findUnique({
    where: { id: claims.sub },
    include: {
      role: { include: { permissions: { include: { permission: true } } } },
      branches: true,
    },
  });

  if (!user || !user.isActive || user.tenantId !== claims.tenantId) {
    throw unauthorized('Session invalide');
  }

  const permissions = new Set<string>(
    user.role.permissions.map((rp) => `${rp.permission.module}.${rp.permission.action}`),
  );

  const ctx: AuthContext = {
    userId: user.id,
    tenantId: user.tenantId,
    roleId: user.roleId,
    roleCode: user.role.code,
    roleName: user.role.name,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    permissions,
    branchIds: user.branches.map((b) => b.branchId),
    allBranches: user.role.allBranches,
  };

  // Statut d'abonnement + application de la suspension (sauf routes exemptées).
  const sub = await getSubscriptionStatus(user.tenantId);
  if (sub) {
    ctx.subscriptionStatus = sub.status;
    ctx.planCode = sub.planCode;
    // Blocage si l'abonnement est suspendu/annulé OU si la période (essai ou
    // payée) est expirée → « essai gratuit puis blocage tant que pas payé ».
    const expired = sub.currentPeriodEnd.getTime() < Date.now();
    const blocked = sub.status === 'SUSPENDED' || sub.status === 'CANCELLED' || expired;
    // Compte suspendu : consultation des données (GET) toujours permise — seules
    // les actions qui modifient quelque chose (création, vente, encaissement…)
    // sont bloquées tant que l'abonnement n'est pas activé.
    const isReadOnly = req.method === 'GET';
    if (blocked && !isReadOnly && !isBillingExempt(req.url) && !isOperator(user.email)) {
      throw paymentRequired(
        'Votre période est terminée. Activez votre abonnement pour continuer.',
      );
    }
  }

  req.auth = ctx;
  req.db = forTenant(user.tenantId);
}
