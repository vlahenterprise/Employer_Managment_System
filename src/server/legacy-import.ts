import "server-only";

import { prisma } from "./db";
import { normalizeIsoDate } from "./iso-date";
import { APP_TIMEZONE } from "./app-settings";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { getISOWeek, parseISO } from "date-fns";
import { z } from "zod";
import crypto from "node:crypto";

export type LegacyDataset =
  | "REPORTS"
  | "TASKS"
  | "TASK_EVENTS"
  | "REQUESTS"
  | "REQUEST_EVENTS"
  | "PERF_QUESTIONS"
  | "PERF_EVALUATIONS"
  | "PERF_GOALS"
  | "PERF_SELF"
  | "PERF_MANAGER"
  | "PERF_PERSONAL"
  | "PERF_SUMMARY"
  | "PERF_LOG";

export type LegacyImportResult = {
  dataset: LegacyDataset;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  notes: string[];
};

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function normalizeEmail(value: string) {
  return String(value || "").trim().toLowerCase();
}

function normalizeTeamName(value: string) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function parseIntOrNull(value: string) {
  const s = String(value ?? "").trim();
  if (!s) return null;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

function parseFloatOrNull(value: string) {
  const s = String(value ?? "").trim();
  if (!s) return null;
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function parseTsv(tsv: string) {
  const lines = String(tsv || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0);

  if (lines.length < 2) {
    return { ok: false as const, error: "Nema dovoljno redova (header + bar 1 red)." };
  }

  const header = lines[0].split("\t").map((h) => h.trim());
  const rows = lines.slice(1).map((line) => line.split("\t"));
  return { ok: true as const, header, rows };
}

function headerIndex(header: string[]) {
  const map = new Map<string, number>();
  header.forEach((col, idx) => map.set(normalizeHeader(col), idx));
  return map;
}

function idxOf(map: Map<string, number>, ...names: string[]) {
  for (const name of names) {
    const idx = map.get(normalizeHeader(name));
    if (idx !== undefined) return idx;
  }
  return null;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function isoFromUtcDate(d: Date) {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function parseSerialDate(value: string) {
  const s = String(value ?? "").trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  // Rough bounds: 2000-01-01..2100-01-01
  if (n < 36526 || n > 73050) return null;

  // Excel / Google Sheets date serial (days since 1899-12-30).
  const baseMs = Date.UTC(1899, 11, 30);
  const ms = baseMs + Math.round(n * 24 * 60 * 60 * 1000);
  return new Date(ms);
}

function normalizeIsoDateLoose(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const direct = normalizeIsoDate(raw);
  if (direct) return direct;

  const isoHit = raw.match(/(\d{4}-\d{1,2}-\d{1,2})/);
  if (isoHit?.[1]) return normalizeIsoDate(isoHit[1]);

  const ymdSlash = raw.match(/(\d{4}\/\d{1,2}\/\d{1,2})/);
  if (ymdSlash?.[1]) return normalizeIsoDate(ymdSlash[1]);

  const dmy = raw.match(/(\d{1,2}[./-]\d{1,2}[./-]\d{4})/);
  if (dmy?.[1]) return normalizeIsoDate(dmy[1]);

  const serial = parseSerialDate(raw);
  if (serial) return formatInTimeZone(serial, "UTC", "yyyy-MM-dd");

  const dt = new Date(raw);
  if (!Number.isNaN(dt.getTime())) return formatInTimeZone(dt, APP_TIMEZONE, "yyyy-MM-dd");

  return null;
}

function parseDateTimeLoose(value: string | null | undefined, fallbackIsoDay: string | null = null) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    if (!fallbackIsoDay) return null;
    return fromZonedTime(`${fallbackIsoDay}T00:00:00`, APP_TIMEZONE);
  }

  const serial = parseSerialDate(raw);
  if (serial) return serial;

  const dt = new Date(raw);
  if (!Number.isNaN(dt.getTime())) return dt;

  const iso = normalizeIsoDateLoose(raw);
  if (iso) return fromZonedTime(`${iso}T00:00:00`, APP_TIMEZONE);

  return null;
}

async function ensureTeams(teamNames: string[]) {
  const names = [...new Set(teamNames.map((t) => normalizeTeamName(t)).filter(Boolean))];
  if (names.length === 0) return new Map<string, string>();

  const existing = await prisma.team.findMany({ where: { name: { in: names } }, select: { id: true, name: true } });
  const idByName = new Map(existing.map((t) => [t.name, t.id]));

  for (const name of names) {
    if (idByName.has(name)) continue;
    try {
      const created = await prisma.team.create({ data: { name }, select: { id: true, name: true } });
      idByName.set(created.name, created.id);
    } catch {
      // ignore
    }
  }

  return idByName;
}

const emailSchema = z.string().email();

async function ensureUsers(params: {
  users: Array<{ email: string; name?: string | null; teamName?: string | null; position?: string | null }>;
  teamIdByName: Map<string, string>;
}) {
  const uniqueEmails = [...new Set(params.users.map((u) => normalizeEmail(u.email)).filter(Boolean))];
  const existing = await prisma.user.findMany({
    where: { email: { in: uniqueEmails } },
    select: { id: true, email: true, name: true, position: true, teamId: true }
  });
  const idByEmail = new Map(existing.map((u) => [u.email, u.id]));

  for (const u of params.users) {
    const email = normalizeEmail(u.email);
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) continue;
    if (idByEmail.has(email)) continue;

    const teamName = normalizeTeamName(u.teamName || "");
    const teamId = teamName ? params.teamIdByName.get(teamName) ?? null : null;

    try {
      const created = await prisma.user.create({
        data: {
          email,
          name: String(u.name || "").trim() || email.split("@")[0],
          role: "USER",
          status: "ACTIVE",
          teamId,
          position: (String(u.position || "").trim() || null) as any,
          passwordHash: null
        },
        select: { id: true, email: true }
      });
      idByEmail.set(created.email, created.id);
    } catch {
      // ignore
    }
  }

  return idByEmail;
}

function stableId(prefix: string, parts: Array<string | number | null | undefined>) {
  const base = parts.map((p) => String(p ?? "")).join("|");
  const hash = crypto.createHash("sha256").update(base).digest("hex").slice(0, 24);
  return `${prefix}_${hash}`;
}

export async function importLegacyDataset(params: {
  dataset: LegacyDataset;
  tsv: string;
  overwriteExisting: boolean;
}): Promise<LegacyImportResult> {
  if (params.dataset === "REPORTS") return importLegacyReports(params);
  if (params.dataset === "TASKS") return importLegacyTasks(params);
  if (params.dataset === "TASK_EVENTS") return importLegacyTaskEvents(params);
  if (params.dataset === "REQUESTS") return importLegacyRequests(params);
  if (params.dataset === "REQUEST_EVENTS") return importLegacyRequestEvents(params);
  if (params.dataset === "PERF_QUESTIONS") return importLegacyPerfQuestions(params);
  if (params.dataset === "PERF_EVALUATIONS") return importLegacyPerfEvaluations(params);
  if (params.dataset === "PERF_GOALS") return importLegacyPerfGoals(params);
  if (params.dataset === "PERF_SELF") return importLegacyPerfSelf(params);
  if (params.dataset === "PERF_MANAGER") return importLegacyPerfManager(params);
  if (params.dataset === "PERF_PERSONAL") return importLegacyPerfPersonal(params);
  if (params.dataset === "PERF_SUMMARY") return importLegacyPerfSummary(params);
  return importLegacyPerfLog(params);
}

async function importLegacyReports(params: { dataset: LegacyDataset; tsv: string; overwriteExisting: boolean }): Promise<LegacyImportResult> {
  const parsed = parseTsv(params.tsv);
  if (!parsed.ok) {
    return { dataset: "REPORTS", created: 0, updated: 0, skipped: 0, errors: 1, notes: [parsed.error] };
  }

  const map = headerIndex(parsed.header);
  const emailIdx = idxOf(map, "Email");
  const nameIdx = idxOf(map, "Name", "EmployeeName", "Employers");
  const teamIdx = idxOf(map, "Team");
  const positionIdx = idxOf(map, "Position");
  const reportDateIdx = idxOf(map, "ReportDateIso", "ReportDate");
  const typeIdx = idxOf(map, "ActivtyType", "ActivityType", "Type");
  const descIdx = idxOf(map, "ActivityDescription", "ActivtyDescription", "Description");
  const minutesIdx = idxOf(map, "ActivtyDuration", "ActivityDuration", "Minutes", "Duration");
  const reportIdIdx = idxOf(map, "ReportID", "ReportId");
  const activityIdIdx = idxOf(map, "ActivityID", "ActivityId");
  const timestampIdx = idxOf(map, "TimeStamp", "Timestamp", "CreatedAt");

  const missing: string[] = [];
  if (emailIdx === null) missing.push("Email");
  if (reportDateIdx === null) missing.push("ReportDate");
  if (typeIdx === null) missing.push("ActivtyType");
  if (descIdx === null) missing.push("ActivityDescription");
  if (minutesIdx === null) missing.push("ActivtyDuration");
  if (missing.length) {
    return { dataset: "REPORTS", created: 0, updated: 0, skipped: 0, errors: 1, notes: [`Missing columns: ${missing.join(", ")}`] };
  }

  const emailCol = emailIdx!;
  const reportDateCol = reportDateIdx!;
  const typeCol = typeIdx!;
  const descCol = descIdx!;
  const minutesCol = minutesIdx!;

  type Group = {
    email: string;
    dateIso: string;
    name: string;
    teamName: string;
    position: string | null;
    reportId: string | null;
    createdAt: Date | null;
    activities: Array<{ id?: string; type: string; desc: string; minutes: number }>;
  };

  const groups = new Map<string, Group>();
  const userHints: Array<{ email: string; name?: string; teamName?: string; position?: string | null }> = [];
  const teamNames: string[] = [];

  for (const row of parsed.rows) {
    const emailRaw = row[emailCol] ?? "";
    const email = normalizeEmail(emailRaw);
    const emailParsed = emailSchema.safeParse(email);
    if (!emailParsed.success) continue;

    const dateIso = normalizeIsoDateLoose(row[reportDateCol] ?? "");
    if (!dateIso) continue;

    const type = String(row[typeCol] ?? "").trim();
    const desc = String(row[descCol] ?? "").trim();
    const minutesRaw = row[minutesCol] ?? "";
    const minutes = parseIntOrNull(minutesRaw) ?? Math.floor(parseFloatOrNull(minutesRaw) ?? 0);
    if (!type || !desc || !Number.isFinite(minutes) || minutes <= 0) continue;

    const key = `${email}|${dateIso}`;
    const existing = groups.get(key);
    if (!existing) {
      const name = String(nameIdx === null ? "" : (row[nameIdx] ?? "")).trim();
      const teamName = String(teamIdx === null ? "" : (row[teamIdx] ?? "")).trim();
      const position = positionIdx === null ? null : String(row[positionIdx] ?? "").trim() || null;
      const reportId = reportIdIdx === null ? null : String(row[reportIdIdx] ?? "").trim() || null;
      const createdAt = parseDateTimeLoose(timestampIdx === null ? null : row[timestampIdx]) ?? null;

      groups.set(key, {
        email,
        dateIso,
        name,
        teamName,
        position,
        reportId,
        createdAt,
        activities: []
      });

      userHints.push({ email, name, teamName, position });
      if (teamName) teamNames.push(teamName);
    }

    const g = groups.get(key)!;
    const activityId = activityIdIdx === null ? "" : String(row[activityIdIdx] ?? "").trim();
    g.activities.push({
      ...(activityId ? { id: activityId } : {}),
      type,
      desc,
      minutes
    });
  }

  if (groups.size === 0) {
    return { dataset: "REPORTS", created: 0, updated: 0, skipped: 0, errors: 0, notes: ["Nema validnih redova za import."] };
  }

  const teamIdByName = await ensureTeams(teamNames);
  const userIdByEmail = await ensureUsers({ users: userHints, teamIdByName });

  let created = 0;
  let skipped = 0;
  let errors = 0;
  const notes: string[] = [];

  for (const g of groups.values()) {
    const userId = userIdByEmail.get(g.email) ?? null;
    if (!userId) {
      errors += 1;
      continue;
    }

    if (params.overwriteExisting) {
      await prisma.dailyReport
        .delete({ where: { userId_dateIso: { userId, dateIso: g.dateIso } } })
        .catch(() => null);
    }

    const date = parseISO(g.dateIso);
    const week = getISOWeek(date);
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    const totalMinutes = g.activities.reduce((sum, a) => sum + a.minutes, 0);

    const teamNameNorm = normalizeTeamName(g.teamName || "");
    const teamName = teamNameNorm || "";

    try {
      await prisma.dailyReport.create({
        data: {
          ...(g.reportId ? { id: g.reportId } : {}),
          userId,
          dateIso: g.dateIso,
          employeeEmail: g.email,
          employeeName: g.name || g.email.split("@")[0],
          teamName,
          position: g.position,
          week,
          month,
          year,
          totalMinutes,
          ...(g.createdAt ? { createdAt: g.createdAt, updatedAt: g.createdAt } : {}),
          activities: {
            createMany: {
              data: g.activities.map((a) => ({
                ...(a.id ? { id: a.id } : {}),
                type: a.type,
                desc: a.desc,
                minutes: a.minutes
              }))
            }
          }
        }
      });
      created += 1;
    } catch (e: any) {
      // If not overwriting, duplicates will fail due to unique (userId,dateIso).
      const code = String(e?.code || "");
      if (code === "P2002" && !params.overwriteExisting) {
        skipped += 1;
        continue;
      }
      errors += 1;
    }
  }

  if (errors) notes.push("Neki redovi nisu importovani (npr. nepoznat user ili duplikat).");

  return {
    dataset: "REPORTS",
    created,
    updated: 0,
    skipped,
    errors,
    notes
  };
}

function mapTaskPriority(value: string) {
  const v = String(value || "").trim().toUpperCase();
  if (v === "LOW" || v === "MED" || v === "HIGH" || v === "CRIT") return v as "LOW" | "MED" | "HIGH" | "CRIT";
  return "MED";
}

function mapTaskStatus(value: string) {
  const v = String(value || "").trim().toUpperCase();
  const allowed = ["OPEN", "IN_PROGRESS", "FOR_APPROVAL", "RETURNED", "APPROVED", "CANCELLED"];
  if (allowed.includes(v)) return v as any;
  return "OPEN";
}

async function importLegacyTasks(params: { dataset: LegacyDataset; tsv: string; overwriteExisting: boolean }): Promise<LegacyImportResult> {
  const parsed = parseTsv(params.tsv);
  if (!parsed.ok) {
    return { dataset: "TASKS", created: 0, updated: 0, skipped: 0, errors: 1, notes: [parsed.error] };
  }

  const map = headerIndex(parsed.header);
  const taskIdIdx = idxOf(map, "TaskID", "TaskId");
  const titleIdx = idxOf(map, "Title");
  const descriptionIdx = idxOf(map, "Description");
  const priorityIdx = idxOf(map, "Priority");
  const statusIdx = idxOf(map, "Status");
  const teamIdx = idxOf(map, "Team");
  const assigneeEmailIdx = idxOf(map, "AssigneeEmail", "EmployeeEmail");
  const assigneeNameIdx = idxOf(map, "AssigneeName", "EmployeeName");
  const dueDateIdx = idxOf(map, "DueDate", "DueDateIso", "Due");
  const delegatedAtIdx = idxOf(map, "DelegatedAtIso", "DelegatedAt");
  const forApprovalAtIdx = idxOf(map, "ForApprovalAt");
  const approvedAtIdx = idxOf(map, "ApprovedAt");
  const returnedCountIdx = idxOf(map, "ReturnedCount");
  const lastUpdatedAtIdx = idxOf(map, "LastUpdatedAt", "UpdatedAt");
  const createdAtIdx = idxOf(map, "CreatedAt");
  const createdByEmailIdx = idxOf(map, "CreatedByEmail", "DelegatorEmail");
  const createdByNameIdx = idxOf(map, "CreatedByName", "DelegatorName");
  const employeeCommentIdx = idxOf(map, "EmployeeComment");
  const adminCommentIdx = idxOf(map, "AdminComment");

  const missing: string[] = [];
  if (taskIdIdx === null) missing.push("TaskID");
  if (titleIdx === null) missing.push("Title");
  if (descriptionIdx === null) missing.push("Description");
  if (assigneeEmailIdx === null) missing.push("AssigneeEmail");
  if (dueDateIdx === null) missing.push("DueDate");
  if (createdByEmailIdx === null) missing.push("CreatedByEmail");
  if (missing.length) {
    return { dataset: "TASKS", created: 0, updated: 0, skipped: 0, errors: 1, notes: [`Missing columns: ${missing.join(", ")}`] };
  }

  const taskIdCol = taskIdIdx!;
  const titleCol = titleIdx!;
  const descriptionCol = descriptionIdx!;
  const assigneeEmailCol = assigneeEmailIdx!;
  const dueDateCol = dueDateIdx!;
  const delegatorEmailCol = createdByEmailIdx!;

  const userHints: Array<{ email: string; name?: string | null; teamName?: string | null; position?: string | null }> = [];
  const teamNames: string[] = [];
  const rowsParsed: Array<{
    id: string;
    title: string;
    description: string;
    priority: "LOW" | "MED" | "HIGH" | "CRIT";
    status: string;
    teamName: string;
    assigneeEmail: string;
    assigneeName: string;
    delegatorEmail: string;
    delegatorName: string;
    dueIso: string;
    delegatedAt: Date | null;
    forApprovalAt: Date | null;
    approvedAt: Date | null;
    returnedCount: number;
    createdAt: Date | null;
    updatedAt: Date | null;
    employeeComment: string | null;
    adminComment: string | null;
  }> = [];

  for (const row of parsed.rows) {
    const id = String(row[taskIdCol] ?? "").trim();
    if (!id) continue;
    const title = String(row[titleCol] ?? "").trim();
    const description = String(row[descriptionCol] ?? "").trim();
    const assigneeEmail = normalizeEmail(String(row[assigneeEmailCol] ?? ""));
    const assigneeEmailParsed = emailSchema.safeParse(assigneeEmail);
    if (!assigneeEmailParsed.success) continue;
    const delegatorEmail = normalizeEmail(String(row[delegatorEmailCol] ?? ""));
    const delegatorEmailParsed = emailSchema.safeParse(delegatorEmail);
    if (!delegatorEmailParsed.success) continue;

    const dueIso = normalizeIsoDateLoose(row[dueDateCol] ?? "");
    if (!dueIso) continue;

    const teamName = String(teamIdx === null ? "" : (row[teamIdx] ?? "")).trim();
    if (teamName) teamNames.push(teamName);

    const assigneeName = String(assigneeNameIdx === null ? "" : (row[assigneeNameIdx] ?? "")).trim();
    const delegatorName = String(createdByNameIdx === null ? "" : (row[createdByNameIdx] ?? "")).trim();
    userHints.push({ email: assigneeEmail, name: assigneeName, teamName });
    userHints.push({ email: delegatorEmail, name: delegatorName });

    const createdAt = parseDateTimeLoose(createdAtIdx === null ? null : row[createdAtIdx], dueIso);
    const updatedAt = parseDateTimeLoose(lastUpdatedAtIdx === null ? null : row[lastUpdatedAtIdx], dueIso);
    const delegatedAtIso = normalizeIsoDateLoose(delegatedAtIdx === null ? null : row[delegatedAtIdx]);
    const delegatedAt = delegatedAtIso ? fromZonedTime(`${delegatedAtIso}T00:00:00`, APP_TIMEZONE) : createdAt;

    const forApprovalAt = parseDateTimeLoose(forApprovalAtIdx === null ? null : row[forApprovalAtIdx]) ?? null;
    const approvedAt = parseDateTimeLoose(approvedAtIdx === null ? null : row[approvedAtIdx]) ?? null;
    const returnedCount = Math.max(0, parseIntOrNull(returnedCountIdx === null ? "" : (row[returnedCountIdx] ?? "")) ?? 0);

    const employeeComment = employeeCommentIdx === null ? null : String(row[employeeCommentIdx] ?? "").trim() || null;
    const adminComment = adminCommentIdx === null ? null : String(row[adminCommentIdx] ?? "").trim() || null;

    rowsParsed.push({
      id,
      title,
      description,
      priority: mapTaskPriority(priorityIdx === null ? "" : String(row[priorityIdx] ?? "")),
      status: mapTaskStatus(statusIdx === null ? "" : String(row[statusIdx] ?? "")),
      teamName,
      assigneeEmail,
      assigneeName,
      delegatorEmail,
      delegatorName,
      dueIso,
      delegatedAt: delegatedAt ?? null,
      forApprovalAt,
      approvedAt,
      returnedCount,
      createdAt,
      updatedAt,
      employeeComment,
      adminComment
    });
  }

  if (rowsParsed.length === 0) {
    return { dataset: "TASKS", created: 0, updated: 0, skipped: 0, errors: 0, notes: ["Nema validnih redova za import."] };
  }

  const teamIdByName = await ensureTeams(teamNames);
  const userIdByEmail = await ensureUsers({ users: userHints, teamIdByName });

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  const notes: string[] = [];

  for (const r of rowsParsed) {
    const delegatorId = userIdByEmail.get(r.delegatorEmail) ?? null;
    const assigneeId = userIdByEmail.get(r.assigneeEmail) ?? null;
    if (!delegatorId || !assigneeId) {
      errors += 1;
      continue;
    }

    const dueDate = fromZonedTime(`${r.dueIso}T00:00:00`, APP_TIMEZONE);
    const teamNameNorm = normalizeTeamName(r.teamName || "");
    const teamId = teamNameNorm ? teamIdByName.get(teamNameNorm) ?? null : null;

    const exists = await prisma.task.findUnique({ where: { id: r.id }, select: { id: true } });
    if (exists && !params.overwriteExisting) {
      skipped += 1;
      continue;
    }

    try {
      if (!exists) {
        await prisma.task.create({
          data: {
            id: r.id,
            title: r.title,
            description: r.description,
            priority: r.priority,
            status: r.status as any,
            delegatorId,
            assigneeId,
            teamId,
            delegatedAt: r.delegatedAt ?? new Date(),
            dueDate,
            forApprovalAt: r.forApprovalAt,
            approvedAt: r.approvedAt,
            returnedCount: r.returnedCount,
            employeeComment: r.employeeComment,
            adminComment: r.adminComment,
            ...(r.createdAt ? { createdAt: r.createdAt } : {}),
            ...(r.updatedAt ? { updatedAt: r.updatedAt } : {})
          }
        });
        created += 1;
      } else {
        await prisma.task.update({
          where: { id: r.id },
          data: {
            title: r.title,
            description: r.description,
            priority: r.priority,
            status: r.status as any,
            delegatorId,
            assigneeId,
            teamId,
            delegatedAt: r.delegatedAt ?? new Date(),
            dueDate,
            forApprovalAt: r.forApprovalAt,
            approvedAt: r.approvedAt,
            returnedCount: r.returnedCount,
            employeeComment: r.employeeComment,
            adminComment: r.adminComment,
            ...(r.createdAt ? { createdAt: r.createdAt } : {}),
            ...(r.updatedAt ? { updatedAt: r.updatedAt } : {})
          }
        });
        updated += 1;
      }
    } catch {
      errors += 1;
    }
  }

  if (errors) notes.push("Neki taskovi nisu importovani (npr. nedostaje user ili invalid date).");

  return { dataset: "TASKS", created, updated, skipped, errors, notes };
}

async function importLegacyTaskEvents(params: { dataset: LegacyDataset; tsv: string; overwriteExisting: boolean }): Promise<LegacyImportResult> {
  const parsed = parseTsv(params.tsv);
  if (!parsed.ok) {
    return { dataset: "TASK_EVENTS", created: 0, updated: 0, skipped: 0, errors: 1, notes: [parsed.error] };
  }

  const map = headerIndex(parsed.header);
  const tsIdx = idxOf(map, "Timestamp", "TimeStamp");
  const taskIdIdx = idxOf(map, "TaskId", "TaskID");
  const actionIdx = idxOf(map, "Action");
  const actorEmailIdx = idxOf(map, "ActorEmail");
  const actorNameIdx = idxOf(map, "ActorName");
  const commentIdx = idxOf(map, "Comment");

  const missing: string[] = [];
  if (tsIdx === null) missing.push("Timestamp");
  if (taskIdIdx === null) missing.push("TaskId");
  if (actionIdx === null) missing.push("Action");
  if (actorEmailIdx === null) missing.push("ActorEmail");
  if (actorNameIdx === null) missing.push("ActorName");
  if (missing.length) {
    return { dataset: "TASK_EVENTS", created: 0, updated: 0, skipped: 0, errors: 1, notes: [`Missing columns: ${missing.join(", ")}`] };
  }

  const tsCol = tsIdx!;
  const taskIdCol = taskIdIdx!;
  const actionCol = actionIdx!;
  const actorEmailCol = actorEmailIdx!;
  const actorNameCol = actorNameIdx!;

  const actorHints: Array<{ email: string; name?: string | null }> = [];
  const events: Array<{
    id: string;
    taskId: string;
    action: string;
    actorEmail: string;
    actorName: string;
    comment: string | null;
    createdAt: Date;
  }> = [];

  for (const row of parsed.rows) {
    const taskId = String(row[taskIdCol] ?? "").trim();
    if (!taskId) continue;
    const action = String(row[actionCol] ?? "").trim().toUpperCase();
    if (!action) continue;
    const actorEmail = normalizeEmail(String(row[actorEmailCol] ?? ""));
    if (!emailSchema.safeParse(actorEmail).success) continue;
    const actorName = String(row[actorNameCol] ?? "").trim();
    const createdAt = parseDateTimeLoose(row[tsCol]) ?? new Date();
    const comment = commentIdx === null ? null : String(row[commentIdx] ?? "").trim() || null;

    const id = stableId("te", [taskId, action, actorEmail, createdAt.toISOString(), comment || ""]);
    events.push({ id, taskId, action, actorEmail, actorName, comment, createdAt });
    actorHints.push({ email: actorEmail, name: actorName });
  }

  if (events.length === 0) {
    return { dataset: "TASK_EVENTS", created: 0, updated: 0, skipped: 0, errors: 0, notes: ["Nema validnih redova za import."] };
  }

  const userIdByEmail = await ensureUsers({ users: actorHints, teamIdByName: new Map() });

  const existingTasks = await prisma.task.findMany({
    where: { id: { in: [...new Set(events.map((e) => e.taskId))] } },
    select: { id: true }
  });
  const taskIdSet = new Set(existingTasks.map((t) => t.id));

  const data = events
    .filter((e) => taskIdSet.has(e.taskId))
    .map((e) => ({
      id: e.id,
      taskId: e.taskId,
      action: e.action,
      actorId: userIdByEmail.get(e.actorEmail) ?? null,
      actorEmail: e.actorEmail,
      actorName: e.actorName || e.actorEmail,
      comment: e.comment,
      createdAt: e.createdAt
    }));

  if (data.length === 0) {
    return {
      dataset: "TASK_EVENTS",
      created: 0,
      updated: 0,
      skipped: events.length,
      errors: 0,
      notes: ["Nijedan event nije importovan (taskId ne postoji). Importuj TASKS prvo."]
    };
  }

  try {
    const res = await prisma.taskEvent.createMany({ data, skipDuplicates: true });
    const skipped = events.length - res.count;
    return { dataset: "TASK_EVENTS", created: res.count, updated: 0, skipped, errors: 0, notes: [] };
  } catch {
    return { dataset: "TASK_EVENTS", created: 0, updated: 0, skipped: 0, errors: 1, notes: ["Import task events nije uspeo."] };
  }
}

function mapAbsenceType(value: string) {
  const v = String(value || "").trim().toUpperCase();
  if (v === "ANNUAL_LEAVE") return "ANNUAL_LEAVE" as const;
  if (v === "HOME_OFFICE") return "HOME_OFFICE" as const;
  if (v === "SLAVA") return "SLAVA" as const;
  if (v === "SICK") return "SICK" as const;
  if (v === "OTHER") return "OTHER" as const;
  if (v.includes("SICK")) return "SICK" as const;
  if (v.includes("HOME")) return "HOME_OFFICE" as const;
  if (v.includes("SLAVA")) return "SLAVA" as const;
  if (v.includes("ANNUAL") || v.includes("VACATION")) return "ANNUAL_LEAVE" as const;
  return "OTHER" as const;
}

function mapAbsenceStatus(value: string) {
  const v = String(value || "").trim().toUpperCase();
  if (v === "PENDING") return "PENDING" as const;
  if (v === "APPROVED") return "APPROVED" as const;
  if (v === "REJECTED") return "REJECTED" as const;
  if (v === "CANCELLED") return "CANCELLED" as const;
  if (v.startsWith("REJECT") || v.startsWith("RETURN") || v.startsWith("DENY")) return "REJECTED" as const;
  return "PENDING" as const;
}

async function importLegacyRequests(params: { dataset: LegacyDataset; tsv: string; overwriteExisting: boolean }): Promise<LegacyImportResult> {
  const parsed = parseTsv(params.tsv);
  if (!parsed.ok) {
    return { dataset: "REQUESTS", created: 0, updated: 0, skipped: 0, errors: 1, notes: [parsed.error] };
  }

  const map = headerIndex(parsed.header);
  const idIdx = idxOf(map, "RequestId", "RequestID", "AbsenceId", "AbsenceID");
  const createdAtIdx = idxOf(map, "CreatedAt");
  const employeeEmailIdx = idxOf(map, "EmployeeEmail", "Email");
  const employeeNameIdx = idxOf(map, "EmployeeName", "Name");
  const teamIdx = idxOf(map, "Team");
  const typeIdx = idxOf(map, "Type");
  const fromIdx = idxOf(map, "DateFrom", "From", "FromIso");
  const toIdx = idxOf(map, "DateTo", "To", "ToIso");
  const daysIdx = idxOf(map, "Days");
  const statusIdx = idxOf(map, "Status");
  const approverEmailIdx = idxOf(map, "ApproverEmail");
  const approvedAtIdx = idxOf(map, "ApprovedAt");
  const commentIdx = idxOf(map, "Comment");
  const overlapIdx = idxOf(map, "OverlapWarning");

  const missing: string[] = [];
  if (idIdx === null) missing.push("RequestId");
  if (employeeEmailIdx === null) missing.push("EmployeeEmail");
  if (typeIdx === null) missing.push("Type");
  if (fromIdx === null) missing.push("DateFrom");
  if (toIdx === null) missing.push("DateTo");
  if (daysIdx === null) missing.push("Days");
  if (statusIdx === null) missing.push("Status");
  if (missing.length) {
    return { dataset: "REQUESTS", created: 0, updated: 0, skipped: 0, errors: 1, notes: [`Missing columns: ${missing.join(", ")}`] };
  }

  const idCol = idIdx!;
  const employeeEmailCol = employeeEmailIdx!;
  const typeCol = typeIdx!;
  const fromCol = fromIdx!;
  const toCol = toIdx!;
  const daysCol = daysIdx!;
  const statusCol = statusIdx!;

  const userHints: Array<{ email: string; name?: string | null; teamName?: string | null }> = [];
  const teamNames: string[] = [];

  const items: Array<{
    id: string;
    employeeEmail: string;
    employeeName: string;
    teamName: string;
    type: any;
    status: any;
    fromIso: string;
    toIso: string;
    days: number;
    approverEmail: string | null;
    approvedAt: Date | null;
    comment: string | null;
    overlapWarning: boolean;
    createdAt: Date | null;
  }> = [];

  for (const row of parsed.rows) {
    const id = String(row[idCol] ?? "").trim();
    if (!id) continue;
    const employeeEmail = normalizeEmail(String(row[employeeEmailCol] ?? ""));
    if (!emailSchema.safeParse(employeeEmail).success) continue;
    const employeeName = String(employeeNameIdx === null ? "" : (row[employeeNameIdx] ?? "")).trim();
    const teamName = String(teamIdx === null ? "" : (row[teamIdx] ?? "")).trim();
    if (teamName) teamNames.push(teamName);
    userHints.push({ email: employeeEmail, name: employeeName, teamName });

    const type = mapAbsenceType(String(row[typeCol] ?? ""));
    const status = mapAbsenceStatus(String(row[statusCol] ?? ""));

    const fromIso = normalizeIsoDateLoose(row[fromCol] ?? "");
    const toIso = normalizeIsoDateLoose(row[toCol] ?? "");
    if (!fromIso || !toIso) continue;
    const days = Math.max(0, parseIntOrNull(row[daysCol] ?? "") ?? 0);

    const approverEmailRaw = approverEmailIdx === null ? "" : String(row[approverEmailIdx] ?? "").trim();
    const approverEmail = approverEmailRaw ? normalizeEmail(approverEmailRaw) : null;
    if (approverEmail) userHints.push({ email: approverEmail });

    const approvedAt = parseDateTimeLoose(approvedAtIdx === null ? null : row[approvedAtIdx]) ?? null;
    const createdAt = parseDateTimeLoose(createdAtIdx === null ? null : row[createdAtIdx]) ?? null;
    const comment = commentIdx === null ? null : String(row[commentIdx] ?? "").trim() || null;
    const overlapRaw = overlapIdx === null ? "" : String(row[overlapIdx] ?? "").trim().toLowerCase();
    const overlapWarning = ["1", "true", "yes", "y", "on", "da", "ok", "warn", "warning", "overlap", "yes"].includes(overlapRaw) || overlapRaw === "YES".toLowerCase();

    items.push({
      id,
      employeeEmail,
      employeeName,
      teamName,
      type,
      status,
      fromIso,
      toIso,
      days,
      approverEmail,
      approvedAt,
      comment,
      overlapWarning,
      createdAt
    });
  }

  if (items.length === 0) {
    return { dataset: "REQUESTS", created: 0, updated: 0, skipped: 0, errors: 0, notes: ["Nema validnih redova za import."] };
  }

  const teamIdByName = await ensureTeams(teamNames);
  const userIdByEmail = await ensureUsers({ users: userHints, teamIdByName });

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const r of items) {
    const employeeId = userIdByEmail.get(r.employeeEmail) ?? null;
    if (!employeeId) {
      errors += 1;
      continue;
    }
    const approverId = r.approverEmail ? userIdByEmail.get(r.approverEmail) ?? null : null;

    const exists = await prisma.absence.findUnique({ where: { id: r.id }, select: { id: true } });
    if (exists && !params.overwriteExisting) {
      skipped += 1;
      continue;
    }

    const dateFrom = fromZonedTime(`${r.fromIso}T00:00:00`, APP_TIMEZONE);
    const dateTo = fromZonedTime(`${r.toIso}T23:59:59.999`, APP_TIMEZONE);

    try {
      if (!exists) {
        await prisma.absence.create({
          data: {
            id: r.id,
            employeeId,
            approverId,
            type: r.type,
            status: r.status,
            dateFrom,
            dateTo,
            days: r.days,
            comment: r.comment,
            overlapWarning: r.overlapWarning,
            approvedAt: r.approvedAt,
            ...(r.createdAt ? { createdAt: r.createdAt, updatedAt: r.createdAt } : {})
          }
        });
        created += 1;
      } else {
        await prisma.absence.update({
          where: { id: r.id },
          data: {
            employeeId,
            approverId,
            type: r.type,
            status: r.status,
            dateFrom,
            dateTo,
            days: r.days,
            comment: r.comment,
            overlapWarning: r.overlapWarning,
            approvedAt: r.approvedAt,
            ...(r.createdAt ? { createdAt: r.createdAt } : {})
          }
        });
        updated += 1;
      }
    } catch {
      errors += 1;
    }
  }

  return { dataset: "REQUESTS", created, updated, skipped, errors, notes: [] };
}

