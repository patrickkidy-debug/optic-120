-- Chaîne métier assurance : Contrat → Garantie → Bénéficiaire → Prise en
-- charge → Remboursement. Aucune colonne existante n'est supprimée :
-- `Insurer.coveragePercent` reste en place et sert désormais de repli.
-- Le script est idempotent (rejouable sans doublon ni erreur).

DO $$ BEGIN
  CREATE TYPE "InsuranceContractStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'EXPIRED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "InsuranceClaimStatus" AS ENUM (
    'DRAFT', 'PENDING', 'ACCEPTED', 'PARTIALLY_ACCEPTED',
    'REJECTED', 'INVOICED', 'PARTIALLY_PAID', 'PAID'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

/* ---------------------------- Contrats ---------------------------- */

CREATE TABLE IF NOT EXISTS "InsuranceContract" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "insurerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "reference" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "status" "InsuranceContractStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InsuranceContract_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "InsuranceContract_tenantId_idx" ON "InsuranceContract"("tenantId");
CREATE INDEX IF NOT EXISTS "InsuranceContract_tenantId_insurerId_idx" ON "InsuranceContract"("tenantId", "insurerId");

DO $$ BEGIN
  ALTER TABLE "InsuranceContract" ADD CONSTRAINT "InsuranceContract_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "InsuranceContract" ADD CONSTRAINT "InsuranceContract_insurerId_fkey"
    FOREIGN KEY ("insurerId") REFERENCES "Insurer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

/* ---------------------------- Garanties ---------------------------- */

CREATE TABLE IF NOT EXISTS "InsuranceGuarantee" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "coveragePercent" INTEGER NOT NULL DEFAULT 0,
    "ceilingAmount" DECIMAL(12, 2),
    "maxAmount" DECIMAL(12, 2),
    "deductibleAmount" DECIMAL(12, 2),
    "conditions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InsuranceGuarantee_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InsuranceGuarantee_contractId_category_key"
  ON "InsuranceGuarantee"("contractId", "category");
CREATE INDEX IF NOT EXISTS "InsuranceGuarantee_tenantId_idx" ON "InsuranceGuarantee"("tenantId");

DO $$ BEGIN
  ALTER TABLE "InsuranceGuarantee" ADD CONSTRAINT "InsuranceGuarantee_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "InsuranceGuarantee" ADD CONSTRAINT "InsuranceGuarantee_contractId_fkey"
    FOREIGN KEY ("contractId") REFERENCES "InsuranceContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

/* -------------------------- Bénéficiaires -------------------------- */

CREATE TABLE IF NOT EXISTS "InsuranceBeneficiary" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "membershipNumber" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InsuranceBeneficiary_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InsuranceBeneficiary_contractId_customerId_key"
  ON "InsuranceBeneficiary"("contractId", "customerId");
CREATE INDEX IF NOT EXISTS "InsuranceBeneficiary_tenantId_idx" ON "InsuranceBeneficiary"("tenantId");
CREATE INDEX IF NOT EXISTS "InsuranceBeneficiary_tenantId_customerId_idx" ON "InsuranceBeneficiary"("tenantId", "customerId");

DO $$ BEGIN
  ALTER TABLE "InsuranceBeneficiary" ADD CONSTRAINT "InsuranceBeneficiary_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "InsuranceBeneficiary" ADD CONSTRAINT "InsuranceBeneficiary_contractId_fkey"
    FOREIGN KEY ("contractId") REFERENCES "InsuranceContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "InsuranceBeneficiary" ADD CONSTRAINT "InsuranceBeneficiary_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

/* ------------------------- Prises en charge ------------------------ */

