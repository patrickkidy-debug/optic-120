-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "deliveryDays" INTEGER,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "paymentTerms" TEXT,
ADD COLUMN     "website" TEXT,
ADD COLUMN     "whatsapp" TEXT;

-- CreateTable
CREATE TABLE "OpticalMeasurement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT,
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" TEXT NOT NULL DEFAULT 'MANUAL',
    "pdTotal" DOUBLE PRECISION,
    "odMonoPd" DOUBLE PRECISION,
    "ogMonoPd" DOUBLE PRECISION,
    "odHeight" DOUBLE PRECISION,
    "ogHeight" DOUBLE PRECISION,
    "nearPd" DOUBLE PRECISION,
    "lensWidth" DOUBLE PRECISION,
    "lensHeight" DOUBLE PRECISION,
    "bridge" DOUBLE PRECISION,
    "vertex" DOUBLE PRECISION,
    "pantoTilt" DOUBLE PRECISION,
    "wrapAngle" DOUBLE PRECISION,
    "frameLabel" TEXT,
    "frameProductId" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpticalMeasurement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OpticalMeasurement_tenantId_customerId_idx" ON "OpticalMeasurement"("tenantId", "customerId");

-- CreateIndex
CREATE INDEX "OpticalMeasurement_tenantId_idx" ON "OpticalMeasurement"("tenantId");

-- AddForeignKey
ALTER TABLE "OpticalMeasurement" ADD CONSTRAINT "OpticalMeasurement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpticalMeasurement" ADD CONSTRAINT "OpticalMeasurement_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

