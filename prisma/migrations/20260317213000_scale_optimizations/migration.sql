CREATE INDEX IF NOT EXISTS "OrgPosition_parentId_order_idx" ON "OrgPosition"("parentId", "order");

CREATE INDEX IF NOT EXISTS "DailyReport_employeeEmail_dateIso_idx" ON "DailyReport"("employeeEmail", "dateIso");
CREATE INDEX IF NOT EXISTS "DailyReport_teamName_dateIso_idx" ON "DailyReport"("teamName", "dateIso");
CREATE INDEX IF NOT EXISTS "DailyReport_position_dateIso_idx" ON "DailyReport"("position", "dateIso");

CREATE INDEX IF NOT EXISTS "Task_assigneeId_status_idx" ON "Task"("assigneeId", "status");
CREATE INDEX IF NOT EXISTS "Task_assigneeId_delegatedAt_idx" ON "Task"("assigneeId", "delegatedAt");
CREATE INDEX IF NOT EXISTS "Task_teamId_delegatedAt_idx" ON "Task"("teamId", "delegatedAt");

CREATE INDEX IF NOT EXISTS "Absence_employeeId_status_dateFrom_dateTo_idx" ON "Absence"("employeeId", "status", "dateFrom", "dateTo");
CREATE INDEX IF NOT EXISTS "Absence_status_dateFrom_dateTo_idx" ON "Absence"("status", "dateFrom", "dateTo");

CREATE INDEX IF NOT EXISTS "PerformanceEvaluation_employeeId_status_idx" ON "PerformanceEvaluation"("employeeId", "status");
CREATE INDEX IF NOT EXISTS "PerformanceEvaluation_employeeId_periodEnd_idx" ON "PerformanceEvaluation"("employeeId", "periodEnd");
CREATE INDEX IF NOT EXISTS "PerformanceEvaluation_managerId_periodEnd_idx" ON "PerformanceEvaluation"("managerId", "periodEnd");
CREATE INDEX IF NOT EXISTS "PerformanceEvaluation_periodEnd_idx" ON "PerformanceEvaluation"("periodEnd");
