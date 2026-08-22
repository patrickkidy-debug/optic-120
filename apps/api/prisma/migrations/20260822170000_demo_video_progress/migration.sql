-- Progression des vidéos de démonstration (reprise + mesure d'intérêt prospect).
CREATE TABLE IF NOT EXISTS "DemoVideoProgress" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "videoKey" TEXT NOT NULL,
    "lastPositionSeconds" INTEGER NOT NULL DEFAULT 0,
    "durationSeconds" INTEGER,
    "maxPercent" INTEGER NOT NULL DEFAULT 0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "understood" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DemoVideoProgress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DemoVideoProgress_userId_videoKey_key" ON "DemoVideoProgress"("userId", "videoKey");
CREATE INDEX IF NOT EXISTS "DemoVideoProgress_tenantId_idx" ON "DemoVideoProgress"("tenantId");

DO $$ BEGIN
  ALTER TABLE "DemoVideoProgress" ADD CONSTRAINT "DemoVideoProgress_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "DemoVideoProgress" ADD CONSTRAINT "DemoVideoProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