async function importLegacyRequestEvents(params: { dataset: LegacyDataset; tsv: string; overwriteExisting: boolean }): Promise<LegacyImportResult> {
  const parsed = parseTsv(params.tsv);
  if (!parsed.ok) {
    return { dataset: "REQUEST_EVENTS", created: 0, updated: 0, skipped: 0, errors: 1, notes: [parsed.error] };
  }

  const map = headerIndex(parsed.header);
  const tsIdx = idxOf(map, "Timestamp", "TimeStamp");
  const actionIdx = idxOf(map, "Action");
  const requestIdIdx = idxOf(map, "RequestId", "RequestID");
  const employeeEmailIdx = idxOf(map, "EmployeeEmail");
  const employeeNameIdx = idxOf(map, "EmployeeName");
  const approverEmailIdx = idxOf(map, "ApproverEmail");
  const commentIdx = idxOf(map, "Comment");

  const missing: string[] = [];
  if (tsIdx === null) missing.push("Timestamp");
  if (actionIdx === null) missing.push("Action");
  if (requestIdIdx === null) missing.push("RequestId");
  if (employeeEmailIdx === null) missing.push("EmployeeEmail");
  if (employeeNameIdx === null) missing.push("EmployeeName");
  if (missing.length) {
    return { dataset: "REQUEST_EVENTS", created: 0, updated: 0, skipped: 0, errors: 1, notes: [`Missing columns: ${missing.join(", ")}`] };
  }

  const tsCol = tsIdx!;
  const actionCol = actionIdx!;
  const requestIdCol = requestIdIdx!;
  const employeeEmailCol = employeeEmailIdx!;
  const employeeNameCol = employeeNameIdx!;

  const actorHints: Array<{ email: string; name?: string | null }> = [];
  const events: Array<{
    id: string;
    absenceId: string;
    action: string;
    actorEmail: string;
    actorName: string;
    comment: string | null;
    createdAt: Date;
  }> = [];

  for (const row of parsed.rows) {
    const absenceId = String(row[requestIdCol] ?? "").trim();
    if (!absenceId) continue;
    const action = String(row[actionCol] ?? "").trim().toUpperCase();
    if (!action) continue;

    const employeeEmail = normalizeEmail(String(row[employeeEmailCol] ?? ""));
    if (!emailSchema.safeParse(employeeEmail).success) continue;
    const employeeName = String(row[employeeNameCol] ?? "").trim();
    const approverEmailRaw = approverEmailIdx === null ? "" : String(row[approverEmailIdx] ?? "").trim();
    const approverEmail = approverEmailRaw ? normalizeEmail(approverEmailRaw) : "";

    // Derive actor: for SUBMITTED use employee; else use approver when present.
    const actorEmail = action === "SUBMITTED" || !approverEmail ? employeeEmail : approverEmail;
    const actorName = action === "SUBMITTED" || !approverEmail ? employeeName : "";
    actorHints.push({ email: actorEmail, name: actorName || null });

    const createdAt = parseDateTimeLoose(row[tsCol]) ?? new Date();
    const comment = commentIdx === null ? null : String(row[commentIdx] ?? "").trim() || null;
    const id = stableId("ae", [absenceId, action, actorEmail, createdAt.toISOString(), comment || ""]);
    events.push({ id, absenceId, action, actorEmail, actorName, comment, createdAt });
  }

  if (events.length === 0) {
    return { dataset: "REQUEST_EVENTS", created: 0, updated: 0, skipped: 0, errors: 0, notes: ["Nema validnih redova za import."] };
  }

  const userIdByEmail = await ensureUsers({ users: actorHints, teamIdByName: new Map() });

  const existingAbsences = await prisma.absence.findMany({
    where: { id: { in: [...new Set(events.map((e) => e.absenceId))] } },
    select: { id: true }
  });
  const absenceIdSet = new Set(existingAbsences.map((a) => a.id));

  const data = events
    .filter((e) => absenceIdSet.has(e.absenceId))
    .map((e) => ({
      id: e.id,
      absenceId: e.absenceId,
      action: e.action,
      actorId: userIdByEmail.get(e.actorEmail) ?? null,
      actorEmail: e.actorEmail,
      actorName: e.actorName || e.actorEmail,
      comment: e.comment,
      createdAt: e.createdAt
    }));

  if (data.length === 0) {
    return {
      dataset: "REQUEST_EVENTS",
      created: 0,
      updated: 0,
      skipped: events.length,
      errors: 0,
      notes: ["Nijedan event nije importovan (absenceId ne postoji). Importuj REQUESTS prvo."]
    };
  }

  try {
    const res = await prisma.absenceEvent.createMany({ data, skipDuplicates: true });
    const skipped = events.length - res.count;
    return { dataset: "REQUEST_EVENTS", created: res.count, updated: 0, skipped, errors: 0, notes: [] };
  } catch {
    return { dataset: "REQUEST_EVENTS", created: 0, updated: 0, skipped: 0, errors: 1, notes: ["Import request events nije uspeo."] };
  }
}

