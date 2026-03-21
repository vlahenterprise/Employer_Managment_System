-- CreateEnum
CREATE TYPE "OnboardingStatus" AS ENUM ('PLANNED', 'ACTIVE', 'WAITING_EMPLOYEE_ACTIONS', 'WAITING_MANAGER_ACTIONS', 'WAITING_HR_ACTIONS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "OnboardingItemOwner" AS ENUM ('HR', 'MANAGER', 'EMPLOYEE', 'SHARED');

-- AlterTable
ALTER TABLE "HrCandidate" ADD COLUMN     "cvDriveUrl" TEXT,
ADD COLUMN     "lastContactAt" TIMESTAMP(3),
ADD COLUMN     "talentPoolTag" TEXT;

-- AlterTable
ALTER TABLE "HrProcess" ADD COLUMN     "desiredStartDate" TIMESTAMP(3),
ADD COLUMN     "requestType" TEXT,
ADD COLUMN     "superiorComment" TEXT,
ADD COLUMN     "superiorDecidedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "HrProcessCandidate" ADD COLUMN     "nextAction" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "adminAddon" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "employmentDate" TIMESTAMP(3),
ADD COLUMN     "jobDescriptionUrl" TEXT,
ADD COLUMN     "workInstructionsUrl" TEXT;

-- CreateTable
CREATE TABLE "Onboarding" (
    "id" TEXT NOT NULL,
    "processId" TEXT,
    "candidateId" TEXT,
    "employeeId" TEXT,
    "teamId" TEXT,
    "managerId" TEXT,
    "hrOwnerId" TEXT,
    "startDate" TIMESTAMP(3),
    "status" "OnboardingStatus" NOT NULL DEFAULT 'PLANNED',
    "note" TEXT,
    "jobDescriptionUrl" TEXT,
    "workInstructionsUrl" TEXT,
    "onboardingDocsUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Onboarding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingItem" (
    "id" TEXT NOT NULL,
    "onboardingId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "ownerType" "OnboardingItemOwner" NOT NULL DEFAULT 'SHARED',
    "driveUrl" TEXT,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Onboarding_processId_idx" ON "Onboarding"("processId");

-- CreateIndex
CREATE INDEX "Onboarding_candidateId_idx" ON "Onboarding"("candidateId");

-- CreateIndex
CREATE INDEX "Onboarding_employeeId_status_idx" ON "Onboarding"("employeeId", "status");

-- CreateIndex
CREATE INDEX "Onboarding_managerId_status_idx" ON "Onboarding"("managerId", "status");

-- CreateIndex
CREATE INDEX "Onboarding_hrOwnerId_status_idx" ON "Onboarding"("hrOwnerId", "status");

-- CreateIndex
CREATE INDEX "Onboarding_teamId_status_idx" ON "Onboarding"("teamId", "status");

-- CreateIndex
CREATE INDEX "OnboardingItem_onboardingId_order_idx" ON "OnboardingItem"("onboardingId", "order");

-- CreateIndex
CREATE INDEX "OnboardingItem_ownerType_isCompleted_idx" ON "OnboardingItem"("ownerType", "isCompleted");

-- CreateIndex
CREATE INDEX "HrCandidate_talentPoolTag_idx" ON "HrCandidate"("talentPoolTag");

-- CreateIndex
CREATE INDEX "User_adminAddon_idx" ON "User"("adminAddon");

-- AddForeignKey
ALTER TABLE "Onboarding" ADD CONSTRAINT "Onboarding_processId_fkey" FOREIGN KEY ("processId") REFERENCES "HrProcess"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Onboarding" ADD CONSTRAINT "Onboarding_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "HrCandidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Onboarding" ADD CONSTRAINT "Onboarding_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Onboarding" ADD CONSTRAINT "Onboarding_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Onboarding" ADD CONSTRAINT "Onboarding_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Onboarding" ADD CONSTRAINT "Onboarding_hrOwnerId_fkey" FOREIGN KEY ("hrOwnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingItem" ADD CONSTRAINT "OnboardingItem_onboardingId_fkey" FOREIGN KEY ("onboardingId") REFERENCES "Onboarding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingItem" ADD CONSTRAINT "OnboardingItem_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
