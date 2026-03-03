-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'HR';

-- CreateTable
CREATE TABLE "OrgPosition" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgPosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgPositionAssignment" (
    "id" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgPositionAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgPositionLink" (
    "id" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgPositionLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrgPosition_parentId_idx" ON "OrgPosition"("parentId");

-- CreateIndex
CREATE INDEX "OrgPosition_order_idx" ON "OrgPosition"("order");

-- CreateIndex
CREATE INDEX "OrgPosition_isActive_idx" ON "OrgPosition"("isActive");

-- CreateIndex
CREATE INDEX "OrgPositionAssignment_userId_idx" ON "OrgPositionAssignment"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OrgPositionAssignment_positionId_userId_key" ON "OrgPositionAssignment"("positionId", "userId");

-- CreateIndex
CREATE INDEX "OrgPositionLink_positionId_idx" ON "OrgPositionLink"("positionId");

-- CreateIndex
CREATE INDEX "OrgPositionLink_order_idx" ON "OrgPositionLink"("order");

-- AddForeignKey
ALTER TABLE "OrgPosition" ADD CONSTRAINT "OrgPosition_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "OrgPosition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgPositionAssignment" ADD CONSTRAINT "OrgPositionAssignment_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "OrgPosition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgPositionAssignment" ADD CONSTRAINT "OrgPositionAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgPositionLink" ADD CONSTRAINT "OrgPositionLink_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "OrgPosition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
