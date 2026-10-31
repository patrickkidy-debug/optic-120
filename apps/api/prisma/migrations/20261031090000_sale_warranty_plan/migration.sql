-- Formule de garantie (avant-première) : échéances verres et monture.
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "lensWarrantyEndsAt" TIMESTAMP(3);
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "frameWarrantyEndsAt" TIMESTAMP(3);