CREATE TABLE IF NOT EXISTS "InsuranceClaim" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "insurerId" TEXT NOT NULL,
    "contractId" TEXT,
    "beneficiaryId" TEXT,
    "customerId" TEXT,
    "saleId" TEXT,
    "status" "InsuranceClaimStatus" NOT NULL DEFAULT 'PENDING',
    "totalAmount" DECIMAL(12, 2) NOT NULL DEFAULT 0,
    "requestedAmount" DECIMAL(12, 2) NOT NULL DEFAULT 0,
    "acceptedAmount" DECIMAL(12, 2) NOT NULL DEFAULT 0,
    "patientAmount" DECIMAL(12, 2) NOT NULL DEFAULT 0,
    "paidAmount" DECIMAL(12, 2) NOT NULL DEFAULT 0,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InsuranceClaim_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InsuranceClaim_saleId_key" ON "InsuranceClaim"("saleId");
CREATE UNIQUE INDEX IF NOT EXISTS "InsuranceClaim_tenantId_number_key" ON "InsuranceClaim"("tenantId", "number");
CREATE INDEX IF NOT EXISTS "InsuranceClaim_tenantId_status_idx" ON "InsuranceClaim"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "InsuranceClaim_tenantId_insurerId_idx" ON "InsuranceClaim"("tenantId", "insurerId");
CREATE INDEX IF NOT EXISTS "InsuranceClaim_tenantId_dueAt_idx" ON "InsuranceClaim"("tenantId", "dueAt");

DO $$ BEGIN
  ALTER TABLE "InsuranceClaim" ADD CONSTRAINT "InsuranceClaim_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "InsuranceClaim" ADD CONSTRAINT "InsuranceClaim_insurerId_fkey"
    FOREIGN KEY ("insurerId") REFERENCES "Insurer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "InsuranceClaim" ADD CONSTRAINT "InsuranceClaim_contractId_fkey"
    FOREIGN KEY ("contractId") REFERENCES "InsuranceContract"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "InsuranceClaim" ADD CONSTRAINT "InsuranceClaim_beneficiaryId_fkey"
    FOREIGN KEY ("beneficiaryId") REFERENCES "InsuranceBeneficiary"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "InsuranceClaim" ADD CONSTRAINT "InsuranceClaim_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "InsuranceClaim" ADD CONSTRAINT "InsuranceClaim_saleId_fkey"
    FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

/* -------------------------- Remboursements ------------------------- */

CREATE TABLE IF NOT EXISTS "InsuranceRefund" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "insurerId" TEXT NOT NULL,
    "expectedAmount" DECIMAL(12, 2) NOT NULL DEFAULT 0,
    "receivedAmount" DECIMAL(12, 2) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reference" TEXT,
    "method" "PaymentMethod",
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InsuranceRefund_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "InsuranceRefund_tenantId_receivedAt_idx" ON "InsuranceRefund"("tenantId", "receivedAt");
CREATE INDEX IF NOT EXISTS "InsuranceRefund_tenantId_insurerId_idx" ON "InsuranceRefund"("tenantId", "insurerId");
CREATE INDEX IF NOT EXISTS "InsuranceRefund_claimId_idx" ON "InsuranceRefund"("claimId");

DO $$ BEGIN
  ALTER TABLE "InsuranceRefund" ADD CONSTRAINT "InsuranceRefund_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "InsuranceRefund" ADD CONSTRAINT "InsuranceRefund_claimId_fkey"
    FOREIGN KEY ("claimId") REFERENCES "InsuranceClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "InsuranceRefund" ADD CONSTRAINT "InsuranceRefund_insurerId_fkey"
    FOREIGN KEY ("insurerId") REFERENCES "Insurer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

/* =================================================================== */
/* REPRISE DES DONNÉES EXISTANTES                                       */
/* Rien n'est supprimé : le taux porté par l'assureur devient un contrat */
/* par défaut, et chaque vente assurée devient un dossier.              */
/* =================================================================== */

