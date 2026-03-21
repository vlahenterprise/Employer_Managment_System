import "server-only";

import JSZip from "jszip";
import { prisma } from "./db";

type CsvCell = string | number | boolean | Date | Buffer | object | null | undefined;

function serializeCell(value: CsvCell) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return value.toString("base64");
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function escapeCsv(value: string) {
  if (value.includes('"') || value.includes(",") || value.includes("\n") || value.includes("\r")) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

function rowsToCsv(rows: Array<Record<string, any>>, columns: string[]) {
  const header = columns.map(escapeCsv).join(",");
  const lines = rows.map((row) => {
    const values = columns.map((column) => escapeCsv(serializeCell(row[column])));
    return values.join(",");
  });
  return [header, ...lines].join("\n") + "\n";
}

function normalizeFolderKey(folder: string) {
  const normalized = String(folder || "backups")
    .replaceAll("\\", "/")
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join("/");
  return normalized || "backups";
}

function sanitizeBackupName(name: string) {
  const trimmed = String(name || "").trim();
  if (!trimmed) throw new Error("INVALID_NAME");
  if (trimmed.includes("/") || trimmed.includes("\\")) throw new Error("INVALID_NAME");
  return trimmed;
}

async function exportAllTablesAsCsv(zip: JSZip) {
  const [
    teams,
    users,
    activityTypes,
    settings,
    dailyReports,
    dailyReportActivities,
    tasks,
    taskEvents,
    taskComments,
    absences,
    absenceEvents,
    perfEvaluations,
    perfQuestions,
    perfGoals,
    perfPersonal,
    perfLogs,
    orgPositions,
    orgAssignments,
    orgLinks,
    hrProcesses,
    hrCandidates,
    hrProcessCandidates,
    hrCandidateComments,
    hrNotifications,
    hrAuditLogs,
    accounts,
    sessions,
    verificationTokens
  ] = await Promise.all([
    prisma.team.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.activityType.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.setting.findMany({ orderBy: { key: "asc" } }),
    prisma.dailyReport.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.dailyReportActivity.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.task.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.taskEvent.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.taskComment.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.absence.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.absenceEvent.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.performanceEvaluation.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.performanceQuestion.findMany({ orderBy: { qNo: "asc" } }),
    prisma.performanceGoal.findMany({ orderBy: { updatedAt: "asc" } }),
    prisma.performancePersonalItem.findMany({ orderBy: { updatedAt: "asc" } }),
    prisma.performanceLog.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.orgPosition.findMany({ orderBy: { order: "asc" } }),
    prisma.orgPositionAssignment.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.orgPositionLink.findMany({ orderBy: { order: "asc" } }),
    prisma.hrProcess.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.hrCandidate.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.hrProcessCandidate.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.hrCandidateComment.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.hrNotification.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.hrAuditLog.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.account.findMany({ orderBy: { id: "asc" } }),
    prisma.session.findMany({ orderBy: { expires: "asc" } }),
    prisma.verificationToken.findMany({ orderBy: { expires: "asc" } })
  ]);

  const tables: Array<{ name: string; rows: Array<Record<string, any>>; columns: string[] }> = [
    { name: "Team", rows: teams as any, columns: ["id", "name", "createdAt", "updatedAt"] },
    {
      name: "User",
      rows: users as any,
      columns: [
        "id",
        "email",
        "name",
        "position",
        "image",
        "emailVerified",
        "passwordHash",
        "role",
        "hrAddon",
        "status",
        "carryOverAnnualLeave",
        "annualLeaveDays",
        "homeOfficeDays",
        "slavaDays",
        "teamId",
        "managerId",
        "createdAt",
        "updatedAt"
      ]
    },
    { name: "ActivityType", rows: activityTypes as any, columns: ["id", "teamId", "name", "isActive", "createdAt", "updatedAt"] },
    { name: "Setting", rows: settings as any, columns: ["key", "value", "createdAt", "updatedAt"] },
    {
      name: "DailyReport",
      rows: dailyReports as any,
      columns: [
        "id",
        "userId",
        "dateIso",
        "employeeEmail",
        "employeeName",
        "teamName",
        "position",
        "week",
        "month",
        "year",
        "totalMinutes",
        "createdAt",
        "updatedAt"
      ]
    },
    { name: "DailyReportActivity", rows: dailyReportActivities as any, columns: ["id", "reportId", "type", "desc", "minutes", "createdAt"] },
    {
      name: "Task",
      rows: tasks as any,
      columns: [
        "id",
        "title",
        "description",
        "priority",
        "status",
        "delegatorId",
        "assigneeId",
        "teamId",
        "delegatedAt",
        "dueDate",
        "forApprovalAt",
        "approvedAt",
        "cancelledAt",
        "returnedCount",
        "employeeComment",
        "adminComment",
        "createdAt",
        "updatedAt"
      ]
    },
    { name: "TaskEvent", rows: taskEvents as any, columns: ["id", "taskId", "action", "actorId", "actorEmail", "actorName", "comment", "createdAt"] },
    { name: "TaskComment", rows: taskComments as any, columns: ["id", "taskId", "authorId", "body", "createdAt"] },
    {
      name: "Absence",
      rows: absences as any,
      columns: [
        "id",
        "employeeId",
        "approverId",
        "type",
        "status",
        "dateFrom",
        "dateTo",
        "days",
        "comment",
        "overlapWarning",
        "approvedAt",
        "createdAt",
        "updatedAt"
      ]
    },
    { name: "AbsenceEvent", rows: absenceEvents as any, columns: ["id", "absenceId", "action", "actorId", "actorEmail", "actorName", "comment", "createdAt"] },
    {
      name: "PerformanceEvaluation",
      rows: perfEvaluations as any,
      columns: [
        "id",
        "employeeId",
        "managerId",
        "periodStart",
        "periodEnd",
        "periodLabel",
        "status",
        "locked",
        "lockedAt",
        "lockedById",
        "unlockOverride",
        "closedAt",
        "personalScore",
        "goalsScore",
        "finalScore",
        "managerFinalComment",
        "createdAt",
        "updatedAt"
      ]
    },
    { name: "PerformanceQuestion", rows: perfQuestions as any, columns: ["id", "qNo", "area", "description", "scale", "isActive", "createdAt", "updatedAt"] },
    {
      name: "PerformanceGoal",
      rows: perfGoals as any,
      columns: [
        "id",
        "evaluationId",
        "title",
        "description",
        "weight",
        "employeeScore",
        "employeeComment",
        "managerScore",
        "managerComment",
        "createdAt",
        "updatedAt"
      ]
    },
    {
      name: "PerformancePersonalItem",
      rows: perfPersonal as any,
      columns: [
        "id",
        "evaluationId",
        "questionId",
        "qNo",
        "area",
        "description",
        "scale",
        "managerRating",
        "managerComment",
        "updatedAt"
      ]
    },
    {
      name: "PerformanceLog",
      rows: perfLogs as any,
      columns: ["id", "evaluationId", "goalId", "actorId", "actorEmail", "action", "field", "oldValue", "newValue", "createdAt"]
    },
    { name: "OrgPosition", rows: orgPositions as any, columns: ["id", "title", "description", "parentId", "order", "isActive", "createdAt", "updatedAt"] },
    { name: "OrgPositionAssignment", rows: orgAssignments as any, columns: ["id", "positionId", "userId", "createdAt"] },
    { name: "OrgPositionLink", rows: orgLinks as any, columns: ["id", "positionId", "label", "url", "order", "createdAt"] },
    {
      name: "HrProcess",
      rows: hrProcesses as any,
      columns: [
        "id",
        "teamId",
        "positionTitle",
        "requestedHeadcount",
        "priority",
        "reason",
        "note",
        "status",
        "openedById",
        "managerId",
        "finalApproverId",
        "adPublishedAt",
        "adChannel",
        "openedAt",
        "closedAt",
        "cancelledAt",
        "archivedAt",
        "createdAt",
        "updatedAt"
      ]
    },
    {
      name: "HrCandidate",
      rows: hrCandidates as any,
      columns: [
        "id",
        "fullName",
        "email",
        "phone",
        "linkedIn",
        "source",
        "latestCvFileName",
        "latestCvMimeType",
        "latestCvData",
        "createdById",
        "createdAt",
        "updatedAt"
      ]
    },
    {
      name: "HrProcessCandidate",
      rows: hrProcessCandidates as any,
      columns: [
        "id",
        "processId",
        "candidateId",
        "createdById",
        "status",
        "source",
        "appliedAt",
        "initialContactAt",
        "hrComment",
        "firstRoundComment",
        "screeningResult",
        "managerComment",
        "finalComment",
        "interviewScheduledAt",
        "secondRoundCompletedAt",
        "finalDecisionAt",
        "archivedAt",
        "cancelledAt",
        "closedReason",
        "managerProposedSlots",
        "createdAt",
        "updatedAt"
      ]
    },
    { name: "HrCandidateComment", rows: hrCandidateComments as any, columns: ["id", "processCandidateId", "actorId", "stage", "body", "createdAt"] },
    {
      name: "HrNotification",
      rows: hrNotifications as any,
      columns: ["id", "userId", "processId", "processCandidateId", "type", "title", "body", "href", "isRead", "createdAt", "readAt"]
    },
    {
      name: "HrAuditLog",
      rows: hrAuditLogs as any,
      columns: ["id", "processId", "processCandidateId", "candidateId", "actorId", "action", "field", "oldValue", "newValue", "comment", "createdAt"]
    },
    {
      name: "Account",
      rows: accounts as any,
      columns: [
        "id",
        "userId",
        "type",
        "provider",
        "providerAccountId",
        "refresh_token",
        "access_token",
        "expires_at",
        "token_type",
        "scope",
        "id_token",
        "session_state"
      ]
    },
    { name: "Session", rows: sessions as any, columns: ["id", "sessionToken", "userId", "expires"] },
    { name: "VerificationToken", rows: verificationTokens as any, columns: ["identifier", "token", "expires"] }
  ];

  for (const table of tables) {
    zip.file(`${table.name}.csv`, rowsToCsv(table.rows, table.columns));
  }
}

function isoTimestamp() {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

export async function createBackupZip() {
  const zip = new JSZip();
  await exportAllTablesAsCsv(zip);
  const bytes = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  const filename = `db-backup-${isoTimestamp()}.zip`;
  return { filename, bytes };
}

export async function ensureDir(_dirPath: string) {
  return;
}

export async function writeBackupZipToDisk(params: { folder: string; source?: string }) {
  const folder = normalizeFolderKey(params.folder);
  const { filename, bytes } = await createBackupZip();
  const storageKey = `${folder}/${filename}`;

  await prisma.backupSnapshot.create({
    data: {
      filename,
      storageKey,
      source: String(params.source || "MANUAL").trim() || "MANUAL",
      sizeBytes: bytes.byteLength,
      zipData: bytes
    }
  });

  return { filename, fullPath: storageKey, sizeBytes: bytes.byteLength };
}

export async function listBackupFiles(folder: string) {
  const folderKey = normalizeFolderKey(folder);
  const prefix = `${folderKey}/`;
  const rows = await prisma.backupSnapshot.findMany({
    where: { storageKey: { startsWith: prefix } },
    orderBy: { createdAt: "desc" },
    select: {
      filename: true,
      storageKey: true,
      sizeBytes: true,
      createdAt: true
    }
  });

  return rows.map((row) => ({
    name: row.filename,
    fullPath: row.storageKey,
    sizeBytes: row.sizeBytes,
    mtimeMs: row.createdAt.getTime()
  }));
}

export async function readBackupFile(params: { folder: string; name: string }) {
  const folderKey = normalizeFolderKey(params.folder);
  const filename = sanitizeBackupName(params.name);
  const storageKey = `${folderKey}/${filename}`;
  const snapshot = await prisma.backupSnapshot.findUnique({
    where: { storageKey },
    select: { filename: true, storageKey: true, zipData: true }
  });
  if (!snapshot) throw new Error("NOT_FOUND");
  return { filename: snapshot.filename, bytes: Buffer.from(snapshot.zipData), fullPath: snapshot.storageKey };
}

export async function pruneStoredBackups(params: { folder: string; keepDays: number }) {
  const folderKey = normalizeFolderKey(params.folder);
  const keepDays = Number.isFinite(params.keepDays) ? Math.max(1, Math.floor(params.keepDays)) : 30;
  const cutoff = new Date(Date.now() - keepDays * 24 * 60 * 60 * 1000);
  const result = await prisma.backupSnapshot.deleteMany({
    where: {
      storageKey: { startsWith: `${folderKey}/` },
      createdAt: { lt: cutoff }
    }
  });
  return { deleted: result.count };
}
