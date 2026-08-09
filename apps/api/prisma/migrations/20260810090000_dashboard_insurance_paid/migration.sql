-- Marquage manuel du remboursement assureur effectivement reçu (widget
-- Assurances du tableau de bord : distingue "recouvré" de "en attente").
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "insurerPaidAt" TIMESTAMP(3);
