-- Cloisonnement des clients par magasin.
--
-- Jusqu'ici la fiche client était commune à tout l'établissement : deux
-- magasins d'une même enseigne voyaient et modifiaient le même fichier. Chaque
-- magasin doit désormais avoir ses propres clients.
--
-- La colonne est NULLABLE à dessein. Un client n'ayant jamais acheté ne peut
-- être rattaché à aucun magasin sans inventer une information ; il reste donc
-- non rattaché et visible partout jusqu'à sa première opération. Aucune ligne
-- n'est supprimée et aucune fiche n'est dupliquée.
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "branchId" TEXT;

DO $$
BEGIN
  ALTER TABLE "Customer"
    ADD CONSTRAINT "Customer_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "Customer_tenantId_branchId_idx" ON "Customer"("tenantId", "branchId");

-- Rattachement déduit de l'historique réel : le magasin de la PREMIÈRE vente
-- du client. Un client ayant acheté dans plusieurs magasins est rattaché à
-- celui où il a été servi en premier ; ses ventes passées dans les autres
-- magasins ne bougent pas — elles restent rattachées à leur propre magasin,
-- qui est déjà porté par Sale.branchId.
UPDATE "Customer" c
SET "branchId" = first_sale."branchId"
FROM (
  SELECT DISTINCT ON (s."customerId") s."customerId", s."branchId"
  FROM "Sale" s
  WHERE s."customerId" IS NOT NULL
  ORDER BY s."customerId", s."createdAt" ASC
) AS first_sale
WHERE c."id" = first_sale."customerId"
  AND c."branchId" IS NULL;
