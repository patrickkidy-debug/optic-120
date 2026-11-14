-- OculoLab : tracés de forme de monture et fiches précal.
CREATE TABLE "FrameTrace" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "label" TEXT,
    "customerId" TEXT,
    "supplierId" TEXT,
    "lensOrderId" TEXT,
    "measurementId" TEXT,
    "prescriptionId" TEXT,
    "source" TEXT NOT NULL,
    "frameType" TEXT NOT NULL DEFAULT 'FULL_RIM',
    "frameRef" TEXT,
    "radii" JSONB NOT NULL,
    "boxA" DOUBLE PRECISION NOT NULL,
    "boxB" DOUBLE PRECISION NOT NULL,
    "dbl" DOUBLE PRECISION NOT NULL,
    "ed" DOUBLE PRECISION NOT NULL,
    "circumference" DOUBLE PRECISION NOT NULL,
    "confidence" INTEGER,
    "photoUrl" TEXT,
    "precal" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "sentAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FrameTrace_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FrameTrace_tenantId_number_key" ON "FrameTrace"("tenantId", "number");
CREATE INDEX "FrameTrace_tenantId_createdAt_idx" ON "FrameTrace"("tenantId", "createdAt");
CREATE INDEX "FrameTrace_tenantId_customerId_idx" ON "FrameTrace"("tenantId", "customerId");
CREATE INDEX "FrameTrace_supplierId_idx" ON "FrameTrace"("supplierId");

ALTER TABLE "FrameTrace" ADD CONSTRAINT "FrameTrace_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FrameTrace" ADD CONSTRAINT "FrameTrace_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FrameTrace" ADD CONSTRAINT "FrameTrace_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
