CREATE TABLE IF NOT EXISTS "PlatformNotification" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "tenantId" TEXT,
    "tenantName" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformNotification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PlatformNotification_readAt_idx" ON "PlatformNotification"("readAt");
CREATE INDEX IF NOT EXISTS "PlatformNotification_createdAt_idx" ON "PlatformNotification"("createdAt");
