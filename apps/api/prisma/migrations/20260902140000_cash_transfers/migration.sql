DO $$ BEGIN
  CREATE TYPE "TransferDirection" AS ENUM ('IN', 'OUT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "CashTransfer" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "direction" "TransferDirection" NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DECIMAL(12, 2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "branchId" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashTransfer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CashTransfer_tenantId_date_idx" ON "CashTransfer"("tenantId", "date");
CREATE INDEX IF NOT EXISTS "CashTransfer_tenantId_branchId_idx" ON "CashTransfer"("tenantId", "branchId");

DO $$ BEGIN
  ALTER TABLE "CashTransfer" ADD CONSTRAINT "CashTransfer_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