async function importLegacyPerfQuestions(params: { dataset: LegacyDataset; tsv: string; overwriteExisting: boolean }): Promise<LegacyImportResult> {
  const parsed = parseTsv(params.tsv);
  if (!parsed.ok) {
    return { dataset: "PERF_QUESTIONS", created: 0, updated: 0, skipped: 0, errors: 1, notes: [parsed.error] };
  }

  const map = headerIndex(parsed.header);
  const qNoIdx = idxOf(map, "Q_No", "QNo");
  const areaIdx = idxOf(map, "Area");
  const descIdx = idxOf(map, "Description");
  const scaleIdx = idxOf(map, "Scale");

  const missing: string[] = [];
  if (qNoIdx === null) missing.push("Q_No");
  if (areaIdx === null) missing.push("Area");
  if (descIdx === null) missing.push("Description");
  if (scaleIdx === null) missing.push("Scale");
  if (missing.length) {
    return { dataset: "PERF_QUESTIONS", created: 0, updated: 0, skipped: 0, errors: 1, notes: [`Missing columns: ${missing.join(", ")}`] };
  }

  const qNoCol = qNoIdx!;
  const areaCol = areaIdx!;
  const descCol = descIdx!;
  const scaleCol = scaleIdx!;

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of parsed.rows) {
    const qNo = parseIntOrNull(row[qNoCol] ?? "");
    if (!qNo || qNo < 1) continue;
    const area = String(row[areaCol] ?? "").trim();
    const description = String(row[descCol] ?? "").trim();
    const scale = String(row[scaleCol] ?? "").trim();
    if (!area || !description || !scale) continue;

    const exists = await prisma.performanceQuestion.findUnique({ where: { qNo }, select: { id: true } });
    if (exists && !params.overwriteExisting) {
      skipped += 1;
      continue;
    }

    try {
      if (!exists) {
        await prisma.performanceQuestion.create({ data: { qNo, area, description, scale, isActive: true } });
        created += 1;
      } else {
        await prisma.performanceQuestion.update({ where: { qNo }, data: { area, description, scale, isActive: true } });
        updated += 1;
      }
    } catch {
      errors += 1;
    }
  }

  return { dataset: "PERF_QUESTIONS", created, updated, skipped, errors, notes: [] };
}

