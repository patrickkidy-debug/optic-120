-- Module de facturation et reçus de paiement (console fondateur).
--
-- STRICTEMENT ADDITIVE. Aucune colonne existante n'est supprimée ni renommée,
-- aucune ligne n'est supprimée. Les factures, paiements et abonnements déjà en
-- base restent valides tels quels : le backfill en fin de fichier se contente
-- de renseigner les nouvelles colonnes à partir des données existantes, en ne
-- touchant que les lignes où elles sont encore à leur valeur par défaut.

-- 1. Nouveaux statuts de facture. Les quatre existants (PENDING, PAID, FAILED,
--    VOID) sont conservés : une facture déjà PAID reste PAID.
DO $$ BEGIN ALTER TYPE "SubInvoiceStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_PAID'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "SubInvoiceStatus" ADD VALUE IF NOT EXISTS 'CANCELLED'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "SubInvoiceStatus" ADD VALUE IF NOT EXISTS 'REFUNDED'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "SubInvoiceStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_REFUNDED'; EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SubInvoiceKind" AS ENUM ('INVOICE', 'CREDIT_NOTE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Colonnes de la facture.
ALTER TABLE "SubscriptionInvoice"
  ADD COLUMN IF NOT EXISTS "kind" "SubInvoiceKind" NOT NULL DEFAULT 'INVOICE',
  ADD COLUMN IF NOT EXISTS "creditedInvoiceId" TEXT,
  ADD COLUMN IF NOT EXISTS "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "tax" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "amountPaid" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "amountRefunded" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "billingName" TEXT,
  ADD COLUMN IF NOT EXISTS "billingContact" TEXT,
  ADD COLUMN IF NOT EXISTS "billingWhatsapp" TEXT,
  ADD COLUMN IF NOT EXISTS "billingEmail" TEXT,
  ADD COLUMN IF NOT EXISTS "billingAddress" TEXT,
  ADD COLUMN IF NOT EXISTS "billingCity" TEXT,
  ADD COLUMN IF NOT EXISTS "billingCountry" TEXT,
  ADD COLUMN IF NOT EXISTS "notes" TEXT,
  ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'AUTO',
  ADD COLUMN IF NOT EXISTS "issuedById" TEXT,
  ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cancelReason" TEXT;

CREATE INDEX IF NOT EXISTS "SubscriptionInvoice_status_idx" ON "SubscriptionInvoice"("status");
CREATE INDEX IF NOT EXISTS "SubscriptionInvoice_dueDate_idx" ON "SubscriptionInvoice"("dueDate");

-- 3. Colonnes du paiement.
ALTER TABLE "SubscriptionPayment"
  ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "notes" TEXT,
  ADD COLUMN IF NOT EXISTS "recordedById" TEXT;

-- 4. Lignes de facture.
CREATE TABLE IF NOT EXISTS "SubscriptionInvoiceItem" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "periodLabel" TEXT,
  "quantity" DECIMAL(12,2) NOT NULL DEFAULT 1,
  "unitPrice" DECIMAL(12,2) NOT NULL,
  "total" DECIMAL(12,2) NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "SubscriptionInvoiceItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SubscriptionInvoiceItem_invoiceId_idx" ON "SubscriptionInvoiceItem"("invoiceId");
DO $$ BEGIN
  ALTER TABLE "SubscriptionInvoiceItem"
    ADD CONSTRAINT "SubscriptionInvoiceItem_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "SubscriptionInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 5. Remboursements.
CREATE TABLE IF NOT EXISTS "SubscriptionRefund" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "paymentId" TEXT,
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'XOF',
  "reason" TEXT NOT NULL,
  "method" "PaymentMethod",
  "reference" TEXT,
  "refundedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubscriptionRefund_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SubscriptionRefund_invoiceId_idx" ON "SubscriptionRefund"("invoiceId");
CREATE INDEX IF NOT EXISTS "SubscriptionRefund_tenantId_idx" ON "SubscriptionRefund"("tenantId");
DO $$ BEGIN
  ALTER TABLE "SubscriptionRefund"
    ADD CONSTRAINT "SubscriptionRefund_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "SubscriptionInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 6. Journal de facture.
CREATE TABLE IF NOT EXISTS "InvoiceEvent" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "actorId" TEXT,
  "actorName" TEXT,
  "reference" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InvoiceEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "InvoiceEvent_invoiceId_createdAt_idx" ON "InvoiceEvent"("invoiceId", "createdAt");
DO $$ BEGIN
  ALTER TABLE "InvoiceEvent"
    ADD CONSTRAINT "InvoiceEvent_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "SubscriptionInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 7. Paramètres de facturation de l'éditeur (ligne unique).
