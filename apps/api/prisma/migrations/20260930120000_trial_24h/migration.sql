-- Essai gratuit porte a 24 heures (demande du fondateur, 30/09/2026).
-- Reste modifiable ensuite depuis la console fondateur.
ALTER TABLE "PlatformSettings" ALTER COLUMN "trialDurationMinutes" SET DEFAULT 1440;
UPDATE "PlatformSettings" SET "trialDurationMinutes" = 1440, "updatedAt" = NOW() WHERE "id" = 'default';
