-- CreateTable
CREATE TABLE "DailyReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dateIso" TEXT NOT NULL,
    "employeeEmail" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    "teamName" TEXT NOT NULL,
    "position" TEXT,
    "week" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "totalMinutes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyReportActivity" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "desc" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyReportActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyReport_dateIso_idx" ON "DailyReport"("dateIso");

-- CreateIndex
CREATE INDEX "DailyReport_employeeEmail_idx" ON "DailyReport"("employeeEmail");

-- CreateIndex
CREATE INDEX "DailyReport_teamName_idx" ON "DailyReport"("teamName");

-- CreateIndex
CREATE INDEX "DailyReport_position_idx" ON "DailyReport"("position");

-- CreateIndex
CREATE UNIQUE INDEX "DailyReport_userId_dateIso_key" ON "DailyReport"("userId", "dateIso");

-- CreateIndex
CREATE INDEX "DailyReportActivity_reportId_idx" ON "DailyReportActivity"("reportId");

-- CreateIndex
CREATE INDEX "DailyReportActivity_type_idx" ON "DailyReportActivity"("type");

-- AddForeignKey
ALTER TABLE "DailyReport" ADD CONSTRAINT "DailyReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyReportActivity" ADD CONSTRAINT "DailyReportActivity_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "DailyReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
