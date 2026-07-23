-- Lien vente -> assureur : permet de suivre les montants pris en charge par
-- chaque assurance et d'afficher les paiements trimestriels à venir.
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "insurerId" TEXT;

ALTER TABLE "Sale" ADD CONSTRAINT "Sale_insurerId_fkey"
  FOREIGN KEY ("insurerId") REFERENCES "Insurer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "Sale_insurerId_idx" ON "Sale"("insurerId");
