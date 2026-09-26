-- Journal des operations de synchronisation hors-ligne. Additif uniquement.
CREATE TABLE IF NOT EXISTS "SyncOperation" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "entityId" TEXT,
  "status" TEXT NOT NULL,
  "result" JSONB,
  "error" TEXT,
  "clientCreatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SyncOperation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SyncOperation_tenantId_deviceId_idx" ON "SyncOperation"("tenantId", "deviceId");
CREATE INDEX IF NOT EXISTS "SyncOperation_tenantId_status_idx" ON "SyncOperation"("tenantId", "status");
DO $$ BEGIN
  ALTER TABLE "SyncOperation"
    ADD CONSTRAINT "SyncOperation_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
