-- Add composite indexes on Task for common query patterns:
-- 1. Filter active/overdue tasks by due date across all assignees
-- 2. Per-assignee overdue/active task lookups (getTaskDashboard)

CREATE INDEX IF NOT EXISTS "Task_status_dueDate_idx" ON "Task"("status", "dueDate");
CREATE INDEX IF NOT EXISTS "Task_assigneeId_status_dueDate_idx" ON "Task"("assigneeId", "status", "dueDate");
