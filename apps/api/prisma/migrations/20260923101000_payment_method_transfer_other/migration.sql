-- Deux moyens de reglement necessaires a la facturation de l'editeur (§6, §21) :
-- le virement bancaire et un « Autre » pour les cas residuels.
--
-- Additif uniquement. Ces valeurs n'apparaissent PAS dans
-- PAYMENT_METHODS_BY_COUNTRY, donc aucune caisse existante ne les propose : la
-- caisse continue d'offrir exactement les memes moyens qu'avant.
DO $$ BEGIN ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'BANK_TRANSFER'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'OTHER'; EXCEPTION WHEN others THEN NULL; END $$;
