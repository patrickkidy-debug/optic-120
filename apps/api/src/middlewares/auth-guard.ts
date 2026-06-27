import type { FastifyReply, FastifyRequest } from 'fastify';
import { verifyAccessToken } from '../lib/jwt.js';
import { prisma } from '../lib/prisma.js';
import { forTenant } from '../lib/prisma-tenant.js';
import { unauthorized } from '../lib/http-error.js';
import type { AuthContext } from '../types/auth.js';

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

  req.auth = ctx;
  req.db = forTenant(user.tenantId);
}
