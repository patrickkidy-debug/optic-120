-- Lignes OD/OG, détail des taxes, articles de présentation sans stock
ALTER TABLE "SaleItem" ADD COLUMN "eye" VARCHAR(2);
ALTER TABLE "Sale" ADD COLUMN "taxDetails" JSONB;
ALTER TABLE "Product" ADD COLUMN "trackStock" BOOLEAN NOT NULL DEFAULT true;
