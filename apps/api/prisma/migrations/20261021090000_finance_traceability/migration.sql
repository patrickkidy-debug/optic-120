-- Dépenses / versements : comptes bancaires, détail des mouvements,
-- moyen de paiement, annulation tracée (motif, auteur).
ALTER TABLE "CashTransfer" ADD COLUMN     "affectsCash" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "attachmentUrl" TEXT,
ADD COLUMN     "bankAccountId" TEXT,
ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelledById" TEXT,
ADD COLUMN     "counterparty" VARCHAR(120),
ADD COLUMN     "handledBy" VARCHAR(120),
ADD COLUMN     "kind" VARCHAR(20),
ADD COLUMN     "method" VARCHAR(20),
ADD COLUMN     "reference" VARCHAR(80);

ALTER TABLE "Expense" ADD COLUMN     "affectsCash" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "attachmentUrl" TEXT,
ADD COLUMN     "bankAccountId" TEXT,
ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelledById" TEXT,
ADD COLUMN     "payee" VARCHAR(120),
ADD COLUMN     "paymentSource" VARCHAR(20) NOT NULL DEFAULT 'CASH',
ADD COLUMN     "reference" VARCHAR(80);

CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT,
    "bankName" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "accountNumber" TEXT,
    "iban" TEXT,
    "swift" TEXT,
    "openingBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BankAccount_tenantId_idx" ON "BankAccount"("tenantId");

ALTER TABLE "CashTransfer" ADD CONSTRAINT "CashTransfer_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Expense" ADD CONSTRAINT "Expense_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
