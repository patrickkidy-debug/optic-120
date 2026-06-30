-- AlterTable : connexion via Google (Sign in with Google)
ALTER TABLE "User" ADD COLUMN     "googleId" TEXT;

CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");
