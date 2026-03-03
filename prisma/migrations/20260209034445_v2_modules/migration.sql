-- AlterEnum
BEGIN;
CREATE TYPE "AbsenceStatus_new" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
ALTER TABLE "Absence" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Absence" ALTER COLUMN "status" TYPE "AbsenceStatus_new" USING ("status"::text::"AbsenceStatus_new");
ALTER TYPE "AbsenceStatus" RENAME TO "AbsenceStatus_old";
ALTER TYPE "AbsenceStatus_new" RENAME TO "AbsenceStatus";
DROP TYPE "AbsenceStatus_old";
ALTER TABLE "Absence" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "AbsenceType_new" AS ENUM ('ANNUAL_LEAVE', 'HOME_OFFICE', 'SLAVA', 'OTHER', 'SICK');
ALTER TABLE "Absence" ALTER COLUMN "type" TYPE "AbsenceType_new" USING ("type"::text::"AbsenceType_new");
ALTER TYPE "AbsenceType" RENAME TO "AbsenceType_old";
ALTER TYPE "AbsenceType_new" RENAME TO "AbsenceType";
DROP TYPE "AbsenceType_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "EvaluationStatus_new" AS ENUM ('OPEN', 'SELF_SUBMITTED', 'CLOSED', 'CANCELLED');
ALTER TABLE "PerformanceEvaluation" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "PerformanceEvaluation" ALTER COLUMN "status" TYPE "EvaluationStatus_new" USING ("status"::text::"EvaluationStatus_new");
ALTER TYPE "EvaluationStatus" RENAME TO "EvaluationStatus_old";
ALTER TYPE "EvaluationStatus_new" RENAME TO "EvaluationStatus";
DROP TYPE "EvaluationStatus_old";
ALTER TABLE "PerformanceEvaluation" ALTER COLUMN "status" SET DEFAULT 'OPEN';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "TaskPriority_new" AS ENUM ('LOW', 'MED', 'HIGH', 'CRIT');
ALTER TABLE "Task" ALTER COLUMN "priority" DROP DEFAULT;
ALTER TABLE "Task" ALTER COLUMN "priority" TYPE "TaskPriority_new" USING ("priority"::text::"TaskPriority_new");
ALTER TYPE "TaskPriority" RENAME TO "TaskPriority_old";
ALTER TYPE "TaskPriority_new" RENAME TO "TaskPriority";
DROP TYPE "TaskPriority_old";
ALTER TABLE "Task" ALTER COLUMN "priority" SET DEFAULT 'MED';
COMMIT;

-- AlterEnum
ALTER TYPE "TaskStatus" ADD VALUE 'FOR_APPROVAL';

-- AlterTable
ALTER TABLE "Absence" DROP COLUMN "endDate",
DROP COLUMN "managerId",
DROP COLUMN "reason",
DROP COLUMN "startDate",
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approverId" TEXT,
ADD COLUMN     "comment" TEXT,
ADD COLUMN     "dateFrom" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "dateTo" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "days" INTEGER NOT NULL,
ADD COLUMN     "overlapWarning" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "PerformanceEvaluation" DROP COLUMN "managerGoalsScore",
DROP COLUMN "quarter",
DROP COLUMN "selfGoalsScore",
DROP COLUMN "year",
ADD COLUMN     "goalsScore" DOUBLE PRECISION,
ADD COLUMN     "locked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lockedById" TEXT,
ADD COLUMN     "managerFinalComment" TEXT,
ADD COLUMN     "periodLabel" TEXT NOT NULL,
ADD COLUMN     "unlockOverride" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "PerformanceGoal" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "PerformancePersonalItem" DROP COLUMN "employeeComment",
DROP COLUMN "employeeScore",
DROP COLUMN "label",
DROP COLUMN "managerScore",
ADD COLUMN     "area" TEXT NOT NULL,
ADD COLUMN     "description" TEXT NOT NULL,
ADD COLUMN     "managerRating" DOUBLE PRECISION,
ADD COLUMN     "qNo" INTEGER NOT NULL,
ADD COLUMN     "questionId" TEXT NOT NULL,
ADD COLUMN     "scale" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "adminComment" TEXT,
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "delegatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "employeeComment" TEXT,
ADD COLUMN     "forApprovalAt" TIMESTAMP(3),
ADD COLUMN     "returnedCount" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "priority" SET DEFAULT 'MED';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "annualLeaveDays" INTEGER,
ADD COLUMN     "homeOfficeDays" INTEGER,
ADD COLUMN     "slavaDays" INTEGER;

