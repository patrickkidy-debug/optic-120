-- Fiche client optique complète (relances, conseils liés à l'âge, documents)
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "dateOfBirth" TIMESTAMP(3);
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "gender" "Gender";
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "profession" TEXT;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "notes" TEXT;

-- Fin de validité d'une ordonnance (pilote les relances de renouvellement)
ALTER TABLE "OpticalPrescription" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);

-- Garantie accordée sur la vente + remise payée en points de fidélité
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "warrantyMonths" INTEGER;
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "warrantyEndsAt" TIMESTAMP(3);
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "loyaltyPointsUsed" INTEGER NOT NULL DEFAULT 0;

-- Réception fournisseur : origine et coût unitaire d'une entrée de stock
ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "supplierId" TEXT;
ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "unitCost" DECIMAL(12,2);
CREATE INDEX IF NOT EXISTS "StockMovement_supplierId_idx" ON "StockMovement"("supplierId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StockMovement_supplierId_fkey'
  ) THEN
    ALTER TABLE "StockMovement"
      ADD CONSTRAINT "StockMovement_supplierId_fkey"
      FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Réglages métier optique (validité ordonnance, relances, garantie, fidélité)
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "opticalSettings" JSONB;
