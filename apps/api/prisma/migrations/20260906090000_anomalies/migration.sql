-- Module Anomalies & corrections. Aucune table existante n'est touchée :
-- Anomaly référence sa cible (targetEntity/targetId) sans contrainte FK, comme
-- StockMovement.saleId déjà dans ce schéma. Idempotent (rejouable sans erreur).

DO $$ BEGIN
  CREATE TYPE "AnomalyCategory" AS ENUM (
    'VENTE', 'DEVIS', 'PRODUIT', 'STOCK', 'CAISSE', 'PAIEMENT',
    'COMMANDE_VERRES', 'CLIENT', 'SAV', 'ASSURANCE'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "AnomalyStatus" AS ENUM (
    'DECLARED', 'PENDING_VALIDATION', 'APPROVED', 'REJECTED', 'CORRECTED', 'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "AnomalyCorrectionType" AS ENUM (
    'FIELD_CORRECTION', 'STOCK_ADJUSTMENT', 'SALE_CANCELLATION',
    'PRODUCT_RETURN', 'PAYMENT_REVERSAL', 'REFUND_CORRECTION'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "AnomalyReasonCode" AS ENUM (
    'DATA_ENTRY_ERROR', 'PRICE_ERROR', 'QUANTITY_ERROR', 'WRONG_PRODUCT',
    'WRONG_CUSTOMER', 'PAYMENT_ERROR', 'DUPLICATE', 'OMISSION',
    'SUSPECTED_FRAUD', 'SYSTEM_ERROR', 'OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "AnomalyTargetEntity" AS ENUM (
    'SALE', 'PRODUCT', 'STOCK_ITEM', 'CASH_REGISTER', 'PAYMENT', 'LENS_ORDER',
    'CUSTOMER', 'REPAIR', 'INSURANCE_CLAIM', 'INSURANCE_REFUND'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "Anomaly" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "category" "AnomalyCategory" NOT NULL,
    "correctionType" "AnomalyCorrectionType" NOT NULL,
    "targetEntity" "AnomalyTargetEntity" NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetReference" TEXT NOT NULL,
    "branchId" TEXT,
    "description" VARCHAR(500) NOT NULL,
    "reasonCode" "AnomalyReasonCode" NOT NULL,
    "reasonNote" VARCHAR(1000),
    "comment" VARCHAR(1000),
    "status" "AnomalyStatus" NOT NULL DEFAULT 'DECLARED',
    "financialImpact" DECIMAL(12, 2) NOT NULL DEFAULT 0,
    "stockImpact" INTEGER NOT NULL DEFAULT 0,
    "cashImpact" DECIMAL(12, 2) NOT NULL DEFAULT 0,
    "insuranceImpact" DECIMAL(12, 2) NOT NULL DEFAULT 0,
    "declaredById" TEXT NOT NULL,
    "declaredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvalNote" VARCHAR(1000),
    "rejectedById" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" VARCHAR(1000),
    "appliedById" TEXT,
    "appliedAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" VARCHAR(1000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Anomaly_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Anomaly_tenantId_number_key" ON "Anomaly"("tenantId", "number");
CREATE INDEX IF NOT EXISTS "Anomaly_tenantId_status_idx" ON "Anomaly"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "Anomaly_tenantId_category_idx" ON "Anomaly"("tenantId", "category");
CREATE INDEX IF NOT EXISTS "Anomaly_tenantId_targetEntity_targetId_idx" ON "Anomaly"("tenantId", "targetEntity", "targetId");
CREATE INDEX IF NOT EXISTS "Anomaly_tenantId_declaredAt_idx" ON "Anomaly"("tenantId", "declaredAt");
CREATE INDEX IF NOT EXISTS "Anomaly_tenantId_declaredById_idx" ON "Anomaly"("tenantId", "declaredById");
CREATE INDEX IF NOT EXISTS "Anomaly_branchId_idx" ON "Anomaly"("branchId");

DO $$ BEGIN
  ALTER TABLE "Anomaly" ADD CONSTRAINT "Anomaly_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Anomaly" ADD CONSTRAINT "Anomaly_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Anomaly" ADD CONSTRAINT "Anomaly_declaredById_fkey"
    FOREIGN KEY ("declaredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Anomaly" ADD CONSTRAINT "Anomaly_approvedById_fkey"
    FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Anomaly" ADD CONSTRAINT "Anomaly_rejectedById_fkey"
    FOREIGN KEY ("rejectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Anomaly" ADD CONSTRAINT "Anomaly_appliedById_fkey"
    FOREIGN KEY ("appliedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Anomaly" ADD CONSTRAINT "Anomaly_cancelledById_fkey"
    FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "AnomalyCorrectionEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "anomalyId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "amountImpact" DECIMAL(12, 2),
    "stockImpact" INTEGER,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnomalyCorrectionEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AnomalyCorrectionEntry_tenantId_anomalyId_idx" ON "AnomalyCorrectionEntry"("tenantId", "anomalyId");

DO $$ BEGIN
  ALTER TABLE "AnomalyCorrectionEntry" ADD CONSTRAINT "AnomalyCorrectionEntry_anomalyId_fkey"
    FOREIGN KEY ("anomalyId") REFERENCES "Anomaly"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