function mapEvalStatus(value: string) {
  const v = String(value || "").trim().toUpperCase();
  if (v === "OPEN") return "OPEN" as const;
  if (v === "SELF_SUBMITTED") return "SELF_SUBMITTED" as const;
  if (v === "CLOSED") return "CLOSED" as const;
  if (v === "CANCELLED") return "CANCELLED" as const;
  return "OPEN" as const;
}

async function importLegacyPerfEvaluations(params: { dataset: LegacyDataset; tsv: string; overwriteExisting: boolean }): Promise<LegacyImportResult> {
  const parsed = parseTsv(params.tsv);
  if (!parsed.ok) {
    return { dataset: "PERF_EVALUATIONS", created: 0, updated: 0, skipped: 0, errors: 1, notes: [parsed.error] };
  }

  const map = headerIndex(parsed.header);
  const idIdx = idxOf(map, "EvalId", "EvalID");
  const createdAtIdx = idxOf(map, "CreatedAt");
  const periodStartIdx = idxOf(map, "PeriodStart");
  const periodEndIdx = idxOf(map, "PeriodEnd");
  const periodLabelIdx = idxOf(map, "PeriodLabel");
  const employeeEmailIdx = idxOf(map, "EmployeeEmail");
  const employeeNameIdx = idxOf(map, "EmployeeName");
  const teamIdx = idxOf(map, "Team");
  const managerEmailIdx = idxOf(map, "ManagerEmail");
  const statusIdx = idxOf(map, "Status");

  const missing: string[] = [];
  if (idIdx === null) missing.push("EvalId");
  if (periodStartIdx === null) missing.push("PeriodStart");
  if (periodEndIdx === null) missing.push("PeriodEnd");
  if (periodLabelIdx === null) missing.push("PeriodLabel");
  if (employeeEmailIdx === null) missing.push("EmployeeEmail");
  if (managerEmailIdx === null) missing.push("ManagerEmail");
  if (statusIdx === null) missing.push("Status");
  if (missing.length) {
    return { dataset: "PERF_EVALUATIONS", created: 0, updated: 0, skipped: 0, errors: 1, notes: [`Missing columns: ${missing.join(", ")}`] };
  }

  const idCol = idIdx!;
  const periodStartCol = periodStartIdx!;
  const periodEndCol = periodEndIdx!;
  const periodLabelCol = periodLabelIdx!;
  const employeeEmailCol = employeeEmailIdx!;
  const managerEmailCol = managerEmailIdx!;
  const statusCol = statusIdx!;

  const teamNames: string[] = [];
  const userHints: Array<{ email: string; name?: string | null; teamName?: string | null }> = [];

  const rowsParsed: Array<{
    id: string;
    createdAt: Date | null;
    startIso: string;
    endIso: string;
    label: string;
    employeeEmail: string;
    employeeName: string;
    teamName: string;
    managerEmail: string;
    status: any;
  }> = [];

  for (const row of parsed.rows) {
    const id = String(row[idCol] ?? "").trim();
    if (!id) continue;
    const employeeEmail = normalizeEmail(String(row[employeeEmailCol] ?? ""));
    const managerEmail = normalizeEmail(String(row[managerEmailCol] ?? ""));
    if (!emailSchema.safeParse(employeeEmail).success) continue;
    if (!emailSchema.safeParse(managerEmail).success) continue;

    const startIso = normalizeIsoDateLoose(row[periodStartCol] ?? "");
    const endIso = normalizeIsoDateLoose(row[periodEndCol] ?? "");
    if (!startIso || !endIso) continue;
    const label = String(row[periodLabelCol] ?? "").trim() || `${startIso} → ${endIso}`;

    const employeeName = String(employeeNameIdx === null ? "" : (row[employeeNameIdx] ?? "")).trim();
    const teamName = String(teamIdx === null ? "" : (row[teamIdx] ?? "")).trim();
    if (teamName) teamNames.push(teamName);
    userHints.push({ email: employeeEmail, name: employeeName, teamName });
    userHints.push({ email: managerEmail });

    const createdAt = parseDateTimeLoose(createdAtIdx === null ? null : row[createdAtIdx]) ?? null;
    const status = mapEvalStatus(String(row[statusCol] ?? ""));

    rowsParsed.push({
      id,
      createdAt,
      startIso,
      endIso,
      label,
      employeeEmail,
      employeeName,
      teamName,
      managerEmail,
      status
    });
  }

  if (rowsParsed.length === 0) {
    return { dataset: "PERF_EVALUATIONS", created: 0, updated: 0, skipped: 0, errors: 0, notes: ["Nema validnih redova za import."] };
  }

  const teamIdByName = await ensureTeams(teamNames);
  const userIdByEmail = await ensureUsers({ users: userHints, teamIdByName });
  const questions = await prisma.performanceQuestion.findMany({
    orderBy: { qNo: "asc" },
    select: { id: true, qNo: true, area: true, description: true, scale: true }
  });

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const r of rowsParsed) {
    const employeeId = userIdByEmail.get(r.employeeEmail) ?? null;
    const managerId = userIdByEmail.get(r.managerEmail) ?? null;
    if (!employeeId || !managerId) {
      errors += 1;
      continue;
    }

    const exists = await prisma.performanceEvaluation.findUnique({ where: { id: r.id }, select: { id: true } });
    if (exists && !params.overwriteExisting) {
      skipped += 1;
      continue;
    }

    const startAt = fromZonedTime(`${r.startIso}T00:00:00`, APP_TIMEZONE);
    const endAt = fromZonedTime(`${r.endIso}T00:00:00`, APP_TIMEZONE);
    const locked = r.status === "CLOSED";
    const closedAt = r.status === "CLOSED" ? parseDateTimeLoose(r.endIso) ?? null : null;

    try {
      await prisma.$transaction(async (tx) => {
        if (!exists) {
          await tx.performanceEvaluation.create({
            data: {
              id: r.id,
              employeeId,
              managerId,
              periodStart: startAt,
              periodEnd: endAt,
              periodLabel: r.label,
              status: r.status,
              locked,
              unlockOverride: false,
              closedAt,
              ...(r.createdAt ? { createdAt: r.createdAt, updatedAt: r.createdAt } : {})
            }
          });
          created += 1;
        } else {
          await tx.performanceEvaluation.update({
            where: { id: r.id },
            data: {
              employeeId,
              managerId,
              periodStart: startAt,
              periodEnd: endAt,
              periodLabel: r.label,
              status: r.status,
              locked,
              closedAt,
              ...(r.createdAt ? { createdAt: r.createdAt } : {})
            }
          });
          if (params.overwriteExisting) {
            await tx.performancePersonalItem.deleteMany({ where: { evaluationId: r.id } });
          }
          updated += 1;
        }

        if (questions.length) {
          await tx.performancePersonalItem.createMany({
            data: questions.map((q) => ({
              id: `pers_${r.id}_${q.qNo}`,
              evaluationId: r.id,
              questionId: q.id,
              qNo: q.qNo,
              area: q.area,
              description: q.description,
              scale: q.scale
            })),
            skipDuplicates: true
          });
        }
      });
    } catch {
      errors += 1;
    }
  }

  return { dataset: "PERF_EVALUATIONS", created, updated, skipped, errors, notes: [] };
}

