-- Compteur de numérotation des pièces, une ligne par établissement et par
-- série annuelle (« DEV-2026 », « VEN-2026 », « ANO-2026 »…).
--
-- Purement additif : aucune table existante n'est modifiée, aucun document
-- n'est renuméroté. Les compteurs se créent d'eux-mêmes à la première
-- utilisation de chaque série, initialisés sur le plus grand numéro déjà émis
-- (voir document-number.ts) — un établissement qui en est à DEV-2026-000042
-- repart donc de 43, sans trou ni doublon.
CREATE TABLE IF NOT EXISTS "DocumentCounter" (
  "tenantId"  TEXT NOT NULL,
  "series"    TEXT NOT NULL,
  "value"     INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentCounter_pkey" PRIMARY KEY ("tenantId", "series")
);

CREATE INDEX IF NOT EXISTS "DocumentCounter_tenantId_idx" ON "DocumentCounter"("tenantId");

DO $$
BEGIN
  ALTER TABLE "DocumentCounter"
    ADD CONSTRAINT "DocumentCounter_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
