-- CreateEnum
CREATE TYPE "ProspectStatus" AS ENUM ('NEW', 'CONTACTED', 'REPLIED', 'DEMO_SCHEDULED', 'DEMO_COMPLETED', 'TRIAL', 'CUSTOMER', 'LOST');

-- CreateEnum
CREATE TYPE "ProspectSegment" AS ENUM ('DISCOVERY', 'STANDARD', 'PREMIUM');

-- CreateEnum
CREATE TYPE "ProspectPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'HOT');

-- CreateEnum
CREATE TYPE "ProspectSource" AS ENUM ('IMPORT_EXCEL', 'FACEBOOK_ADS', 'WHATSAPP', 'LANDING_PAGE', 'DEMO', 'REFERRAL', 'MANUAL');

-- CreateEnum
CREATE TYPE "WhatsappStatus" AS ENUM ('WHATSAPP_VERIFIED', 'PHONE_VALID_WHATSAPP_UNCONFIRMED', 'PHONE_INVALID', 'VERIFICATION_FAILED');

-- CreateTable
CREATE TABLE "Prospect" (
    "id" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "establishmentName" TEXT NOT NULL,
    "phone" TEXT,
    "phoneNormalized" TEXT,
    "phoneCountry" TEXT,
    "email" TEXT,
    "country" TEXT,
    "city" TEXT,
    "address" TEXT,
    "website" TEXT,
    "segment" "ProspectSegment" NOT NULL DEFAULT 'STANDARD',
    "leadScore" INTEGER NOT NULL DEFAULT 0,
    "scoreOverride" INTEGER,
    "priority" "ProspectPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "ProspectStatus" NOT NULL DEFAULT 'NEW',
    "source" "ProspectSource" NOT NULL DEFAULT 'IMPORT_EXCEL',
    "lastContactAt" TIMESTAMP(3),
    "nextFollowUpAt" TIMESTAMP(3),
    "demoDate" TIMESTAMP(3),
    "demoCompletedAt" TIMESTAMP(3),
    "trialStartDate" TIMESTAMP(3),
    "trialEndDate" TIMESTAMP(3),
    "convertedAt" TIMESTAMP(3),
    "notes" TEXT,
    "whatsappStatus" "WhatsappStatus" NOT NULL DEFAULT 'PHONE_VALID_WHATSAPP_UNCONFIRMED',
    "whatsappVerifiedAt" TIMESTAMP(3),
    "whatsappVerificationError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prospect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProspectEvent" (
    "id" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "metadata" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProspectEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProspectMessageTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProspectMessageTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "demoVideosUrl" TEXT,
    "signupUrl" TEXT,
    "demoBookingUrl" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Prospect_phoneNormalized_key" ON "Prospect"("phoneNormalized");

-- CreateIndex
CREATE INDEX "Prospect_status_idx" ON "Prospect"("status");

-- CreateIndex
CREATE INDEX "Prospect_priority_idx" ON "Prospect"("priority");

-- CreateIndex
CREATE INDEX "Prospect_country_city_idx" ON "Prospect"("country", "city");

-- CreateIndex
CREATE INDEX "Prospect_nextFollowUpAt_idx" ON "Prospect"("nextFollowUpAt");

-- CreateIndex
CREATE INDEX "ProspectEvent_prospectId_createdAt_idx" ON "ProspectEvent"("prospectId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProspectMessageTemplate_key_key" ON "ProspectMessageTemplate"("key");

-- AddForeignKey
ALTER TABLE "ProspectEvent" ADD CONSTRAINT "ProspectEvent_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;
