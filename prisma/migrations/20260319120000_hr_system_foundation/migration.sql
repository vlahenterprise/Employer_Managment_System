-- CreateEnum
CREATE TYPE "HrProcessStatus" AS ENUM ('DRAFT', 'OPEN', 'IN_PROGRESS', 'ON_HOLD', 'APPROVED', 'CLOSED', 'CANCELED');

-- CreateEnum
CREATE TYPE "HrCandidateStatus" AS ENUM ('NEW_APPLICANT', 'HR_SCREENING', 'REJECTED_BY_HR', 'SENT_TO_MANAGER', 'WAITING_MANAGER_REVIEW', 'INTERVIEW_SCHEDULED', 'SECOND_ROUND_COMPLETED', 'REJECTED_BY_MANAGER', 'WAITING_FINAL_APPROVAL', 'APPROVED_FOR_EMPLOYMENT', 'REJECTED_FINAL', 'ARCHIVED', 'CANCELED');

-- CreateEnum
CREATE TYPE "HrPriority" AS ENUM ('LOW', 'MED', 'HIGH', 'CRITICAL');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "hrAddon" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "HrProcess" (
    "id" TEXT NOT NULL,
    "teamId" TEXT,
    "positionTitle" TEXT NOT NULL,
    "requestedHeadcount" INTEGER NOT NULL DEFAULT 1,
    "priority" "HrPriority" NOT NULL DEFAULT 'MED',
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "status" "HrProcessStatus" NOT NULL DEFAULT 'OPEN',
    "openedById" TEXT NOT NULL,
    "managerId" TEXT,
    "finalApproverId" TEXT,
    "adPublishedAt" TIMESTAMP(3),
    "adChannel" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrProcess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrCandidate" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "linkedIn" TEXT,
    "source" TEXT,
    "latestCvFileName" TEXT,
    "latestCvMimeType" TEXT,
    "latestCvData" BYTEA,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrProcessCandidate" (
    "id" TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "createdById" TEXT,
    "status" "HrCandidateStatus" NOT NULL DEFAULT 'NEW_APPLICANT',
    "source" TEXT,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "initialContactAt" TIMESTAMP(3),
    "hrComment" TEXT,
    "firstRoundComment" TEXT,
    "screeningResult" TEXT,
    "managerComment" TEXT,
    "finalComment" TEXT,
    "interviewScheduledAt" TIMESTAMP(3),
    "secondRoundCompletedAt" TIMESTAMP(3),
    "finalDecisionAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "closedReason" TEXT,
    "managerProposedSlots" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrProcessCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrCandidateComment" (
    "id" TEXT NOT NULL,
    "processCandidateId" TEXT NOT NULL,
    "actorId" TEXT,
    "stage" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrCandidateComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrNotification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "processId" TEXT,
    "processCandidateId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "href" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "HrNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrAuditLog" (
    "id" TEXT NOT NULL,
    "processId" TEXT,
    "processCandidateId" TEXT,
    "candidateId" TEXT,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "field" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HrProcess_teamId_status_idx" ON "HrProcess"("teamId", "status");

-- CreateIndex
CREATE INDEX "HrProcess_managerId_status_idx" ON "HrProcess"("managerId", "status");

-- CreateIndex
CREATE INDEX "HrProcess_finalApproverId_status_idx" ON "HrProcess"("finalApproverId", "status");

-- CreateIndex
CREATE INDEX "HrProcess_status_openedAt_idx" ON "HrProcess"("status", "openedAt");

-- CreateIndex
CREATE INDEX "HrCandidate_fullName_idx" ON "HrCandidate"("fullName");

-- CreateIndex
CREATE INDEX "HrCandidate_email_idx" ON "HrCandidate"("email");

-- CreateIndex
CREATE INDEX "HrCandidate_phone_idx" ON "HrCandidate"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "HrProcessCandidate_processId_candidateId_key" ON "HrProcessCandidate"("processId", "candidateId");

-- CreateIndex
CREATE INDEX "HrProcessCandidate_processId_status_idx" ON "HrProcessCandidate"("processId", "status");

-- CreateIndex
CREATE INDEX "HrProcessCandidate_candidateId_status_idx" ON "HrProcessCandidate"("candidateId", "status");

-- CreateIndex
CREATE INDEX "HrProcessCandidate_appliedAt_idx" ON "HrProcessCandidate"("appliedAt");

-- CreateIndex
CREATE INDEX "HrCandidateComment_processCandidateId_createdAt_idx" ON "HrCandidateComment"("processCandidateId", "createdAt");

-- CreateIndex
CREATE INDEX "HrNotification_userId_isRead_createdAt_idx" ON "HrNotification"("userId", "isRead", "createdAt");

-- CreateIndex
CREATE INDEX "HrNotification_processId_idx" ON "HrNotification"("processId");

-- CreateIndex
CREATE INDEX "HrNotification_processCandidateId_idx" ON "HrNotification"("processCandidateId");

-- CreateIndex
CREATE INDEX "HrAuditLog_processId_createdAt_idx" ON "HrAuditLog"("processId", "createdAt");

-- CreateIndex
CREATE INDEX "HrAuditLog_processCandidateId_createdAt_idx" ON "HrAuditLog"("processCandidateId", "createdAt");

-- CreateIndex
CREATE INDEX "HrAuditLog_candidateId_createdAt_idx" ON "HrAuditLog"("candidateId", "createdAt");

-- CreateIndex
CREATE INDEX "HrAuditLog_actorId_createdAt_idx" ON "HrAuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "HrAuditLog_action_idx" ON "HrAuditLog"("action");

-- CreateIndex
CREATE INDEX "User_hrAddon_idx" ON "User"("hrAddon");

-- AddForeignKey
ALTER TABLE "HrProcess" ADD CONSTRAINT "HrProcess_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrProcess" ADD CONSTRAINT "HrProcess_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrProcess" ADD CONSTRAINT "HrProcess_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrProcess" ADD CONSTRAINT "HrProcess_finalApproverId_fkey" FOREIGN KEY ("finalApproverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrCandidate" ADD CONSTRAINT "HrCandidate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrProcessCandidate" ADD CONSTRAINT "HrProcessCandidate_processId_fkey" FOREIGN KEY ("processId") REFERENCES "HrProcess"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrProcessCandidate" ADD CONSTRAINT "HrProcessCandidate_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "HrCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrProcessCandidate" ADD CONSTRAINT "HrProcessCandidate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrCandidateComment" ADD CONSTRAINT "HrCandidateComment_processCandidateId_fkey" FOREIGN KEY ("processCandidateId") REFERENCES "HrProcessCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrCandidateComment" ADD CONSTRAINT "HrCandidateComment_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrNotification" ADD CONSTRAINT "HrNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrNotification" ADD CONSTRAINT "HrNotification_processId_fkey" FOREIGN KEY ("processId") REFERENCES "HrProcess"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrNotification" ADD CONSTRAINT "HrNotification_processCandidateId_fkey" FOREIGN KEY ("processCandidateId") REFERENCES "HrProcessCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrAuditLog" ADD CONSTRAINT "HrAuditLog_processId_fkey" FOREIGN KEY ("processId") REFERENCES "HrProcess"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrAuditLog" ADD CONSTRAINT "HrAuditLog_processCandidateId_fkey" FOREIGN KEY ("processCandidateId") REFERENCES "HrProcessCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrAuditLog" ADD CONSTRAINT "HrAuditLog_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "HrCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrAuditLog" ADD CONSTRAINT "HrAuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
