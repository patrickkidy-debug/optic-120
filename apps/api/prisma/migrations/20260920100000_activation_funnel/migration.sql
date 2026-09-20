-- Tunnel d'activation : parcours commercial obligatoire avant tout accès.
--
-- Purement additif : trois tables et un type, aucune table existante modifiée.
-- Le blocage de l'accès sans paiement ne demande aucune migration : le garde
-- d'abonnement refuse déjà tout accès dès que currentPeriodEnd est dépassé
-- (voir auth-guard). Le tunnel crée simplement l'établissement sans période
-- d'accès, donc immédiatement bloqué jusqu'à la confirmation du paiement.
DO $$
BEGIN
  CREATE TYPE "ActivationStepDb" AS ENUM ('ACTIVITY', 'NEEDS', 'PLAN', 'INFORMATION', 'PAYMENT', 'DONE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "ActivationSession" (
  "id"                TEXT NOT NULL,
  "token"             TEXT NOT NULL,
  "step"              "ActivationStepDb" NOT NULL DEFAULT 'ACTIVITY',
  "structureType"     TEXT,
  "branchCount"       TEXT,
  "country"           TEXT,
  "needs"             JSONB,
  "planCode"          TEXT,
  "billingCycle"      TEXT,
  "fullName"          TEXT,
  "establishmentName" TEXT,
  "phone"             TEXT,
  "whatsapp"          TEXT,
  "email"             TEXT,
  "city"              TEXT,
  "wantsStockImport"  BOOLEAN NOT NULL DEFAULT false,
  "hasExistingData"   BOOLEAN NOT NULL DEFAULT false,
  "tenantId"          TEXT,
  "invoiceId"         TEXT,
  "paidAt"            TIMESTAMP(3),
  "abandoned"         BOOLEAN NOT NULL DEFAULT false,
  "utmSource"         TEXT,
  "utmMedium"         TEXT,
  "utmCampaign"       TEXT,
  "lastSeenAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ActivationSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ActivationSession_token_key" ON "ActivationSession"("token");
CREATE INDEX IF NOT EXISTS "ActivationSession_step_idx" ON "ActivationSession"("step");
CREATE INDEX IF NOT EXISTS "ActivationSession_createdAt_idx" ON "ActivationSession"("createdAt");
CREATE INDEX IF NOT EXISTS "ActivationSession_tenantId_idx" ON "ActivationSession"("tenantId");

DO $$
BEGIN
  ALTER TABLE "ActivationSession"
    ADD CONSTRAINT "ActivationSession_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "ActivationEvent" (
  "id"        TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "payload"   JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ActivationEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ActivationEvent_sessionId_idx" ON "ActivationEvent"("sessionId");
CREATE INDEX IF NOT EXISTS "ActivationEvent_name_createdAt_idx" ON "ActivationEvent"("name", "createdAt");

DO $$
BEGIN
  ALTER TABLE "ActivationEvent"
    ADD CONSTRAINT "ActivationEvent_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "ActivationSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "CallbackRequest" (
  "id"        TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "phone"     TEXT NOT NULL,
  "moment"    TEXT NOT NULL,
  "sessionId" TEXT,
  "status"    TEXT NOT NULL DEFAULT 'PENDING',
  "handledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CallbackRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CallbackRequest_status_idx" ON "CallbackRequest"("status");
CREATE INDEX IF NOT EXISTS "CallbackRequest_createdAt_idx" ON "CallbackRequest"("createdAt");
