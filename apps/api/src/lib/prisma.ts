import { PrismaClient } from '@prisma/client';
import { isProd } from '../config/env.js';

/**
 * Client Prisma "système" — NON scopé par tenant.
 * Réservé aux opérations transverses : authentification (lookup cross-tenant
 * au login), création de tenant, webhooks. Ne JAMAIS l'utiliser directement
 * dans les handlers métier : passer par request.db (cf. prisma-tenant.ts).
 */
export const prisma = new PrismaClient({
  log: isProd ? ['warn', 'error'] : ['warn', 'error'],
});

export type RawPrisma = typeof prisma;