async function importLegacyPerfGoals(params: { dataset: LegacyDataset; tsv: string; overwriteExisting: boolean }): Promise<LegacyImportResult> {
  const parsed = parseTsv(params.tsv);
  if (!parsed.ok) {
    return { dataset: "PERF_GOALS", created: 0, updated: 0, skipped: 0, errors: 1, notes: [parsed.error] };
  }

  const map = headerIndex(parsed.header);
  const goalIdIdx = idxOf(map, "GoalId", "GoalID");
  const evalIdIdx = idxOf(map, "EvalId", "EvalID");
  const goalNameIdx = idxOf(map, "GoalName", "Title");
  const goalDescIdx = idxOf(map, "GoalDescription", "Description");
  const weightIdx = idxOf(map, "WeightPercent", "Weight");

  const missing: string[] = [];
  if (goalIdIdx === null) missing.push("GoalId");
  if (evalIdIdx === null) missing.push("EvalId");
  if (goalNameIdx === null) missing.push("GoalName");
  if (weightIdx === null) missing.push("WeightPercent");
  if (missing.length) {
    return { dataset: "PERF_GOALS", created: 0, updated: 0, skipped: 0, errors: 1, notes: [`Missing columns: ${missing.join(", ")}`] };
  }

  const goalIdCol = goalIdIdx!;
  const evalIdCol = evalIdIdx!;
  const goalNameCol = goalNameIdx!;
  const weightCol = weightIdx!;

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of parsed.rows) {
    const goalId = String(row[goalIdCol] ?? "").trim();
    const evalId = String(row[evalIdCol] ?? "").trim();
    if (!goalId || !evalId) continue;
    const title = String(row[goalNameCol] ?? "").trim();
    if (!title) continue;
    const description = goalDescIdx === null ? "" : String(row[goalDescIdx] ?? "").trim();
    const weightPct = parseFloatOrNull(row[weightCol] ?? "") ?? 0;
    const weight = Math.max(0, Number(weightPct));

    const evalExists = await prisma.performanceEvaluation.findUnique({ where: { id: evalId }, select: { id: true } });
    if (!evalExists) {
      skipped += 1;
      continue;
    }

    const exists = await prisma.performanceGoal.findUnique({ where: { id: goalId }, select: { id: true } });
    if (exists && !params.overwriteExisting) {
      skipped += 1;
      continue;
    }

    try {
      if (!exists) {
        await prisma.performanceGoal.create({
          data: {
            id: goalId,
            evaluationId: evalId,
            title,
            description: description || null,
            weight
          }
        });
        created += 1;
      } else {
        await prisma.performanceGoal.update({
          where: { id: goalId },
          data: {
            evaluationId: evalId,
            title,
            description: description || null,
            weight
          }
        });
        updated += 1;
      }
    } catch {
      errors += 1;
    }
  }

  return {
    dataset: "PERF_GOALS",
    created,
    updated,
    skipped,
    errors,
    notes: ["Ako vidiš skip: importuj PERF_EVALUATIONS pre PERF_GOALS."]
  };
}

