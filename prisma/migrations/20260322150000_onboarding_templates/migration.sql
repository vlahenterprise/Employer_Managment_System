-- AlterTable
ALTER TABLE "Onboarding" ADD COLUMN     "positionId" TEXT,
ADD COLUMN     "templateId" TEXT;

-- AlterTable
ALTER TABLE "OnboardingItem" ADD COLUMN     "dueDate" TIMESTAMP(3),
ADD COLUMN     "hrConfirmationRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hrConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "hrConfirmedById" TEXT,
ADD COLUMN     "links" JSONB,
ADD COLUMN     "managerConfirmationRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "managerConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "managerConfirmedById" TEXT,
ADD COLUMN     "mentorId" TEXT,
ADD COLUMN     "templateStepId" TEXT;

-- AlterTable
ALTER TABLE "OrgGlobalLink" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "OrgPositionLink" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "OnboardingTemplate" (
    "id" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingTemplateStep" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "ownerType" "OnboardingItemOwner" NOT NULL DEFAULT 'SHARED',
    "dueOffsetDays" INTEGER,
    "mentorId" TEXT,
    "hrConfirmationRequired" BOOLEAN NOT NULL DEFAULT true,
    "managerConfirmationRequired" BOOLEAN NOT NULL DEFAULT true,
    "links" JSONB,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingTemplateStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingTemplate_positionId_key" ON "OnboardingTemplate"("positionId");

-- CreateIndex
CREATE INDEX "OnboardingTemplate_isActive_idx" ON "OnboardingTemplate"("isActive");

-- CreateIndex
CREATE INDEX "OnboardingTemplateStep_templateId_order_idx" ON "OnboardingTemplateStep"("templateId", "order");

-- CreateIndex
CREATE INDEX "OnboardingTemplateStep_mentorId_idx" ON "OnboardingTemplateStep"("mentorId");

-- CreateIndex
CREATE INDEX "Onboarding_positionId_status_idx" ON "Onboarding"("positionId", "status");

-- CreateIndex
CREATE INDEX "Onboarding_templateId_idx" ON "Onboarding"("templateId");

-- CreateIndex
CREATE INDEX "OnboardingItem_templateStepId_idx" ON "OnboardingItem"("templateStepId");

-- CreateIndex
CREATE INDEX "OnboardingItem_mentorId_idx" ON "OnboardingItem"("mentorId");

-- CreateIndex
CREATE INDEX "OnboardingItem_dueDate_idx" ON "OnboardingItem"("dueDate");

-- AddForeignKey
ALTER TABLE "OnboardingTemplate" ADD CONSTRAINT "OnboardingTemplate_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "OrgPosition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingTemplate" ADD CONSTRAINT "OnboardingTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingTemplateStep" ADD CONSTRAINT "OnboardingTemplateStep_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "OnboardingTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingTemplateStep" ADD CONSTRAINT "OnboardingTemplateStep_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Onboarding" ADD CONSTRAINT "Onboarding_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "OrgPosition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Onboarding" ADD CONSTRAINT "Onboarding_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "OnboardingTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingItem" ADD CONSTRAINT "OnboardingItem_templateStepId_fkey" FOREIGN KEY ("templateStepId") REFERENCES "OnboardingTemplateStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingItem" ADD CONSTRAINT "OnboardingItem_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingItem" ADD CONSTRAINT "OnboardingItem_hrConfirmedById_fkey" FOREIGN KEY ("hrConfirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingItem" ADD CONSTRAINT "OnboardingItem_managerConfirmedById_fkey" FOREIGN KEY ("managerConfirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
