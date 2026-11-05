-- Ligne de vente : désignation libre (verre composé en caisse sans fiche produit).
ALTER TABLE "SaleItem" ADD COLUMN IF NOT EXISTS "label" VARCHAR(200);
-- Les verres composés déjà créés (une fiche par combinaison) disparaissent du
-- catalogue et des étiquettes ; les ventes passées gardent leur fiche.
UPDATE "Product" SET "isActive" = false WHERE "category" = 'VERRE' AND "attributes" ? 'lensBase';
