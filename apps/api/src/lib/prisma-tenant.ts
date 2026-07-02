import { prisma } from './prisma.js';

/**
 * Modèles portant une colonne `tenantId` et donc soumis à l'isolation automatique.
 * Les modèles "enfants" (SaleItem, Transaction, RolePermission, UserBranch,
 * RefreshToken) sont isolés transitivement via leur parent et ne figurent pas ici.
 * `Tenant` et `Permission` sont volontairement globaux.
 */
const TENANT_MODELS = new Set<string>([
  'Branch',
  'User',
  'Role',
  'Product',
  'StockItem',
  'StockMovement',
  'Customer',
  'OpticalPrescription',
  'Sale',
  'Payment',
  'CashRegister',
  'AuditLog',
  'Patient',
  'Consultation',
  'Appointment',
  'Surgery',
  'Employee',
  'Expense',
  'Supplier',
  'Insurer',
  'LensOrder',
  'Repair',
]);

/**
 * Construit un client Prisma étendu qui force `tenantId` sur chaque requête
 * visant un modèle tenant-scopé. C'est la barrière d'isolation : tout code
 * métier reçoit ce client (via request.db) et ne peut pas, par construction,
 * lire ou écrire les données d'un autre tenant.
 *
 * Convention côté appelant : sur les modèles scopés, utiliser `findFirst`,
 * `updateMany` et `deleteMany` (jamais `findUnique`/`update`/`delete` par id
 * seul), afin que le filtre `tenantId` injecté reste compatible avec les
 * contraintes de Prisma.
 */
export function forTenant(tenantId: string) {
  return prisma.$extends({
    name: 'tenant-isolation',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model || !TENANT_MODELS.has(model)) {
            return query(args);
          }
          const a = (args ?? {}) as Record<string, unknown>;

          switch (operation) {
            case 'findFirst':
            case 'findFirstOrThrow':
            case 'findMany':
            case 'findUnique':
            case 'findUniqueOrThrow':
            case 'count':
            case 'aggregate':
            case 'groupBy':
            case 'updateMany':
            case 'deleteMany':
            case 'update':
            case 'delete': {
              a.where = { ...((a.where as object) ?? {}), tenantId };
              return query(a);
            }
            case 'create': {
              a.data = { ...((a.data as object) ?? {}), tenantId };
              return query(a);
            }
            case 'createMany': {
              const data = a.data;
              a.data = Array.isArray(data)
                ? data.map((d) => ({ ...(d as object), tenantId }))
                : { ...((data as object) ?? {}), tenantId };
              return query(a);
            }
            case 'upsert': {
              a.where = { ...((a.where as object) ?? {}), tenantId };
              a.create = { ...((a.create as object) ?? {}), tenantId };
              return query(a);
            }
            default:
              return query(a);
          }
        },
      },
    },
  });
}

export type TenantPrisma = ReturnType<typeof forTenant>;