async function importLegacyPerfSelf(params: { dataset: LegacyDataset; tsv: string; overwriteExisting: boolean }): Promise<LegacyImportResult> {
  const parsed = parseTsv(params.tsv);
  if (!parsed.ok) {
    return { dataset: "PERF_SELF", created: 0, updated: 0, skipped: 0, errors: 1, notes: [parsed.error] };
  }

  const map = headerIndex(parsed.header);
  const evalIdIdx = idxOf(map, "EvalId", "EvalID");
  const goalIdIdx = idxOf(map, "GoalId", "GoalID");
  const updatedAtIdx = idxOf(map, "UpdatedAt");
  const pctIdx = idxOf(map, "SelfPercent", "EmployeeScore");
  const cmtIdx = idxOf(map, "SelfComment", "EmployeeComment");

  const missing: string[] = [];
  if (evalIdIdx === null) missing.push("EvalId");
  if (goalIdIdx === null) missing.push("GoalId");
  if (pctIdx === null) missing.push("SelfPercent");
  if (cmtIdx === null) missing.push("SelfComment");
  if (missing.length) {
    return { dataset: "PERF_SELF", created: 0, updated: 0, skipped: 0, errors: 1, notes: [`Missing columns: ${missing.join(", ")}`] };
  }

  const evalIdCol = evalIdIdx!;
  const goalIdCol = goalIdIdx!;
  const pctCol = pctIdx!;
  const cmtCol = cmtIdx!;

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of parsed.rows) {
    const evalId = String(row[evalIdCol] ?? "").trim();
    const goalId = String(row[goalIdCol] ?? "").trim();
    if (!evalId || !goalId) continue;
    const pct = parseFloatOrNull(row[pctCol] ?? "");
    const cmt = String(row[cmtCol] ?? "").trim();
    if (pct == null) continue;

    const goal = await prisma.performanceGoal.findUnique({ where: { id: goalId }, select: { id: true } });
    if (!goal) {
      skipped += 1;
      continue;
    }

    const at = parseDateTimeLoose(updatedAtIdx === null ? null : row[updatedAtIdx]);
    try {
      await prisma.performanceGoal.update({
        where: { id: goalId },
        data: {
          employeeScore: pct,
          employeeComment: cmt || null,
          ...(at ? { updatedAt: at } : {})
        }
      });
      updated += 1;
    } catch {
      errors += 1;
    }
  }

  return { dataset: "PERF_SELF", created: 0, updated, skipped, errors, notes: [] };
}

