import "server-only";

import JSZip from "jszip";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { logInfo } from "./log";

type CsvCell = string | number | boolean | Date | Buffer | object | null | undefined;

type TableExport = {
  name: string;
  columns: string[];
  fetchRows: () => Promise<Array<Record<string, any>>>;
  countRows: () => Promise<number>;
};

type BackupManifest = {
  schemaVersion: number;
  createdAt: string;
  totalRows: number;
  tables: Record<string, number>;
};

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

function isoTimestamp() {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

function buildFilename(runKey?: string | null) {
  const suffix = String(runKey || isoTimestamp())
    .trim()
    .replaceAll(/[^a-zA-Z0-9._-]+/g, "_")
    .replaceAll(/_+/g, "_")
    .replaceAll(/^_+|_+$/g, "");
  return `db-backup-${suffix || isoTimestamp()}.zip`;
}

function isUniqueConstraintError(error: unknown, fieldName?: string) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false;
  if (!fieldName) return true;
  const target = (error.meta?.target ?? []) as string[] | string;
  return Array.isArray(target) ? target.includes(fieldName) : String(target).includes(fieldName);
}

const TABLE_EXPORTS: TableExport[] = [
  {
    name: "Team",
    columns: ["id", "name", "createdAt", "updatedAt"],
    fetchRows: () => prisma.team.findMany({ orderBy: { createdAt: "asc" } }) as any,
    countRows: () => prisma.team.count()
  },
  {
    name: "User",
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
      "adminAddon",
      "companyCalendarAddon",
      "status",
      "carryOverAnnualLeave",
      "annualLeaveDays",
      "homeOfficeDays",
      "slavaDays",
      "employmentDate",
      "jobDescriptionUrl",
      "workInstructionsUrl",
      "teamId",
      "managerId",
      "createdAt",
      "updatedAt"
    ],
    fetchRows: () => prisma.user.findMany({ orderBy: { createdAt: "asc" } }) as any,
    countRows: () => prisma.user.count()
  },
  {
    name: "CompanyEvent",
    columns: ["id", "title", "description", "location", "status", "startsAt", "endsAt", "allDay", "createdById", "createdAt", "updatedAt"],
    fetchRows: () => prisma.companyEvent.findMany({ orderBy: { createdAt: "asc" } }) as any,
    countRows: () => prisma.companyEvent.count()
  },
  {
    name: "CompanyEventParticipant",
    columns: ["id", "eventId", "userId", "createdAt"],
    fetchRows: () => prisma.companyEventParticipant.findMany({ orderBy: { createdAt: "asc" } }) as any,
    countRows: () => prisma.companyEventParticipant.count()
  },
  {
    name: "CompanyEventPosition",
    columns: ["id", "eventId", "positionId", "createdAt"],
    fetchRows: () => prisma.companyEventPosition.findMany({ orderBy: { createdAt: "asc" } }) as any,
    countRows: () => prisma.companyEventPosition.count()
  },
  {
    name: "ActivityType",
    columns: ["id", "teamId", "name", "isActive", "createdAt", "updatedAt"],
    fetchRows: () => prisma.activityType.findMany({ orderBy: { createdAt: "asc" } }) as any,
    countRows: () => prisma.activityType.count()
  },
  {
    name: "Setting",
    columns: ["key", "value", "createdAt", "updatedAt"],
    fetchRows: () => prisma.setting.findMany({ orderBy: { key: "asc" } }) as any,
    countRows: () => prisma.setting.count()
  },
  {
    name: "DailyReport",
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
    ],
    fetchRows: () => prisma.dailyReport.findMany({ orderBy: { createdAt: "asc" } }) as any,
    countRows: () => prisma.dailyReport.count()
  },
  {
    name: "DailyReportActivity",
    columns: ["id", "reportId", "type", "desc", "minutes", "createdAt"],
    fetchRows: () => prisma.dailyReportActivity.findMany({ orderBy: { createdAt: "asc" } }) as any,
    countRows: () => prisma.dailyReportActivity.count()
  },
  {
    name: "Task",
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
    ],
    fetchRows: () => prisma.task.findMany({ orderBy: { createdAt: "asc" } }) as any,
    countRows: () => prisma.task.count()
  },
  {
    name: "TaskEvent",
    columns: ["id", "taskId", "action", "actorId", "actorEmail", "actorName", "comment", "createdAt"],
    fetchRows: () => prisma.taskEvent.findMany({ orderBy: { createdAt: "asc" } }) as any,
    countRows: () => prisma.taskEvent.count()
  },
  {
    name: "TaskComment",
    columns: ["id", "taskId", "authorId", "body", "createdAt"],
    fetchRows: () => prisma.taskComment.findMany({ orderBy: { createdAt: "asc" } }) as any,
    countRows: () => prisma.taskComment.count()
  },
  {
    name: "Absence",
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
    ],
    fetchRows: () => prisma.absence.findMany({ orderBy: { createdAt: "asc" } }) as any,
    countRows: () => prisma.absence.count()
  },
  {
    name: "AbsenceEvent",
    columns: ["id", "absenceId", "action", "actorId", "actorEmail", "actorName", "comment", "createdAt"],
    fetchRows: () => prisma.absenceEvent.findMany({ orderBy: { createdAt: "asc" } }) as any,
    countRows: () => prisma.absenceEvent.count()
  },
  {
    name: "PerformanceEvaluation",
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
    ],
    fetchRows: () => prisma.performanceEvaluation.findMany({ orderBy: { createdAt: "asc" } }) as any,
    countRows: () => prisma.performanceEvaluation.count()
  },
  {
    name: "PerformanceQuestion",
    columns: ["id", "qNo", "area", "description", "scale", "isActive", "createdAt", "updatedAt"],
    fetchRows: () => prisma.performanceQuestion.findMany({ orderBy: { qNo: "asc" } }) as any,
    countRows: () => prisma.performanceQuestion.count()
  },
  {
    name: "PerformanceGoal",
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
    ],
    fetchRows: () => prisma.performanceGoal.findMany({ orderBy: { updatedAt: "asc" } }) as any,
    countRows: () => prisma.performanceGoal.count()
  },
  {
    name: "PerformancePersonalItem",
    columns: ["id", "evaluationId", "questionId", "qNo", "area", "description", "scale", "managerRating", "managerComment", "updatedAt"],
    fetchRows: () => prisma.performancePersonalItem.findMany({ orderBy: { updatedAt: "asc" } }) as any,
    countRows: () => prisma.performancePersonalItem.count()
  },
  {
    name: "PerformanceLog",
    columns: ["id", "evaluationId", "goalId", "actorId", "actorEmail", "action", "field", "oldValue", "newValue", "createdAt"],
    fetchRows: () => prisma.performanceLog.findMany({ orderBy: { createdAt: "asc" } }) as any,
    countRows: () => prisma.performanceLog.count()
  },
  {
    name: "OrgPosition",
    columns: ["id", "title", "description", "parentId", "kind", "teamId", "tier", "order", "isActive", "createdAt", "updatedAt"],
    fetchRows: () => prisma.orgPosition.findMany({ orderBy: { order: "asc" } }) as any,
    countRows: () => prisma.orgPosition.count()
  },
  {
    name: "OrgPositionAssignment",
    columns: ["id", "positionId", "userId", "createdAt"],
    fetchRows: () => prisma.orgPositionAssignment.findMany({ orderBy: { createdAt: "asc" } }) as any,
    countRows: () => prisma.orgPositionAssignment.count()
  },
  {
    name: "OrgPositionLink",
    columns: ["id", "positionId", "label", "description", "url", "type", "order", "createdAt", "updatedAt"],
    fetchRows: () => prisma.orgPositionLink.findMany({ orderBy: { order: "asc" } }) as any,
    countRows: () => prisma.orgPositionLink.count()
  },
  {
    name: "OrgGlobalLink",
    columns: ["id", "label", "description", "url", "type", "order", "createdAt", "updatedAt"],
    fetchRows: () => prisma.orgGlobalLink.findMany({ orderBy: { order: "asc" } }) as any,
    countRows: () => prisma.orgGlobalLink.count()
  },
  {
    name: "OnboardingTemplate",
    columns: ["id", "positionId", "title", "description", "isActive", "createdById", "createdAt", "updatedAt"],
    fetchRows: () => prisma.onboardingTemplate.findMany({ orderBy: { createdAt: "asc" } }) as any,
    countRows: () => prisma.onboardingTemplate.count()
  },
  {
    name: "OnboardingTemplateStep",
    columns: [
      "id",
      "templateId",
      "title",
      "description",
      "ownerType",
      "dueOffsetDays",
      "mentorId",
      "hrConfirmationRequired",
      "managerConfirmationRequired",
      "links",
      "order",
      "createdAt",
      "updatedAt"
    ],
    fetchRows: () => prisma.onboardingTemplateStep.findMany({ orderBy: { order: "asc" } }) as any,
    countRows: () => prisma.onboardingTemplateStep.count()
  },
  {
    name: "Onboarding",
    columns: [
      "id",
      "processId",
      "candidateId",
      "employeeId",
      "positionId",
      "templateId",
      "teamId",
      "managerId",
      "hrOwnerId",
      "startDate",
      "status",
      "note",
      "jobDescriptionUrl",
      "workInstructionsUrl",
      "onboardingDocsUrl",
      "createdAt",
      "updatedAt"
    ],
    fetchRows: () => prisma.onboarding.findMany({ orderBy: { createdAt: "asc" } }) as any,
    countRows: () => prisma.onboarding.count()
  },
  {
    name: "OnboardingItem",
    columns: [
      "id",
      "onboardingId",
      "templateStepId",
      "title",
      "description",
      "ownerType",
      "driveUrl",
      "links",
      "dueDate",
      "mentorId",
      "hrConfirmationRequired",
      "managerConfirmationRequired",
      "isCompleted",
      "completedAt",
      "completedById",
      "hrConfirmedAt",
      "hrConfirmedById",
      "managerConfirmedAt",
      "managerConfirmedById",
      "order",
      "createdAt",
      "updatedAt"
    ],
    fetchRows: () => prisma.onboardingItem.findMany({ orderBy: { order: "asc" } }) as any,
    countRows: () => prisma.onboardingItem.count()
  },
  {
    name: "HrProcess",
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
    ],
    fetchRows: () => prisma.hrProcess.findMany({ orderBy: { createdAt: "asc" } }) as any,
    countRows: () => prisma.hrProcess.count()
  },
  {
    name: "HrCandidate",
    columns: [
      "id",
      "fullName",
      "email",
      "phone",
      "linkedIn",
      "source",
      "cvDriveUrl",
      "talentPoolTag",
      "lastContactAt",
      "latestCvFileName",
      "latestCvMimeType",
      "latestCvSizeBytes",
      "latestCvUploadedAt",
      "latestCvData",
      "createdById",
      "createdAt",
      "updatedAt"
    ],
    fetchRows: () => prisma.hrCandidate.findMany({ orderBy: { createdAt: "asc" } }) as any,
    countRows: () => prisma.hrCandidate.count()
  },
  {
    name: "HrProcessCandidate",
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
      "nextAction",
      "managerProposedSlots",
      "createdAt",
      "updatedAt"
    ],
    fetchRows: () => prisma.hrProcessCandidate.findMany({ orderBy: { createdAt: "asc" } }) as any,
    countRows: () => prisma.hrProcessCandidate.count()
  },
  {
    name: "HrCandidateComment",
    columns: ["id", "processCandidateId", "actorId", "stage", "body", "createdAt"],
    fetchRows: () => prisma.hrCandidateComment.findMany({ orderBy: { createdAt: "asc" } }) as any,
    countRows: () => prisma.hrCandidateComment.count()
  },
  {
    name: "HrNotification",
    columns: ["id", "userId", "processId", "processCandidateId", "type", "title", "body", "href", "isRead", "createdAt", "readAt"],
    fetchRows: () => prisma.hrNotification.findMany({ orderBy: { createdAt: "asc" } }) as any,
    countRows: () => prisma.hrNotification.count()
  },
  {
    name: "HrAuditLog",
    columns: ["id", "processId", "processCandidateId", "candidateId", "actorId", "action", "field", "oldValue", "newValue", "comment", "createdAt"],
    fetchRows: () => prisma.hrAuditLog.findMany({ orderBy: { createdAt: "asc" } }) as any,
    countRows: () => prisma.hrAuditLog.count()
  },
  {
    name: "ExternalCalendarEvent",
    columns: ["id", "entityType", "entityId", "calendarId", "googleEventId", "status", "lastSyncedAt", "errorMessage", "createdAt", "updatedAt"],
    fetchRows: () => prisma.externalCalendarEvent.findMany({ orderBy: { createdAt: "asc" } }) as any,
    countRows: () => prisma.externalCalendarEvent.count()
  },
  {
    name: "NotificationDelivery",
    columns: [
      "id",
      "channel",
      "provider",
      "entityType",
      "entityId",
      "recipientEmail",
      "subject",
      "status",
      "dedupeKey",
      "providerMessageId",
      "scheduledAt",
      "sentAt",
      "failedAt",
      "errorMessage",
      "createdAt",
      "updatedAt"
    ],
    fetchRows: () => prisma.notificationDelivery.findMany({ orderBy: { createdAt: "asc" } }) as any,
    countRows: () => prisma.notificationDelivery.count()
  },
  {
    name: "Account",
    columns: ["id", "userId", "type", "provider", "providerAccountId", "refresh_token", "access_token", "expires_at", "token_type", "scope", "id_token", "session_state"],
    fetchRows: () => prisma.account.findMany({ orderBy: { id: "asc" } }) as any,
    countRows: () => prisma.account.count()
  },
  {
    name: "Session",
    columns: ["id", "sessionToken", "userId", "expires"],
    fetchRows: () => prisma.session.findMany({ orderBy: { expires: "asc" } }) as any,
    countRows: () => prisma.session.count()
  },
  {
    name: "VerificationToken",
    columns: ["identifier", "token", "expires"],
    fetchRows: () => prisma.verificationToken.findMany({ orderBy: { expires: "asc" } }) as any,
    countRows: () => prisma.verificationToken.count()
  }
];

