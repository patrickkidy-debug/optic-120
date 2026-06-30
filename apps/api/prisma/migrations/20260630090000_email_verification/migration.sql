-- AlterTable : confirmation d'adresse email
ALTER TABLE "User" ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN     "verifyTokenHash" TEXT;
ALTER TABLE "User" ADD COLUMN     "verifyTokenExpiresAt" TIMESTAMP(3);

-- Les comptes existants sont considérés vérifiés (pas de blocage rétroactif).
UPDATE "User" SET "emailVerifiedAt" = CURRENT_TIMESTAMP WHERE "emailVerifiedAt" IS NULL;
