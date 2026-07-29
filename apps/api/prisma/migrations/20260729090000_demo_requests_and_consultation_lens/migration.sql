-- Consultation : type de verres recommandé sur l'ordonnance
ALTER TABLE "Consultation" ADD COLUMN IF NOT EXISTS "lensType" TEXT;

-- Réservations de démonstration gratuite (suivi commercial, console fondateur)
CREATE TABLE IF NOT EXISTS "DemoRequest" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT,
  "tenantName" TEXT,
  "contactName" TEXT NOT NULL,
  "contactEmail" TEXT NOT NULL,
  "contactPhone" TEXT,
  "preferredAt" TIMESTAMP(3) NOT NULL,
  "notes" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DemoRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DemoRequest_status_idx" ON "DemoRequest"("status");
CREATE INDEX IF NOT EXISTS "DemoRequest_createdAt_idx" ON "DemoRequest"("createdAt");
