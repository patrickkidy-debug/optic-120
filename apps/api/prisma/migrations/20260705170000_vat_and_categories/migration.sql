-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "vatRate" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "LensOrder" ADD COLUMN     "category" TEXT;

-- AlterTable
ALTER TABLE "Repair" ADD COLUMN     "category" TEXT;
