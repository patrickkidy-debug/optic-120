-- Ordonnance jointe (facultative) à un devis ou une vente : reprise sur le
-- document imprimé, pour que le client ait devis et correction sur une page.
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "prescriptionId" TEXT;

CREATE INDEX IF NOT EXISTS "Sale_prescriptionId_idx" ON "Sale"("prescriptionId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Sale_prescriptionId_fkey'
  ) THEN
    ALTER TABLE "Sale"
      ADD CONSTRAINT "Sale_prescriptionId_fkey"
      FOREIGN KEY ("prescriptionId") REFERENCES "OpticalPrescription"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
