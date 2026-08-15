CREATE TABLE IF NOT EXISTS "PlatformSettings" (
    "id" TEXT NOT NULL,
    "trialDurationMinutes" INTEGER NOT NULL DEFAULT 120,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "PlatformSettings" ("id", "trialDurationMinutes", "updatedAt")
VALUES ('default', 120, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
