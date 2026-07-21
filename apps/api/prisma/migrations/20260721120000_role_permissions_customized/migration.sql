-- Empêche le resync des rôles système (seed au déploiement) d'écraser les
-- permissions personnalisées d'un rôle par un tenant.
ALTER TABLE "Role" ADD COLUMN IF NOT EXISTS "permissionsCustomized" BOOLEAN NOT NULL DEFAULT false;

-- Protection rétroactive : on ne peut pas savoir quels rôles système ont déjà
-- été personnalisés dans les tenants existants, donc on les marque tous comme
-- personnalisés pour qu'aucun futur resync ne les réinitialise. Les templates
-- globaux (tenantId IS NULL) restent resyncables.
UPDATE "Role"
SET "permissionsCustomized" = true
WHERE "isSystem" = true AND "tenantId" IS NOT NULL;
