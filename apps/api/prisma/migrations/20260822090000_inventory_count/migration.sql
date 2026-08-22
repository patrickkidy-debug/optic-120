-- Emplacement physique libre sur une ligne de stock (jamais obligatoire).
ALTER TABLE "StockItem" ADD COLUMN IF NOT EXISTS "location" TEXT;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "InventoryCountStatus" AS ENUM ('DRAFT', 'COMPLETED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "InventoryAdjustmentReason" AS ENUM ('PHYSICAL_INVENTORY', 'BREAKAGE', 'LOSS', 'THEFT', 'ENTRY_ERROR', 'GIFT', 'INVENTORY_ERROR', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "InventoryCount" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "status" "InventoryCountStatus" NOT NULL DEFAULT 'DRAFT',
    "scopeCategory" TEXT,
    "scopeBrand" TEXT,
    "scopeLocation" TEXT,
    "note" TEXT,
    "startedById" TEXT,
    "validatedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryCount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "InventoryCountLine" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "inventoryCountId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "theoreticalQty" INTEGER NOT NULL,
    "countedQty" INTEGER,
    "countedById" TEXT,
    "countedAt" TIMESTAMP(3),
    "locationSnapshot" TEXT,
    "deltaQty" INTEGER,
    "deltaValue" DECIMAL(14,2),
    "regularized" BOOLEAN NOT NULL DEFAULT false,
    "movementId" TEXT,
    "reason" "InventoryAdjustmentReason",
    "reasonNote" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryCountLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InventoryCount_tenantId_branchId_status_idx" ON "InventoryCount"("tenantId", "branchId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InventoryCountLine_tenantId_inventoryCountId_idx" ON "InventoryCountLine"("tenantId", "inventoryCountId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "InventoryCountLine_inventoryCountId_productId_key" ON "InventoryCountLine"("inventoryCountId", "productId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "InventoryCount" ADD CONSTRAINT "InventoryCount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "InventoryCount" ADD CONSTRAINT "InventoryCount_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "InventoryCount" ADD CONSTRAINT "InventoryCount_startedById_fkey" FOREIGN KEY ("startedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "InventoryCount" ADD CONSTRAINT "InventoryCount_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "InventoryCountLine" ADD CONSTRAINT "InventoryCountLine_inventoryCountId_fkey" FOREIGN KEY ("inventoryCountId") REFERENCES "InventoryCount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "InventoryCountLine" ADD CONSTRAINT "InventoryCountLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "InventoryCountLine" ADD CONSTRAINT "InventoryCountLine_countedById_fkey" FOREIGN KEY ("countedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
