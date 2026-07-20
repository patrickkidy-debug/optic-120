-- Tarifs verres/traitements propres à l'établissement (configurateur).
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "lensPricing" JSONB;
-- Investissement initial, pour la projection d'amortissement (page Finance).
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "initialInvestment" DOUBLE PRECISION;
