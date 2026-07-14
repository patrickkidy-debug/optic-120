-- Délai de livraison des commandes de verres : date de remise au client.
ALTER TABLE "LensOrder" ADD COLUMN "deliveredAt" TIMESTAMP(3);
