-- Fiche client enrichie (bêta) : civilité, portable, famille, refus des
-- messages, décès, liste « en cours », commentaires et documents joints.
ALTER TABLE "Customer"
  ADD COLUMN "civility" VARCHAR(12),
  ADD COLUMN "mobilePhone" TEXT,
  ADD COLUMN "familyNumber" VARCHAR(40),
  ADD COLUMN "messagingOptOut" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "deceased" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "waitingSince" TIMESTAMP(3);

CREATE TABLE "CustomerComment" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdById" TEXT,
  "authorName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerComment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CustomerComment_tenantId_customerId_createdAt_idx" ON "CustomerComment"("tenantId", "customerId", "createdAt");
ALTER TABLE "CustomerComment" ADD CONSTRAINT "CustomerComment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CustomerDocument" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerDocument_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CustomerDocument_tenantId_customerId_createdAt_idx" ON "CustomerDocument"("tenantId", "customerId", "createdAt");
ALTER TABLE "CustomerDocument" ADD CONSTRAINT "CustomerDocument_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
