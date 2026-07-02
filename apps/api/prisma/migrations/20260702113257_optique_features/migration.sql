-- CreateEnum
CREATE TYPE "LensOrderStatus" AS ENUM ('ORDERED', 'RECEIVED', 'MOUNTED', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RepairStatus" AS ENUM ('RECEIVED', 'IN_PROGRESS', 'READY', 'DELIVERED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "SaleType" ADD VALUE 'RETURN';

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "loyaltyPoints" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "OpticalPrescription" ADD COLUMN     "odHeight" TEXT,
ADD COLUMN     "odNearPd" TEXT,
ADD COLUMN     "ogHeight" TEXT,
ADD COLUMN     "ogNearPd" TEXT,
ADD COLUMN     "pantoTilt" TEXT,
ADD COLUMN     "vertex" TEXT;

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "originalSaleId" TEXT;

-- CreateTable
CREATE TABLE "LensOrder" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "customerId" TEXT,
    "supplierName" TEXT,
    "description" TEXT NOT NULL,
    "status" "LensOrderStatus" NOT NULL DEFAULT 'ORDERED',
    "expectedAt" TIMESTAMP(3),
    "cost" DECIMAL(12,2),
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LensOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Repair" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "customerId" TEXT,
    "description" TEXT NOT NULL,
    "status" "RepairStatus" NOT NULL DEFAULT 'RECEIVED',
    "cost" DECIMAL(12,2),
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Repair_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LensOrder_tenantId_status_idx" ON "LensOrder"("tenantId", "status");

-- CreateIndex
CREATE INDEX "LensOrder_tenantId_customerId_idx" ON "LensOrder"("tenantId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "LensOrder_tenantId_number_key" ON "LensOrder"("tenantId", "number");

-- CreateIndex
CREATE INDEX "Repair_tenantId_status_idx" ON "Repair"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Repair_tenantId_customerId_idx" ON "Repair"("tenantId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "Repair_tenantId_number_key" ON "Repair"("tenantId", "number");

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_originalSaleId_fkey" FOREIGN KEY ("originalSaleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LensOrder" ADD CONSTRAINT "LensOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LensOrder" ADD CONSTRAINT "LensOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repair" ADD CONSTRAINT "Repair_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repair" ADD CONSTRAINT "Repair_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