-- CreateTable
CREATE TABLE "TaskEvent" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT,
    "actorEmail" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AbsenceEvent" (
    "id" TEXT NOT NULL,
    "absenceId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT,
    "actorEmail" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AbsenceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerformanceQuestion" (
    "id" TEXT NOT NULL,
    "qNo" INTEGER NOT NULL,
    "area" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "scale" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerformanceQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerformanceLog" (
    "id" TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "goalId" TEXT,
    "actorId" TEXT,
    "actorEmail" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "field" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PerformanceLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskEvent_taskId_idx" ON "TaskEvent"("taskId");

-- CreateIndex
CREATE INDEX "TaskEvent_createdAt_idx" ON "TaskEvent"("createdAt");

-- CreateIndex
CREATE INDEX "TaskEvent_action_idx" ON "TaskEvent"("action");

-- CreateIndex
CREATE INDEX "AbsenceEvent_absenceId_idx" ON "AbsenceEvent"("absenceId");

-- CreateIndex
CREATE INDEX "AbsenceEvent_createdAt_idx" ON "AbsenceEvent"("createdAt");

-- CreateIndex
CREATE INDEX "AbsenceEvent_action_idx" ON "AbsenceEvent"("action");

-- CreateIndex
CREATE UNIQUE INDEX "PerformanceQuestion_qNo_key" ON "PerformanceQuestion"("qNo");

-- CreateIndex
CREATE INDEX "PerformanceLog_evaluationId_idx" ON "PerformanceLog"("evaluationId");

-- CreateIndex
CREATE INDEX "PerformanceLog_createdAt_idx" ON "PerformanceLog"("createdAt");

-- CreateIndex
CREATE INDEX "PerformanceLog_action_idx" ON "PerformanceLog"("action");

-- CreateIndex
CREATE INDEX "Absence_type_idx" ON "Absence"("type");

-- CreateIndex
CREATE INDEX "Absence_dateFrom_idx" ON "Absence"("dateFrom");

-- CreateIndex
CREATE INDEX "Absence_dateTo_idx" ON "Absence"("dateTo");

-- CreateIndex
CREATE INDEX "PerformancePersonalItem_qNo_idx" ON "PerformancePersonalItem"("qNo");

-- CreateIndex
CREATE INDEX "Task_priority_idx" ON "Task"("priority");

-- CreateIndex
CREATE INDEX "Task_delegatedAt_idx" ON "Task"("delegatedAt");

-- CreateIndex
CREATE INDEX "Task_dueDate_idx" ON "Task"("dueDate");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskEvent" ADD CONSTRAINT "TaskEvent_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskEvent" ADD CONSTRAINT "TaskEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Absence" ADD CONSTRAINT "Absence_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbsenceEvent" ADD CONSTRAINT "AbsenceEvent_absenceId_fkey" FOREIGN KEY ("absenceId") REFERENCES "Absence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbsenceEvent" ADD CONSTRAINT "AbsenceEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceEvaluation" ADD CONSTRAINT "PerformanceEvaluation_lockedById_fkey" FOREIGN KEY ("lockedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformancePersonalItem" ADD CONSTRAINT "PerformancePersonalItem_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "PerformanceQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceLog" ADD CONSTRAINT "PerformanceLog_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "PerformanceEvaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceLog" ADD CONSTRAINT "PerformanceLog_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "PerformanceGoal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceLog" ADD CONSTRAINT "PerformanceLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
