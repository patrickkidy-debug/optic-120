-- OculoRX : catalogue boutique (nom commercial et prix de vente du magasin).
ALTER TABLE "RxLens" ADD COLUMN IF NOT EXISTS "shopName" TEXT;
ALTER TABLE "RxLens" ADD COLUMN IF NOT EXISTS "shopPrice" INTEGER;