-- 1 et 2. Un contrat par défaut pour chaque assureur ayant un taux renseigné,
-- portant une garantie « toutes catégories » à ce même taux. Les deux inserts
-- sont liés par une CTE : la garantie ne peut se greffer que sur le contrat
-- que cette migration vient de créer, jamais sur un contrat saisi ensuite.
WITH created AS (
  INSERT INTO "InsuranceContract" ("id", "tenantId", "insurerId", "name", "status", "notes", "createdAt", "updatedAt")
  SELECT
      gen_random_uuid()::text,
      i."tenantId",
      i."id",
      'Contrat par défaut',
      'ACTIVE',
      'Créé automatiquement à partir du taux de prise en charge de l''assureur.',
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
  FROM "Insurer" i
  WHERE i."coveragePercent" > 0
    AND NOT EXISTS (SELECT 1 FROM "InsuranceContract" c WHERE c."insurerId" = i."id")
  RETURNING "id", "tenantId", "insurerId"
)
INSERT INTO "InsuranceGuarantee" ("id", "tenantId", "contractId", "category", "coveragePercent", "conditions", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    c."tenantId",
    c."id",
    'ALL',
    i."coveragePercent",
    'Reprise du taux de prise en charge saisi sur l''assureur.',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM created c
JOIN "Insurer" i ON i."id" = c."insurerId";

-- 3. Un dossier par vente déjà prise en charge. La numérotation reprend
--    l'ordre chronologique, par établissement.
INSERT INTO "InsuranceClaim" (
    "id", "tenantId", "number", "insurerId", "customerId", "saleId", "status",
    "totalAmount", "requestedAmount", "acceptedAmount", "patientAmount", "paidAmount",
    "requestedAt", "acceptedAt", "dueAt", "notes", "createdAt", "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    s."tenantId",
    -- Numérotation reprise dans l'ordre chronologique, décalée par les dossiers
    -- déjà présents : le script reste rejouable sans heurter l'unicité.
    'PEC-' || to_char(s."createdAt", 'YYYY') || '-' || lpad(
      (
        row_number() OVER (PARTITION BY s."tenantId", to_char(s."createdAt", 'YYYY') ORDER BY s."createdAt")
        + (
          SELECT count(*) FROM "InsuranceClaim" x
          WHERE x."tenantId" = s."tenantId"
            AND x."number" LIKE 'PEC-' || to_char(s."createdAt", 'YYYY') || '-%'
        )
      )::text, 5, '0'
    ),
    s."insurerId",
    s."customerId",
    s."id",
    CASE
      WHEN s."insurerPaidAmount" >= s."insuranceAmount" THEN 'PAID'::"InsuranceClaimStatus"
      WHEN s."insurerPaidAmount" > 0 THEN 'PARTIALLY_PAID'::"InsuranceClaimStatus"
      ELSE 'INVOICED'::"InsuranceClaimStatus"
    END,
    s."totalAmount",
    s."insuranceAmount",
    s."insuranceAmount",
    GREATEST(0, s."totalAmount" - s."insuranceAmount"),
    LEAST(s."insurerPaidAmount", s."insuranceAmount"),
    s."createdAt",
    s."createdAt",
    date_trunc('month', s."createdAt") + INTERVAL '1 month',
    'Reprise de l''historique des ventes.',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Sale" s
WHERE s."insurerId" IS NOT NULL
  AND s."insuranceAmount" > 0
  AND s."type" = 'SALE'
  AND s."status" <> 'CANCELLED'
  AND NOT EXISTS (SELECT 1 FROM "InsuranceClaim" ic WHERE ic."saleId" = s."id");

-- 4. Le journal des remboursements reprend ce qui avait déjà été encaissé,
--    pour que « reçu » reste cohérent entre les deux modèles.
INSERT INTO "InsuranceRefund" (
    "id", "tenantId", "claimId", "insurerId", "expectedAmount", "receivedAmount",
    "receivedAt", "notes", "createdAt"
)
SELECT
    gen_random_uuid()::text,
    c."tenantId",
    c."id",
    c."insurerId",
    c."acceptedAmount",
    c."paidAmount",
    COALESCE(s."insurerPaidAt", c."requestedAt"),
    'Reprise historique',
    CURRENT_TIMESTAMP
FROM "InsuranceClaim" c
LEFT JOIN "Sale" s ON s."id" = c."saleId"
WHERE c."paidAmount" > 0
  AND NOT EXISTS (SELECT 1 FROM "InsuranceRefund" r WHERE r."claimId" = c."id");
