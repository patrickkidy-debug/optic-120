-- CreateTable
CREATE TABLE "WhatsappContact" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "profileName" TEXT,
    "botPaused" BOOLEAN NOT NULL DEFAULT false,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsappMessage" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "waMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsappMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappContact_phone_key" ON "WhatsappContact"("phone");

-- CreateIndex
CREATE INDEX "WhatsappContact_lastMessageAt_idx" ON "WhatsappContact"("lastMessageAt");

-- CreateIndex
CREATE INDEX "WhatsappMessage_contactId_createdAt_idx" ON "WhatsappMessage"("contactId", "createdAt");

-- CreateIndex
CREATE INDEX "WhatsappMessage_waMessageId_idx" ON "WhatsappMessage"("waMessageId");

-- AddForeignKey
ALTER TABLE "WhatsappMessage" ADD CONSTRAINT "WhatsappMessage_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "WhatsappContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
