-- CreateTable : équipe de l'éditeur (accès console fondateur, cross-tenant)
CREATE TABLE "PlatformOperator" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "addedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformOperator_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformOperator_email_key" ON "PlatformOperator"("email");
