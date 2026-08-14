-- Nombre de mois couverts par une facture d'abonnement (1 = mensuel, 6 =
-- paiement groupé 6 mois) : permet de prolonger l'abonnement du bon nombre
-- de mois au règlement, y compris via webhook asynchrone.
ALTER TABLE "SubscriptionInvoice" ADD COLUMN IF NOT EXISTS "periodMonths" INTEGER NOT NULL DEFAULT 1;
