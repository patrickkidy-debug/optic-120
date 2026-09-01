CREATE TABLE IF NOT EXISTS "StoreSetupProgress" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "stepOverrides" JSONB NOT NULL DEFAULT '{}',
    "finishedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreSetupProgress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StoreSetupProgress_tenantId_key" ON "StoreSetupProgress"("tenantId");

DO $$ BEGIN
  ALTER TABLE "StoreSetupProgress" ADD CONSTRAINT "StoreSetupProgress_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