async function importLegacyPerfManager(params: { dataset: LegacyDataset; tsv: string; overwriteExisting: boolean }): Promise<LegacyImportResult> {
  const parsed = parseTsv(params.tsv);
  if (!parsed.ok) {
    return { dataset: "PERF_MANAGER", created: 0, updated: 0, skipped: 0, errors: 1, notes: [parsed.error] };
  }

  const map = headerIndex(parsed.header);
  const evalIdIdx = idxOf(map, "EvalId", "EvalID");
  const goalIdIdx = idxOf(map, "GoalId", "GoalID");
  const reviewedAtIdx = idxOf(map, "ReviewedAt", "ReviewAt");
  const pctIdx = idxOf(map, "ManagerPercent", "ManagerScore");
  const cmtIdx = idxOf(map, "ManagerComment");

  const missing: string[] = [];
  if (evalIdIdx === null) missing.push("EvalId");
  if (goalIdIdx === null) missing.push("GoalId");
  if (pctIdx === null) missing.push("ManagerPercent");
  if (cmtIdx === null) missing.push("ManagerComment");
  if (missing.length) {
    return { dataset: "PERF_MANAGER", created: 0, updated: 0, skipped: 0, errors: 1, notes: [`Missing columns: ${missing.join(", ")}`] };
  }

  const goalIdCol = goalIdIdx!;
  const pctCol = pctIdx!;
  const cmtCol = cmtIdx!;

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of parsed.rows) {
    const goalId = String(row[goalIdCol] ?? "").trim();
    if (!goalId) continue;
    const pct = parseFloatOrNull(row[pctCol] ?? "");
    const cmt = String(row[cmtCol] ?? "").trim();
    if (pct == null) continue;

    const goal = await prisma.performanceGoal.findUnique({ where: { id: goalId }, select: { id: true } });
    if (!goal) {
      skipped += 1;
      continue;
    }

    const at = parseDateTimeLoose(reviewedAtIdx === null ? null : row[reviewedAtIdx]);
    try {
      await prisma.performanceGoal.update({
        where: { id: goalId },
        data: {
          managerScore: pct,
          managerComment: cmt || null,
          ...(at ? { updatedAt: at } : {})
        }
      });
      updated += 1;
    } catch {
      errors += 1;
    }
  }

  return { dataset: "PERF_MANAGER", created: 0, updated, skipped, errors, notes: [] };
}

async function importLegacyPerfPersonal(params: { dataset: LegacyDataset; tsv: string; overwriteExisting: boolean }): Promise<LegacyImportResult> {
  const parsed = parseTsv(params.tsv);
  if (!parsed.ok) {
    return { dataset: "PERF_PERSONAL", created: 0, updated: 0, skipped: 0, errors: 1, notes: [parsed.error] };
  }

  const map = headerIndex(parsed.header);
  const evalIdIdx = idxOf(map, "EvalId", "EvalID");
  const qNoIdx = idxOf(map, "Q_No", "QNo");
  const areaIdx = idxOf(map, "Area");
  const ratingIdx = idxOf(map, "ManagerRating", "Rating");
  const commentIdx = idxOf(map, "ManagerComment", "Comment");

  const missing: string[] = [];
  if (evalIdIdx === null) missing.push("EvalId");
  if (qNoIdx === null) missing.push("Q_No");
  if (areaIdx === null) missing.push("Area");
  if (ratingIdx === null) missing.push("ManagerRating");
  if (commentIdx === null) missing.push("ManagerComment");
  if (missing.length) {
    return { dataset: "PERF_PERSONAL", created: 0, updated: 0, skipped: 0, errors: 1, notes: [`Missing columns: ${missing.join(", ")}`] };
  }

  const evalIdCol = evalIdIdx!;
  const qNoCol = qNoIdx!;
  const areaCol = areaIdx!;
  const ratingCol = ratingIdx!;
  const commentCol = commentIdx!;

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of parsed.rows) {
    const evalId = String(row[evalIdCol] ?? "").trim();
    if (!evalId) continue;
    const qNo = parseIntOrNull(row[qNoCol] ?? "");
    if (!qNo) continue;
    const area = String(row[areaCol] ?? "").trim();
    const rating = parseFloatOrNull(row[ratingCol] ?? "");
    const cmt = String(row[commentCol] ?? "").trim();
    if (rating == null) continue;

    const evalExists = await prisma.performanceEvaluation.findUnique({ where: { id: evalId }, select: { id: true } });
    if (!evalExists) {
      skipped += 1;
      continue;
    }

    const q = await prisma.performanceQuestion.findUnique({ where: { qNo }, select: { id: true, qNo: true, area: true, description: true, scale: true } });
    const question =
      q ??
      (await prisma.performanceQuestion.create({
        data: { qNo, area: area || `Area ${qNo}`, description: `Imported question #${qNo}`, scale: "0–10", isActive: true },
        select: { id: true, qNo: true, area: true, description: true, scale: true }
      }));

    const itemId = `pers_${evalId}_${qNo}`;
    const exists = await prisma.performancePersonalItem.findUnique({ where: { id: itemId }, select: { id: true } });
    if (exists && !params.overwriteExisting) {
      // Even without overwrite, we still want to update the rating/comment (safe).
    }

    try {
      if (!exists) {
        await prisma.performancePersonalItem.create({
          data: {
            id: itemId,
            evaluationId: evalId,
            questionId: question.id,
            qNo,
            area: question.area,
            description: question.description,
            scale: question.scale,
            managerRating: rating,
            managerComment: cmt || null
          }
        });
        created += 1;
      } else {
        await prisma.performancePersonalItem.update({
          where: { id: itemId },
          data: {
            questionId: question.id,
            qNo,
            area: question.area,
            description: question.description,
            scale: question.scale,
            managerRating: rating,
            managerComment: cmt || null
          }
        });
        updated += 1;
      }
    } catch {
      errors += 1;
    }
  }

  return { dataset: "PERF_PERSONAL", created, updated, skipped, errors, notes: ["Preporuka: importuj PERF_QUESTIONS pa PERF_EVALUATIONS pre PERF_PERSONAL."] };
}