CREATE TABLE IF NOT EXISTS "PlatformBillingSettings" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "legalName" TEXT,
  "tradeName" TEXT,
  "address" TEXT,
  "city" TEXT,
  "country" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "website" TEXT,
  "taxId" TEXT,
  "registrationNumber" TEXT,
  "defaultCurrency" TEXT NOT NULL DEFAULT 'XOF',
  "paymentTerms" TEXT,
  "paymentDetails" TEXT,
  "logoUrl" TEXT,
  "footerNote" TEXT,
  "whatsappNumber" TEXT,
  "autoSendOnPayment" BOOLEAN NOT NULL DEFAULT false,
  "remindBeforeDue" BOOLEAN NOT NULL DEFAULT false,
  "remindAfterDue" BOOLEAN NOT NULL DEFAULT false,
  "sendPaymentConfirmation" BOOLEAN NOT NULL DEFAULT false,
  "remindBeforeDays" INTEGER NOT NULL DEFAULT 3,
  "invoiceWhatsappTemplate" TEXT,
  "reminderBeforeTemplate" TEXT,
  "reminderDueTemplate" TEXT,
  "reminderAfterTemplate" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformBillingSettings_pkey" PRIMARY KEY ("id")
);

-- 8. Compteur de numérotation global (séries FAC-AAAA, AV-AAAA).
CREATE TABLE IF NOT EXISTS "PlatformCounter" (
  "series" TEXT NOT NULL,
  "value" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformCounter_pkey" PRIMARY KEY ("series")
);

-- ---------------------------------------------------------------------------
-- 9. RATTACHEMENT DE L'EXISTANT (§33)
--
-- Chaque UPDATE est conditionné sur la valeur par défaut de la nouvelle
-- colonne : rejouable sans effet de bord, et sans jamais écraser une saisie
-- ultérieure du fondateur.
-- ---------------------------------------------------------------------------

-- Le total des factures existantes devient aussi leur sous-total : aucune
-- remise ni taxe n'était saisissable auparavant, la décomposition est donc
-- exacte et non inventée.
UPDATE "SubscriptionInvoice" SET "subtotal" = "amount" WHERE "subtotal" = 0;

-- Une facture déjà payée a, par définition, été encaissée en totalité : c'est
-- le seul état que l'ancien modèle savait représenter.
UPDATE "SubscriptionInvoice" SET "amountPaid" = "amount"
  WHERE "status" = 'PAID' AND "amountPaid" = 0;

-- Date réelle d'encaissement des paiements réussis : celle de la facture.
UPDATE "SubscriptionPayment" p SET "paidAt" = i."paidAt"
  FROM "SubscriptionInvoice" i
  WHERE p."invoiceId" = i."id" AND p."status" = 'SUCCESS'
    AND p."paidAt" IS NULL AND i."paidAt" IS NOT NULL;

-- Coordonnées de facturation figées à partir de l'établissement, uniquement
-- quand elles existent (aucune valeur inventée).
UPDATE "SubscriptionInvoice" i SET
  "billingName" = t."name",
  "billingWhatsapp" = COALESCE(t."whatsappPhone", t."contactPhone"),
  "billingEmail" = t."contactEmail",
  "billingAddress" = t."location",
  "billingCountry" = t."countryCode"
  FROM "Tenant" t
  WHERE i."tenantId" = t."id" AND i."billingName" IS NULL;

-- Une ligne de facture par facture existante, décrivant l'abonnement facturé.
INSERT INTO "SubscriptionInvoiceItem" ("id", "invoiceId", "description", "periodLabel", "quantity", "unitPrice", "total", "sortOrder")
SELECT
  gen_random_uuid()::text,
  i."id",
  'Abonnement OculoSaaS — ' || p."name",
  to_char(i."periodStart", 'DD/MM/YYYY') || ' → ' || to_char(i."periodEnd", 'DD/MM/YYYY'),
  1,
  i."amount",
  i."amount",
  0
FROM "SubscriptionInvoice" i
JOIN "SubscriptionPlan" p ON p."id" = i."planId"
WHERE NOT EXISTS (
  SELECT 1 FROM "SubscriptionInvoiceItem" it WHERE it."invoiceId" = i."id"
);

-- Journal : une entrée d'émission pour chaque facture existante, et une entrée
-- de règlement pour celles déjà payées, afin que l'onglet « Historique » ne
-- démarre pas vide sur le parc actuel.
INSERT INTO "InvoiceEvent" ("id", "invoiceId", "type", "message", "createdAt")
SELECT gen_random_uuid()::text, i."id", 'CREATED', 'Facture émise', i."createdAt"
FROM "SubscriptionInvoice" i
WHERE NOT EXISTS (
  SELECT 1 FROM "InvoiceEvent" e WHERE e."invoiceId" = i."id" AND e."type" = 'CREATED'
);

INSERT INTO "InvoiceEvent" ("id", "invoiceId", "type", "message", "createdAt")
SELECT gen_random_uuid()::text, i."id", 'PAID', 'Paiement confirmé', i."paidAt"
FROM "SubscriptionInvoice" i
WHERE i."status" = 'PAID' AND i."paidAt" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "InvoiceEvent" e WHERE e."invoiceId" = i."id" AND e."type" = 'PAID'
  );
