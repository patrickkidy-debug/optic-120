-- Commande de verres liée à une ordonnance du dossier client.
ALTER TABLE "LensOrder" ADD COLUMN "prescriptionId" TEXT;
CREATE INDEX "LensOrder_prescriptionId_idx" ON "LensOrder"("prescriptionId");
ALTER TABLE "LensOrder" ADD CONSTRAINT "LensOrder_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "OpticalPrescription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
