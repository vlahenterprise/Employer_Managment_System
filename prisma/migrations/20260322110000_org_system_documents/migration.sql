-- CreateEnum
CREATE TYPE "OrgLinkType" AS ENUM (
  'JOB_DESCRIPTION',
  'WORK_INSTRUCTIONS',
  'POSITION_PROCESS',
  'POSITION_INSTRUCTION',
  'GLOBAL_PROCESS',
  'GLOBAL_INSTRUCTION'
);

-- AlterTable
ALTER TABLE "OrgPositionLink"
  ADD COLUMN "description" TEXT,
  ADD COLUMN "type" "OrgLinkType" NOT NULL DEFAULT 'POSITION_INSTRUCTION',
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "OrgGlobalLink" (
  "id" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT,
  "url" TEXT NOT NULL,
  "type" "OrgLinkType" NOT NULL DEFAULT 'GLOBAL_INSTRUCTION',
  "order" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OrgGlobalLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrgPositionLink_positionId_type_idx" ON "OrgPositionLink"("positionId", "type");

-- CreateIndex
CREATE INDEX "OrgPositionLink_type_idx" ON "OrgPositionLink"("type");

-- CreateIndex
CREATE INDEX "OrgGlobalLink_type_idx" ON "OrgGlobalLink"("type");

-- CreateIndex
CREATE INDEX "OrgGlobalLink_order_idx" ON "OrgGlobalLink"("order");
