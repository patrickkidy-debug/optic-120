-- Nouvelles familles du catalogue optique.
-- PostgreSQL 12+ accepte ADD VALUE dans une transaction tant que la valeur
-- n'est pas utilisée dans la même transaction (ce n'est pas le cas ici).
ALTER TYPE "ProductCategory" ADD VALUE IF NOT EXISTS 'ENTRETIEN';
ALTER TYPE "ProductCategory" ADD VALUE IF NOT EXISTS 'AUTRE';

-- Photo principale : chargée avec la liste (catalogue visuel).
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "photoUrl" TEXT;

-- Photos secondaires : exclues des listes, chargées à la demande.
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "photos" JSONB;
