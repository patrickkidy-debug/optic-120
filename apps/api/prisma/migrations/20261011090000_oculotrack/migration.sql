-- AlterTable
ALTER TABLE "LensOrder" ADD COLUMN     "frameRef" TEXT,
ADD COLUMN     "measurementId" TEXT,
ADD COLUMN     "publicToken" TEXT,
ADD COLUMN     "supplierId" TEXT,
ADD COLUMN     "trackCode" TEXT,
ADD COLUMN     "trackStage" TEXT,
ADD COLUMN     "trackStartedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "TrackPackage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'OUTBOUND',
    "status" TEXT NOT NULL DEFAULT 'PREPARING',
    "supplierId" TEXT,
    "fromCity" TEXT,
    "toCity" TEXT,
    "carrierName" TEXT,
    "carrierAccessId" TEXT,
    "externalTracking" TEXT,
    "carrierCode" TEXT,
    "weightGrams" INTEGER,
    "note" TEXT,
    "handedAt" TIMESTAMP(3),
    "shippedAt" TIMESTAMP(3),
    "expectedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "lateNotifiedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdByPortal" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackPackageItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "lensOrderId" TEXT NOT NULL,
    "checks" JSONB,
    "checkedAt" TIMESTAMP(3),

    CONSTRAINT "TrackPackageItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "lensOrderId" TEXT,
    "packageId" TEXT,
    "type" TEXT NOT NULL,
    "stage" TEXT,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT NOT NULL,
    "message" TEXT,
    "meta" JSONB,
    "clientEventId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackAttachment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "lensOrderId" TEXT,
    "packageId" TEXT,
    "anomalyId" TEXT,
    "eventId" TEXT,
    "kind" TEXT NOT NULL,
    "name" TEXT,
    "mime" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "data" TEXT,
    "storageKey" TEXT,
    "uploadedByType" TEXT NOT NULL,
    "uploadedByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackAnomaly" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "lensOrderId" TEXT,
    "packageId" TEXT,
    "type" TEXT NOT NULL,
    "comment" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "reportedByType" TEXT NOT NULL,
    "reportedByName" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "resolvedByName" TEXT,
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackAnomaly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantNotification" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalAccount" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT,
    "kind" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "inviteTokenHash" TEXT,
    "inviteExpiresAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortalAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalAccess" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "supplierId" TEXT,
    "createdById" TEXT,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortalAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalSession" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortalSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrackPackage_token_key" ON "TrackPackage"("token");

-- CreateIndex
CREATE INDEX "TrackPackage_tenantId_status_idx" ON "TrackPackage"("tenantId", "status");

-- CreateIndex
CREATE INDEX "TrackPackage_supplierId_idx" ON "TrackPackage"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "TrackPackage_tenantId_number_key" ON "TrackPackage"("tenantId", "number");

-- CreateIndex
CREATE INDEX "TrackPackageItem_tenantId_idx" ON "TrackPackageItem"("tenantId");

-- CreateIndex
CREATE INDEX "TrackPackageItem_lensOrderId_idx" ON "TrackPackageItem"("lensOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "TrackPackageItem_packageId_lensOrderId_key" ON "TrackPackageItem"("packageId", "lensOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "TrackEvent_clientEventId_key" ON "TrackEvent"("clientEventId");

-- CreateIndex
CREATE INDEX "TrackEvent_tenantId_lensOrderId_idx" ON "TrackEvent"("tenantId", "lensOrderId");

-- CreateIndex
CREATE INDEX "TrackEvent_tenantId_packageId_idx" ON "TrackEvent"("tenantId", "packageId");

-- CreateIndex
CREATE INDEX "TrackEvent_tenantId_occurredAt_idx" ON "TrackEvent"("tenantId", "occurredAt");

-- CreateIndex
CREATE INDEX "TrackAttachment_tenantId_lensOrderId_idx" ON "TrackAttachment"("tenantId", "lensOrderId");

-- CreateIndex
CREATE INDEX "TrackAttachment_tenantId_packageId_idx" ON "TrackAttachment"("tenantId", "packageId");

-- CreateIndex
CREATE INDEX "TrackAnomaly_tenantId_status_idx" ON "TrackAnomaly"("tenantId", "status");

-- CreateIndex
CREATE INDEX "TenantNotification_tenantId_createdAt_idx" ON "TenantNotification"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PortalAccount_email_key" ON "PortalAccount"("email");

-- CreateIndex
CREATE UNIQUE INDEX "PortalAccount_inviteTokenHash_key" ON "PortalAccount"("inviteTokenHash");

-- CreateIndex
CREATE INDEX "PortalAccess_tenantId_idx" ON "PortalAccess"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "PortalAccess_accountId_tenantId_supplierId_key" ON "PortalAccess"("accountId", "tenantId", "supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "PortalSession_tokenHash_key" ON "PortalSession"("tokenHash");

-- CreateIndex
CREATE INDEX "PortalSession_accountId_idx" ON "PortalSession"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "LensOrder_publicToken_key" ON "LensOrder"("publicToken");

-- CreateIndex
CREATE INDEX "LensOrder_tenantId_trackStage_idx" ON "LensOrder"("tenantId", "trackStage");

-- CreateIndex
CREATE INDEX "LensOrder_supplierId_idx" ON "LensOrder"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "LensOrder_tenantId_trackCode_key" ON "LensOrder"("tenantId", "trackCode");

-- AddForeignKey
ALTER TABLE "LensOrder" ADD CONSTRAINT "LensOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackPackage" ADD CONSTRAINT "TrackPackage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackPackage" ADD CONSTRAINT "TrackPackage_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackPackageItem" ADD CONSTRAINT "TrackPackageItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackPackageItem" ADD CONSTRAINT "TrackPackageItem_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "TrackPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackPackageItem" ADD CONSTRAINT "TrackPackageItem_lensOrderId_fkey" FOREIGN KEY ("lensOrderId") REFERENCES "LensOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackEvent" ADD CONSTRAINT "TrackEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackEvent" ADD CONSTRAINT "TrackEvent_lensOrderId_fkey" FOREIGN KEY ("lensOrderId") REFERENCES "LensOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackEvent" ADD CONSTRAINT "TrackEvent_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "TrackPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackAttachment" ADD CONSTRAINT "TrackAttachment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackAttachment" ADD CONSTRAINT "TrackAttachment_lensOrderId_fkey" FOREIGN KEY ("lensOrderId") REFERENCES "LensOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackAttachment" ADD CONSTRAINT "TrackAttachment_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "TrackPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackAttachment" ADD CONSTRAINT "TrackAttachment_anomalyId_fkey" FOREIGN KEY ("anomalyId") REFERENCES "TrackAnomaly"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackAnomaly" ADD CONSTRAINT "TrackAnomaly_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackAnomaly" ADD CONSTRAINT "TrackAnomaly_lensOrderId_fkey" FOREIGN KEY ("lensOrderId") REFERENCES "LensOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackAnomaly" ADD CONSTRAINT "TrackAnomaly_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "TrackPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantNotification" ADD CONSTRAINT "TenantNotification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalAccess" ADD CONSTRAINT "PortalAccess_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "PortalAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalAccess" ADD CONSTRAINT "PortalAccess_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalAccess" ADD CONSTRAINT "PortalAccess_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalSession" ADD CONSTRAINT "PortalSession_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "PortalAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

