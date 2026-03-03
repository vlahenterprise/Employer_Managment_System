import "server-only";

import JSZip from "jszip";
import { prisma } from "./db";
import fs from "node:fs/promises";
import path from "node:path";

type CsvCell = string | number | boolean | Date | null | undefined;

function serializeCell(value: CsvCell) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
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
    const values = columns.map((c) => escapeCsv(serializeCell(row[c]) ?? ""));
    return values.join(",");
  });
  return [header, ...lines].join("\n") + "\n";
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
    prisma.account.findMany({ orderBy: { id: "asc" } }),
    prisma.session.findMany({ orderBy: { expires: "asc" } }),
    prisma.verificationToken.findMany({ orderBy: { expires: "asc" } })
  ]);

  const tables: Array<{ name: string; rows: Array<Record<string, any>>; columns: string[] }> = [
    {
      name: "Team",
      rows: teams as any,
      columns: ["id", "name", "createdAt", "updatedAt"]
    },
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
        "status",
        "carryOverAnnualLeave",
        "teamId",
        "managerId",
        "createdAt",
        "updatedAt"
      ]
    },
    {
      name: "ActivityType",
      rows: activityTypes as any,
      columns: ["id", "teamId", "name", "isActive", "createdAt", "updatedAt"]
    },
    {
      name: "Setting",
      rows: settings as any,
      columns: ["key", "value", "createdAt", "updatedAt"]
    },
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
    {
      name: "DailyReportActivity",
      rows: dailyReportActivities as any,
      columns: ["id", "reportId", "type", "desc", "minutes", "createdAt"]
    },
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
    {
      name: "TaskEvent",
      rows: taskEvents as any,
      columns: ["id", "taskId", "action", "actorId", "actorEmail", "actorName", "comment", "createdAt"]
    },
    {
      name: "TaskComment",
      rows: taskComments as any,
      columns: ["id", "taskId", "authorId", "body", "createdAt"]
    },
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
    {
      name: "AbsenceEvent",
      rows: absenceEvents as any,
      columns: ["id", "absenceId", "action", "actorId", "actorEmail", "actorName", "comment", "createdAt"]
    },
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
    {
      name: "PerformanceQuestion",
      rows: perfQuestions as any,
      columns: ["id", "qNo", "area", "description", "scale", "isActive", "createdAt", "updatedAt"]
    },
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
    {
      name: "OrgPosition",
      rows: orgPositions as any,
      columns: ["id", "title", "description", "parentId", "order", "isActive", "createdAt", "updatedAt"]
    },
    {
      name: "OrgPositionAssignment",
      rows: orgAssignments as any,
      columns: ["id", "positionId", "userId", "createdAt"]
    },
    {
      name: "OrgPositionLink",
      rows: orgLinks as any,
      columns: ["id", "positionId", "label", "url", "order", "createdAt"]
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
    {
      name: "Session",
      rows: sessions as any,
      columns: ["id", "sessionToken", "userId", "expires"]
    },
    {
      name: "VerificationToken",
      rows: verificationTokens as any,
      columns: ["identifier", "token", "expires"]
    }
  ];

  for (const table of tables) {
    const csv = rowsToCsv(table.rows, table.columns);
    zip.file(`${table.name}.csv`, csv);
  }
}

function isoTimestamp() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

export async function createBackupZip() {
  const zip = new JSZip();
  await exportAllTablesAsCsv(zip);
  const bytes = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  const filename = `db-backup-${isoTimestamp()}.zip`;
  return { filename, bytes };
}

export async function ensureDir(dirPath: string) {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function writeBackupZipToDisk(params: { folder: string }) {
  const { filename, bytes } = await createBackupZip();
  const folderAbs = path.isAbsolute(params.folder) ? params.folder : path.join(process.cwd(), params.folder);
  await ensureDir(folderAbs);
  const fullPath = path.join(folderAbs, filename);
  await fs.writeFile(fullPath, bytes);
  return { filename, fullPath, sizeBytes: bytes.byteLength };
}

export async function listBackupFiles(folder: string) {
  const folderAbs = path.isAbsolute(folder) ? folder : path.join(process.cwd(), folder);
  try {
    const entries = await fs.readdir(folderAbs, { withFileTypes: true });
    const files = entries
      .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".zip"))
      .map((e) => e.name);

    const stats = await Promise.all(
      files.map(async (name) => {
        const fullPath = path.join(folderAbs, name);
        const st = await fs.stat(fullPath);
        return { name, fullPath, sizeBytes: st.size, mtimeMs: st.mtimeMs };
      })
    );

    stats.sort((a, b) => b.mtimeMs - a.mtimeMs);
    return stats;
  } catch {
    return [];
  }
}

export async function readBackupFile(params: { folder: string; name: string }) {
  const safeName = path.basename(params.name);
  if (safeName !== params.name) throw new Error("INVALID_NAME");
  const folderAbs = path.isAbsolute(params.folder) ? params.folder : path.join(process.cwd(), params.folder);
  const fullPath = path.join(folderAbs, safeName);
  const bytes = await fs.readFile(fullPath);
  return { filename: safeName, bytes, fullPath };
}
