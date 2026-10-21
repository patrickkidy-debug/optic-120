-- Comptes de paiement (banque, mobile money…), virements de compte à compte
-- et justificatifs en liens (aucun fichier stocké chez OculoSaaS).
ALTER TABLE "BankAccount"
  ADD COLUMN "type" VARCHAR(20) NOT NULL DEFAULT 'BANK',
  ADD COLUMN "provider" VARCHAR(30),
  ADD COLUMN "phoneNumber" VARCHAR(40);

ALTER TABLE "CashTransfer"
  ADD COLUMN "toAccountId" TEXT,
  ADD COLUMN "links" JSONB;

ALTER TABLE "Expense" ADD COLUMN "links" JSONB;

ALTER TABLE "CashTransfer" ADD CONSTRAINT "CashTransfer_toAccountId_fkey" FOREIGN KEY ("toAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