async function buildBackupManifest(): Promise<BackupManifest> {
  const tables: Record<string, number> = {};
  let totalRows = 0;

  for (const table of TABLE_EXPORTS) {
    const rowCount = await table.countRows();
    tables[table.name] = rowCount;
    totalRows += rowCount;
  }

  return {
    schemaVersion: 2,
    createdAt: new Date().toISOString(),
    totalRows,
    tables
  };
}

async function exportAllTablesAsCsv(zip: JSZip) {
  for (const table of TABLE_EXPORTS) {
    const rows = await table.fetchRows();
    zip.file(`${table.name}.csv`, rowsToCsv(rows, table.columns));
  }
}

export async function createBackupZip(filename = buildFilename()) {
  const zip = new JSZip();
  await exportAllTablesAsCsv(zip);
  const bytes = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  return { filename, bytes };
}

export async function ensureDir(_dirPath: string) {
  return;
}

export async function writeBackupZipToDisk(params: { folder: string; source?: string; runKey?: string | null }) {
  const folder = normalizeFolderKey(params.folder);
  const filename = buildFilename(params.runKey);
  const storageKey = `${folder}/${filename}`;
  const manifest = await buildBackupManifest();

  try {
    const snapshot = await prisma.backupSnapshot.create({
      data: {
        filename,
        storageKey,
        source: String(params.source || "MANUAL").trim() || "MANUAL",
        runKey: params.runKey || null,
        sizeBytes: 0,
        manifestJson: manifest,
        zipData: null,
        completedAt: new Date(),
        failedAt: null,
        errorMessage: null
      }
    });

    logInfo("backup.snapshot.created", {
      source: snapshot.source,
      filename: snapshot.filename,
      runKey: params.runKey || null,
      totalRows: manifest.totalRows
    });

    return { filename: snapshot.filename, fullPath: snapshot.storageKey, sizeBytes: snapshot.sizeBytes, duplicate: false as const };
  } catch (error) {
    if (params.runKey && isUniqueConstraintError(error, "runKey")) {
      const existing = await prisma.backupSnapshot.findUnique({
        where: { runKey: params.runKey },
        select: { filename: true, storageKey: true, sizeBytes: true }
      });
      if (existing) {
        return { filename: existing.filename, fullPath: existing.storageKey, sizeBytes: existing.sizeBytes, duplicate: true as const };
      }
    }
    throw error;
  }
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
      createdAt: true,
      completedAt: true,
      manifestJson: true
    }
  });

  return rows.map((row) => ({
    name: row.filename,
    fullPath: row.storageKey,
    sizeBytes: row.sizeBytes,
    mtimeMs: (row.completedAt || row.createdAt).getTime(),
    manifest: row.manifestJson as BackupManifest | null
  }));
}

