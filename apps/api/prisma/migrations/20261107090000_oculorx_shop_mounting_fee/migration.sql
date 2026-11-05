-- OculoRX : montage ajouté au prix de vente de chaque paire (temporaire).
ALTER TABLE "RxSettings" ADD COLUMN IF NOT EXISTS "shopMountingFee" INTEGER NOT NULL DEFAULT 0;
