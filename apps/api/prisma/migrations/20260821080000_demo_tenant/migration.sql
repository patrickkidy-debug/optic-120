ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "isDemo" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "DemoProgress" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "currentStepId" TEXT,
    "completedAt" TIMESTAMP(3),
    "skipped" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DemoProgress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DemoProgress_tenantId_key" ON "DemoProgress"("tenantId");

DO $$ BEGIN
  ALTER TABLE "DemoProgress" ADD CONSTRAINT "DemoProgress_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
