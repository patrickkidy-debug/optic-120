-- OculoRX : catalogue verres fournisseurs, commandes, relevés mensuels, réglages.
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "code" TEXT;
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "orderEmail" TEXT;
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "rxCoefficient" DOUBLE PRECISION;
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "rxVatRate" DOUBLE PRECISION;
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "rxDemo" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "RxLens" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "geometry" TEXT NOT NULL,
    "lensIndex" DOUBLE PRECISION,
    "material" TEXT,
    "treatment" TEXT,
    "diameter" INTEGER,
    "sphMin" DOUBLE PRECISION,
    "sphMax" DOUBLE PRECISION,
    "cylMax" DOUBLE PRECISION,
    "addMin" DOUBLE PRECISION,
    "addMax" DOUBLE PRECISION,
    "purchasePrice" INTEGER NOT NULL,
    "priceHistory" JSONB NOT NULL DEFAULT '[]',
    "priceUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RxLens_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "RxLens_tenantId_supplierId_reference_key" ON "RxLens"("tenantId", "supplierId", "reference");
CREATE INDEX IF NOT EXISTS "RxLens_tenantId_supplierId_idx" ON "RxLens"("tenantId", "supplierId");

CREATE TABLE IF NOT EXISTS "RxOrder" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "branchId" TEXT,
    "userId" TEXT,
    "userName" TEXT,
    "supplierId" TEXT NOT NULL,
    "lensId" TEXT,
    "lensSnapshot" JSONB NOT NULL,
    "customerId" TEXT,
    "patientName" TEXT NOT NULL,
    "fileNumber" TEXT,
    "od" JSONB NOT NULL,
    "og" JSONB NOT NULL,
    "addition" DOUBLE PRECISION,
    "pd" DOUBLE PRECISION,
    "height" DOUBLE PRECISION,
    "frameType" TEXT,
    "mounted" BOOLEAN NOT NULL DEFAULT false,
    "urgent" BOOLEAN NOT NULL DEFAULT false,
    "comment" TEXT,
    "purchasePrice" INTEGER NOT NULL,
    "supplements" JSONB NOT NULL DEFAULT '[]',
    "salePrice" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "statusHistory" JSONB NOT NULL DEFAULT '[]',
    "saleId" TEXT,
    "lensOrderId" TEXT,
    "emailSentAt" TIMESTAMP(3),
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RxOrder_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "RxOrder_tenantId_number_key" ON "RxOrder"("tenantId", "number");
CREATE INDEX IF NOT EXISTS "RxOrder_tenantId_createdAt_idx" ON "RxOrder"("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "RxOrder_tenantId_supplierId_idx" ON "RxOrder"("tenantId", "supplierId");
CREATE INDEX IF NOT EXISTS "RxOrder_lensOrderId_idx" ON "RxOrder"("lensOrderId");

CREATE TABLE IF NOT EXISTS "RxStatement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "totalHt" INTEGER NOT NULL,
    "vatRate" DOUBLE PRECISION NOT NULL,
    "vatAmount" INTEGER NOT NULL,
    "totalTtc" INTEGER NOT NULL,
    "orderCount" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    "paymentMethod" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "RxStatement_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "RxStatement_tenantId_supplierId_month_key" ON "RxStatement"("tenantId", "supplierId", "month");
CREATE INDEX IF NOT EXISTS "RxStatement_tenantId_month_idx" ON "RxStatement"("tenantId", "month");

CREATE TABLE IF NOT EXISTS "RxSettings" (
    "tenantId" TEXT NOT NULL,
    "coefficient" DOUBLE PRECISION NOT NULL DEFAULT 2.8,
    "geometryCoefficients" JSONB NOT NULL DEFAULT '{}',
    "vatRate" DOUBLE PRECISION NOT NULL DEFAULT 18,
    "mountedFee" INTEGER NOT NULL DEFAULT 2500,
    "urgentFee" INTEGER NOT NULL DEFAULT 3000,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RxSettings_pkey" PRIMARY KEY ("tenantId")
);

DO $$ BEGIN
  ALTER TABLE "RxLens" ADD CONSTRAINT "RxLens_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "RxLens" ADD CONSTRAINT "RxLens_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "RxOrder" ADD CONSTRAINT "RxOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "RxOrder" ADD CONSTRAINT "RxOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "RxOrder" ADD CONSTRAINT "RxOrder_lensId_fkey" FOREIGN KEY ("lensId") REFERENCES "RxLens"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "RxOrder" ADD CONSTRAINT "RxOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "RxStatement" ADD CONSTRAINT "RxStatement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "RxStatement" ADD CONSTRAINT "RxStatement_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "RxSettings" ADD CONSTRAINT "RxSettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Même verrou que les autres tables (API publique de Supabase) : RLS sans règle.
ALTER TABLE "RxLens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RxOrder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RxStatement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RxSettings" ENABLE ROW LEVEL SECURITY;
