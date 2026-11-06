-- Essai gratuit porte a 7 jours (demande du fondateur, 06/11/2026).
-- Reste modifiable ensuite depuis la console fondateur.
ALTER TABLE "PlatformSettings" ALTER COLUMN "trialDurationMinutes" SET DEFAULT 10080;
INSERT INTO "PlatformSettings" ("id", "trialDurationMinutes", "updatedAt") VALUES ('default', 10080, NOW())
ON CONFLICT ("id") DO UPDATE SET "trialDurationMinutes" = 10080, "updatedAt" = NOW();
