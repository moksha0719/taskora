-- CreateEnum
CREATE TYPE "AssistantMessageRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "AssistantActionType" AS ENUM ('CREATE_TASK');

-- CreateEnum
CREATE TYPE "ActionProposalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateTable
CREATE TABLE "AiConversation" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" VARCHAR(160),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiMessage" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "AssistantMessageRole" NOT NULL,
    "content" VARCHAR(4000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistantProposal" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "actionType" "AssistantActionType" NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "ActionProposalStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "approvedTaskId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrainDump" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "inputText" VARCHAR(8000) NOT NULL,
    "summary" VARCHAR(500) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrainDump_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrainDumpTaskProposal" (
    "id" UUID NOT NULL,
    "brainDumpId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "description" VARCHAR(1000),
    "priority" "TaskPriority" NOT NULL,
    "dueDate" TIMESTAMP(3),
    "status" "ActionProposalStatus" NOT NULL DEFAULT 'PENDING',
    "resolvedAt" TIMESTAMP(3),
    "approvedTaskId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrainDumpTaskProposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiConversation_id_userId_key" ON "AiConversation"("id", "userId");
CREATE INDEX "AiConversation_userId_updatedAt_idx" ON "AiConversation"("userId", "updatedAt");
CREATE INDEX "AiMessage_conversationId_createdAt_idx" ON "AiMessage"("conversationId", "createdAt");
CREATE INDEX "AiMessage_userId_conversationId_createdAt_idx" ON "AiMessage"("userId", "conversationId", "createdAt");
CREATE UNIQUE INDEX "AssistantProposal_approvedTaskId_key" ON "AssistantProposal"("approvedTaskId");
CREATE INDEX "AssistantProposal_userId_status_createdAt_idx" ON "AssistantProposal"("userId", "status", "createdAt");
CREATE UNIQUE INDEX "BrainDump_id_userId_key" ON "BrainDump"("id", "userId");
CREATE INDEX "BrainDump_userId_createdAt_idx" ON "BrainDump"("userId", "createdAt");
CREATE UNIQUE INDEX "BrainDumpTaskProposal_approvedTaskId_key" ON "BrainDumpTaskProposal"("approvedTaskId");
CREATE INDEX "BrainDumpTaskProposal_userId_status_createdAt_idx" ON "BrainDumpTaskProposal"("userId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "AiConversation" ADD CONSTRAINT "AiConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiMessage" ADD CONSTRAINT "AiMessage_conversationId_userId_fkey" FOREIGN KEY ("conversationId", "userId") REFERENCES "AiConversation"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssistantProposal" ADD CONSTRAINT "AssistantProposal_conversationId_userId_fkey" FOREIGN KEY ("conversationId", "userId") REFERENCES "AiConversation"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssistantProposal" ADD CONSTRAINT "AssistantProposal_approvedTaskId_fkey" FOREIGN KEY ("approvedTaskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BrainDump" ADD CONSTRAINT "BrainDump_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BrainDumpTaskProposal" ADD CONSTRAINT "BrainDumpTaskProposal_brainDumpId_userId_fkey" FOREIGN KEY ("brainDumpId", "userId") REFERENCES "BrainDump"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BrainDumpTaskProposal" ADD CONSTRAINT "BrainDumpTaskProposal_approvedTaskId_fkey" FOREIGN KEY ("approvedTaskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