async function importLegacyPerfSummary(params: { dataset: LegacyDataset; tsv: string; overwriteExisting: boolean }): Promise<LegacyImportResult> {
  const parsed = parseTsv(params.tsv);
  if (!parsed.ok) {
    return { dataset: "PERF_SUMMARY", created: 0, updated: 0, skipped: 0, errors: 1, notes: [parsed.error] };
  }

  const map = headerIndex(parsed.header);
  const evalIdIdx = idxOf(map, "EvalId", "EvalID");
  const reviewAtIdx = idxOf(map, "ReviewAt", "ReviewedAt");
  const personalScoreIdx = idxOf(map, "PersonalScore");
  const goalsScoreIdx = idxOf(map, "GoalsScore");
  const finalScoreIdx = idxOf(map, "FinalScore");
  const finalCommentIdx = idxOf(map, "ManagerFinalComment");

  const missing: string[] = [];
  if (evalIdIdx === null) missing.push("EvalId");
  if (personalScoreIdx === null) missing.push("PersonalScore");
  if (goalsScoreIdx === null) missing.push("GoalsScore");
  if (finalScoreIdx === null) missing.push("FinalScore");
  if (missing.length) {
    return { dataset: "PERF_SUMMARY", created: 0, updated: 0, skipped: 0, errors: 1, notes: [`Missing columns: ${missing.join(", ")}`] };
  }

  const evalIdCol = evalIdIdx!;
  const personalScoreCol = personalScoreIdx!;
  const goalsScoreCol = goalsScoreIdx!;
  const finalScoreCol = finalScoreIdx!;

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of parsed.rows) {
    const evalId = String(row[evalIdCol] ?? "").trim();
    if (!evalId) continue;
    const e = await prisma.performanceEvaluation.findUnique({ where: { id: evalId }, select: { id: true } });
    if (!e) {
      skipped += 1;
      continue;
    }

    const personalScore = parseFloatOrNull(row[personalScoreCol] ?? "");
    const goalsScore = parseFloatOrNull(row[goalsScoreCol] ?? "");
    const finalScore = parseFloatOrNull(row[finalScoreCol] ?? "");
    const managerFinalComment = finalCommentIdx === null ? "" : String(row[finalCommentIdx] ?? "").trim();
    const closedAt = parseDateTimeLoose(reviewAtIdx === null ? null : row[reviewAtIdx]);

    try {
      await prisma.performanceEvaluation.update({
        where: { id: evalId },
        data: {
          ...(personalScore != null ? { personalScore } : {}),
          ...(goalsScore != null ? { goalsScore } : {}),
          ...(finalScore != null ? { finalScore } : {}),
          managerFinalComment: managerFinalComment || null,
          ...(closedAt ? { closedAt } : {})
        }
      });
      updated += 1;
    } catch {
      errors += 1;
    }
  }

  return { dataset: "PERF_SUMMARY", created: 0, updated, skipped, errors, notes: [] };
}

async function importLegacyPerfLog(params: { dataset: LegacyDataset; tsv: string; overwriteExisting: boolean }): Promise<LegacyImportResult> {
  const parsed = parseTsv(params.tsv);
  if (!parsed.ok) {
    return { dataset: "PERF_LOG", created: 0, updated: 0, skipped: 0, errors: 1, notes: [parsed.error] };
  }

  const map = headerIndex(parsed.header);
  const idIdx = idxOf(map, "LogId", "LogID");
  const tsIdx = idxOf(map, "Timestamp");
  const actorEmailIdx = idxOf(map, "ActorEmail");
  const actionIdx = idxOf(map, "Action");
  const evalIdIdx = idxOf(map, "EvalId", "EvalID");
  const goalIdIdx = idxOf(map, "GoalId", "GoalID");
  const fieldIdx = idxOf(map, "Field");
  const oldIdx = idxOf(map, "OldValue");
  const newIdx = idxOf(map, "NewValue");

  const missing: string[] = [];
  if (idIdx === null) missing.push("LogId");
  if (tsIdx === null) missing.push("Timestamp");
  if (actorEmailIdx === null) missing.push("ActorEmail");
  if (actionIdx === null) missing.push("Action");
  if (evalIdIdx === null) missing.push("EvalId");
  if (missing.length) {
    return { dataset: "PERF_LOG", created: 0, updated: 0, skipped: 0, errors: 1, notes: [`Missing columns: ${missing.join(", ")}`] };
  }

  const idCol = idIdx!;
  const tsCol = tsIdx!;
  const actorEmailCol = actorEmailIdx!;
  const actionCol = actionIdx!;
  const evalIdCol = evalIdIdx!;

  const actorHints: Array<{ email: string }> = [];
  const data: Array<any> = [];

  for (const row of parsed.rows) {
    const id = String(row[idCol] ?? "").trim();
    if (!id) continue;
    const evalId = String(row[evalIdCol] ?? "").trim();
    if (!evalId) continue;
    const actorEmail = normalizeEmail(String(row[actorEmailCol] ?? ""));
    if (!emailSchema.safeParse(actorEmail).success) continue;
    const action = String(row[actionCol] ?? "").trim().toUpperCase();
    if (!action) continue;
    const createdAt = parseDateTimeLoose(row[tsCol]) ?? new Date();
    const goalId = goalIdIdx === null ? "" : String(row[goalIdIdx] ?? "").trim();
    const field = fieldIdx === null ? null : String(row[fieldIdx] ?? "").trim() || null;
    const oldValue = oldIdx === null ? null : String(row[oldIdx] ?? "").trim() || null;
    const newValue = newIdx === null ? null : String(row[newIdx] ?? "").trim() || null;

    actorHints.push({ email: actorEmail });
    data.push({
      id,
      evaluationId: evalId,
      goalId: goalId || null,
      actorEmail,
      action,
      field,
      oldValue,
      newValue,
      createdAt
    });
  }

  if (data.length === 0) {
    return { dataset: "PERF_LOG", created: 0, updated: 0, skipped: 0, errors: 0, notes: ["Nema validnih redova za import."] };
  }

  const userIdByEmail = await ensureUsers({ users: actorHints, teamIdByName: new Map() });

  const evalIds = [...new Set(data.map((r) => r.evaluationId))];
  const evals = await prisma.performanceEvaluation.findMany({ where: { id: { in: evalIds } }, select: { id: true } });
  const evalIdSet = new Set(evals.map((e) => e.id));

  const rows = data
    .filter((r) => evalIdSet.has(r.evaluationId))
    .map((r) => ({
      id: r.id,
      evaluationId: r.evaluationId,
      goalId: r.goalId,
      actorId: userIdByEmail.get(r.actorEmail) ?? null,
      actorEmail: r.actorEmail,
      action: r.action,
      field: r.field,
      oldValue: r.oldValue,
      newValue: r.newValue,
      createdAt: r.createdAt
    }));

  try {
    const res = await prisma.performanceLog.createMany({ data: rows, skipDuplicates: true });
    const skipped = data.length - res.count;
    return { dataset: "PERF_LOG", created: res.count, updated: 0, skipped, errors: 0, notes: ["Importuj PERF_EVALUATIONS pre PERF_LOG."] };
  } catch {
    return { dataset: "PERF_LOG", created: 0, updated: 0, skipped: 0, errors: 1, notes: ["Import perf log nije uspeo."] };
  }
}
