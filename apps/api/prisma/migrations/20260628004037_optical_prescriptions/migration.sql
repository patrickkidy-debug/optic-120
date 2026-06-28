-- CreateTable
CREATE TABLE "OpticalPrescription" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "prescriberName" TEXT,
    "odSphere" TEXT,
    "odCylinder" TEXT,
    "odAxis" TEXT,
    "odAddition" TEXT,
    "ogSphere" TEXT,
    "ogCylinder" TEXT,
    "ogAxis" TEXT,
    "ogAddition" TEXT,
    "pupillaryDistance" TEXT,
    "lensType" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpticalPrescription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OpticalPrescription_tenantId_customerId_idx" ON "OpticalPrescription"("tenantId", "customerId");

-- CreateIndex
CREATE INDEX "OpticalPrescription_tenantId_idx" ON "OpticalPrescription"("tenantId");

-- AddForeignKey
ALTER TABLE "OpticalPrescription" ADD CONSTRAINT "OpticalPrescription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpticalPrescription" ADD CONSTRAINT "OpticalPrescription_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
