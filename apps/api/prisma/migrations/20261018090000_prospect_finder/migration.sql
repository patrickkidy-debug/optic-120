-- Agent de prospection : nouvelle source et identifiant de fiche externe.
ALTER TYPE "ProspectSource" ADD VALUE 'AUTO_SEARCH';
ALTER TABLE "Prospect" ADD COLUMN "externalId" TEXT;
CREATE UNIQUE INDEX "Prospect_externalId_key" ON "Prospect"("externalId");
