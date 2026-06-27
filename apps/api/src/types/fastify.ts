import 'fastify';
import type { TenantPrisma } from '../lib/prisma-tenant.js';
import type { AuthContext } from './auth.js';

declare module 'fastify' {
  interface FastifyRequest {
    /** Contexte d'auth (présent après authGuard). */
    auth?: AuthContext;
    /** Client Prisma scopé au tenant (présent après tenantScope). */
    db?: TenantPrisma;
  }
}
