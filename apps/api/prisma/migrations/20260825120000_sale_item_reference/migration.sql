-- Référence libre par ligne de vente (ex. référence fabricant d'une monture),
-- indépendante du stock : plusieurs articles peuvent partager la même fiche
-- produit/prix au catalogue sans qu'on ait à créer un SKU par référence.
ALTER TABLE "SaleItem" ADD COLUMN     "reference" VARCHAR(80);
