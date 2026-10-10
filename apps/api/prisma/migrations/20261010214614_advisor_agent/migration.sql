-- CreateTable
CREATE TABLE "AdvisorConversation" (
    "id" TEXT NOT NULL,
    "activationSessionId" TEXT,
    "page" TEXT NOT NULL DEFAULT 'landing',
    "mode" TEXT NOT NULL DEFAULT 'VOICE',
    "lang" TEXT NOT NULL DEFAULT 'fr',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "turns" INTEGER NOT NULL DEFAULT 0,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "costMicroUsd" INTEGER NOT NULL DEFAULT 0,
    "summary" JSONB,
    "concerns" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "unanswered" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "planInterest" TEXT,
    "ipHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "AdvisorConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvisorEvent" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvisorEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdvisorConversation_createdAt_idx" ON "AdvisorConversation"("createdAt");

-- CreateIndex
CREATE INDEX "AdvisorConversation_ipHash_createdAt_idx" ON "AdvisorConversation"("ipHash", "createdAt");

-- CreateIndex
CREATE INDEX "AdvisorEvent_conversationId_idx" ON "AdvisorEvent"("conversationId");

-- CreateIndex
CREATE INDEX "AdvisorEvent_name_createdAt_idx" ON "AdvisorEvent"("name", "createdAt");

-- AddForeignKey
ALTER TABLE "AdvisorConversation" ADD CONSTRAINT "AdvisorConversation_activationSessionId_fkey" FOREIGN KEY ("activationSessionId") REFERENCES "ActivationSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvisorEvent" ADD CONSTRAINT "AdvisorEvent_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AdvisorConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

