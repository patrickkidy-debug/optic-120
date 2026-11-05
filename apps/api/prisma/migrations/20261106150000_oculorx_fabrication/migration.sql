-- OculoRX : verre de stock ou fabriqué sur mesure (RX).
ALTER TABLE "RxLens" ADD COLUMN IF NOT EXISTS "fabrication" TEXT;
