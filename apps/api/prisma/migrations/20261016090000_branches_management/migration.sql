-- Magasins & succursales : fiche complète, responsable, archivage, magasin principal.
ALTER TABLE "Branch" ADD COLUMN "code" TEXT;
ALTER TABLE "Branch" ADD COLUMN "countryCode" TEXT;
ALTER TABLE "Branch" ADD COLUMN "email" TEXT;
ALTER TABLE "Branch" ADD COLUMN "whatsapp" TEXT;
ALTER TABLE "Branch" ADD COLUMN "logoUrl" TEXT;
ALTER TABLE "Branch" ADD COLUMN "managerId" TEXT;
ALTER TABLE "Branch" ADD COLUMN "openingHours" JSONB;
ALTER TABLE "Branch" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "Branch" ADD COLUMN "updatedAt" TIMESTAMP(3);
ALTER TABLE "Tenant" ADD COLUMN "mainBranchId" TEXT;

ALTER TABLE "Branch" ADD CONSTRAINT "Branch_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Codes internes des magasins existants : MAG-001, MAG-002… par ordre de création.
UPDATE "Branch" b SET "code" = 'MAG-' || LPAD(r.rn::text, 3, '0')
FROM (SELECT "id", ROW_NUMBER() OVER (PARTITION BY "tenantId" ORDER BY "createdAt", "id") AS rn FROM "Branch") r
WHERE b."id" = r."id";

CREATE UNIQUE INDEX "Branch_tenantId_code_key" ON "Branch"("tenantId", "code");

-- Magasin principal : le premier magasin créé de chaque établissement (comportement actuel).
UPDATE "Tenant" t SET "mainBranchId" = (
  SELECT b."id" FROM "Branch" b WHERE b."tenantId" = t."id" ORDER BY b."createdAt", b."id" LIMIT 1
);
