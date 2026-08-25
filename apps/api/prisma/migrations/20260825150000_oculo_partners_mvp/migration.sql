-- OculoPartners MVP: identities, attribution and first-payment commissions.
CREATE TYPE "PartnerStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED');
CREATE TYPE "PartnerTierCode" AS ENUM ('AMBASSADOR', 'PARTNER_PRO', 'PARTNER_EXPERT');
CREATE TYPE "PartnerLeadStatus" AS ENUM ('NEW', 'CONTACTED', 'DEMO', 'TRIAL', 'SUBSCRIBED', 'LOST');
CREATE TYPE "PartnerCommissionStatus" AS ENUM ('PENDING', 'APPROVED', 'PAYABLE', 'PAID', 'CANCELLED', 'REVERSED');

CREATE TABLE "Partner" (
  "id" TEXT NOT NULL, "firstName" TEXT NOT NULL, "lastName" TEXT NOT NULL,
  "email" TEXT NOT NULL, "whatsapp" TEXT NOT NULL, "countryCode" TEXT, "city" TEXT,
  "passwordHash" TEXT NOT NULL, "referralCode" TEXT NOT NULL,
  "status" "PartnerStatus" NOT NULL DEFAULT 'PENDING',
  "tier" "PartnerTierCode" NOT NULL DEFAULT 'AMBASSADOR',
  "payoutMethod" TEXT, "payoutDetails" JSONB, "termsAcceptedAt" TIMESTAMP(3) NOT NULL,
  "approvedAt" TIMESTAMP(3), "suspendedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Partner_email_key" ON "Partner"("email");
CREATE UNIQUE INDEX "Partner_whatsapp_key" ON "Partner"("whatsapp");
CREATE UNIQUE INDEX "Partner_referralCode_key" ON "Partner"("referralCode");

CREATE TABLE "PartnerSession" (
  "id" TEXT NOT NULL, "partnerId" TEXT NOT NULL, "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL, "revokedAt" TIMESTAMP(3), "userAgent" TEXT, "ipAddress" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "PartnerSession_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PartnerSession_tokenHash_key" ON "PartnerSession"("tokenHash");
CREATE INDEX "PartnerSession_partnerId_idx" ON "PartnerSession"("partnerId");

CREATE TABLE "PartnerAttribution" (
  "id" TEXT NOT NULL, "partnerId" TEXT NOT NULL, "referralCode" TEXT NOT NULL,
  "visitorId" TEXT, "tenantId" TEXT, "emailHash" TEXT, "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL, "linkedAt" TIMESTAMP(3), "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PartnerAttribution_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PartnerAttribution_tenantId_key" ON "PartnerAttribution"("tenantId");
CREATE INDEX "PartnerAttribution_partnerId_expiresAt_idx" ON "PartnerAttribution"("partnerId", "expiresAt");
CREATE INDEX "PartnerAttribution_referralCode_idx" ON "PartnerAttribution"("referralCode");
CREATE INDEX "PartnerAttribution_visitorId_idx" ON "PartnerAttribution"("visitorId");

CREATE TABLE "PartnerLead" (
  "id" TEXT NOT NULL, "partnerId" TEXT NOT NULL, "establishmentName" TEXT NOT NULL, "contactName" TEXT,
  "phone" TEXT, "email" TEXT, "countryCode" TEXT, "city" TEXT, "source" TEXT NOT NULL DEFAULT 'MANUAL',
  "status" "PartnerLeadStatus" NOT NULL DEFAULT 'NEW', "tenantId" TEXT, "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PartnerLead_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PartnerLead_tenantId_key" ON "PartnerLead"("tenantId");
CREATE INDEX "PartnerLead_partnerId_status_idx" ON "PartnerLead"("partnerId", "status");

CREATE TABLE "PartnerCommissionRule" (
  "id" TEXT NOT NULL, "planCode" TEXT NOT NULL, "tier" "PartnerTierCode" NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL, "currency" TEXT NOT NULL DEFAULT 'XOF', "isActive" BOOLEAN NOT NULL DEFAULT true,
  "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "effectiveTo" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PartnerCommissionRule_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PartnerCommissionRule_planCode_tier_isActive_idx" ON "PartnerCommissionRule"("planCode", "tier", "isActive");

CREATE TABLE "PartnerCommission" (
  "id" TEXT NOT NULL, "partnerId" TEXT NOT NULL, "tenantId" TEXT NOT NULL,
  "subscriptionPaymentId" TEXT NOT NULL, "subscriptionInvoiceId" TEXT NOT NULL, "planCode" TEXT NOT NULL,
  "customerAmount" DECIMAL(12,2) NOT NULL, "amount" DECIMAL(12,2) NOT NULL, "currency" TEXT NOT NULL DEFAULT 'XOF',
  "status" "PartnerCommissionStatus" NOT NULL DEFAULT 'PENDING', "ruleSnapshot" JSONB NOT NULL,
  "approvedAt" TIMESTAMP(3), "payableAt" TIMESTAMP(3), "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PartnerCommission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PartnerCommission_subscriptionPaymentId_key" ON "PartnerCommission"("subscriptionPaymentId");
CREATE UNIQUE INDEX "PartnerCommission_subscriptionInvoiceId_key" ON "PartnerCommission"("subscriptionInvoiceId");
CREATE INDEX "PartnerCommission_partnerId_status_idx" ON "PartnerCommission"("partnerId", "status");
CREATE INDEX "PartnerCommission_tenantId_idx" ON "PartnerCommission"("tenantId");

CREATE TABLE "PartnerEvent" (
  "id" TEXT NOT NULL, "type" TEXT NOT NULL, "idempotencyKey" TEXT NOT NULL, "payload" JSONB NOT NULL,
  "processedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PartnerEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PartnerEvent_idempotencyKey_key" ON "PartnerEvent"("idempotencyKey");
CREATE INDEX "PartnerEvent_type_createdAt_idx" ON "PartnerEvent"("type", "createdAt");

CREATE TABLE "PartnerAuditLog" (
  "id" TEXT NOT NULL, "partnerId" TEXT, "actorType" TEXT NOT NULL, "actorId" TEXT, "action" TEXT NOT NULL,
  "entity" TEXT, "entityId" TEXT, "before" JSONB, "after" JSONB, "ipAddress" TEXT, "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "PartnerAuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PartnerAuditLog_partnerId_createdAt_idx" ON "PartnerAuditLog"("partnerId", "createdAt");
CREATE INDEX "PartnerAuditLog_action_createdAt_idx" ON "PartnerAuditLog"("action", "createdAt");

ALTER TABLE "PartnerSession" ADD CONSTRAINT "PartnerSession_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartnerAttribution" ADD CONSTRAINT "PartnerAttribution_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartnerLead" ADD CONSTRAINT "PartnerLead_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartnerCommission" ADD CONSTRAINT "PartnerCommission_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartnerAuditLog" ADD CONSTRAINT "PartnerAuditLog_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
