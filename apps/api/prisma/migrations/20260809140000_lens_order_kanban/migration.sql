-- Workflow Kanban des commandes de verres : nouveaux statuts.
-- Ajoutés un par un (règle Postgres : une valeur ajoutée dans cette
-- transaction ne peut pas être utilisée dans la même transaction — la
-- réaffectation des commandes existantes se fait dans la migration suivante).
ALTER TYPE "LensOrderStatus" ADD VALUE IF NOT EXISTS 'TO_ORDER';
ALTER TYPE "LensOrderStatus" ADD VALUE IF NOT EXISTS 'LAB_CONFIRMED';
ALTER TYPE "LensOrderStatus" ADD VALUE IF NOT EXISTS 'IN_PRODUCTION';
ALTER TYPE "LensOrderStatus" ADD VALUE IF NOT EXISTS 'SHIPPED';
ALTER TYPE "LensOrderStatus" ADD VALUE IF NOT EXISTS 'CONTROL';
ALTER TYPE "LensOrderStatus" ADD VALUE IF NOT EXISTS 'MOUNTING';
ALTER TYPE "LensOrderStatus" ADD VALUE IF NOT EXISTS 'READY';

-- Détail par œil + monture associée (vignette Kanban) + rappel client.
ALTER TABLE "LensOrder" ADD COLUMN IF NOT EXISTS "odLens" TEXT;
ALTER TABLE "LensOrder" ADD COLUMN IF NOT EXISTS "ogLens" TEXT;
ALTER TABLE "LensOrder" ADD COLUMN IF NOT EXISTS "frameProductId" TEXT;
ALTER TABLE "LensOrder" ADD COLUMN IF NOT EXISTS "notifiedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "LensOrder_frameProductId_idx" ON "LensOrder"("frameProductId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'LensOrder_frameProductId_fkey'
  ) THEN
    ALTER TABLE "LensOrder"
      ADD CONSTRAINT "LensOrder_frameProductId_fkey"
      FOREIGN KEY ("frameProductId") REFERENCES "Product"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