export async function readBackupFile(params: { folder: string; name: string }) {
  const folderKey = normalizeFolderKey(params.folder);
  const filename = sanitizeBackupName(params.name);
  const storageKey = `${folderKey}/${filename}`;
  const snapshot = await prisma.backupSnapshot.findUnique({
    where: { storageKey },
    select: { id: true, filename: true, storageKey: true, sizeBytes: true, zipData: true }
  });
  if (!snapshot) throw new Error("NOT_FOUND");

  if (snapshot.zipData) {
    return { filename: snapshot.filename, bytes: Buffer.from(snapshot.zipData), fullPath: snapshot.storageKey };
  }

  try {
    const generated = await createBackupZip(snapshot.filename);
    if (snapshot.sizeBytes !== generated.bytes.byteLength) {
      await prisma.backupSnapshot.update({
        where: { id: snapshot.id },
        data: {
          sizeBytes: generated.bytes.byteLength,
          completedAt: new Date(),
          failedAt: null,
          errorMessage: null
        }
      });
    }
    return { filename: snapshot.filename, bytes: generated.bytes, fullPath: snapshot.storageKey };
  } catch (error) {
    await prisma.backupSnapshot
      .update({
        where: { id: snapshot.id },
        data: {
          failedAt: new Date(),
          errorMessage: String((error as Error)?.message || error).slice(0, 2000)
        }
      })
      .catch(() => null);
    throw error;
  }
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
