import { PrismaClient, type Prisma } from "@prisma/client";
import { getISOWeek, parseISO } from "date-fns";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "../src/server/config";

type ImportRow = {
  TimeStamp?: unknown;
  Name?: unknown;
  Email?: unknown;
  Team?: unknown;
  Position?: unknown;
  ReportDate?: unknown;
  ActivtyType?: unknown;
  ActivityDescription?: unknown;
  ActivtyDuration?: unknown;
  ReportID?: unknown;
  ActivityID?: unknown;
};

type ImportFile = {
  source?: string;
  rows: ImportRow[];
};

type ParsedActivity = {
  id: string;
  type: string;
  desc: string;
  minutes: number;
  createdAt: Date;
};

type ParsedReport = {
  id: string;
  userId: string;
  dateIso: string;
  employeeEmail: string;
  employeeName: string;
  teamName: string;
  position: string | null;
  week: number;
  month: number;
  year: number;
  totalMinutes: number;
  createdAt: Date;
  updatedAt: Date;
  activities: ParsedActivity[];
};

const prisma = new PrismaClient({
  datasources: { db: { url: config.database.url } },
  transactionOptions: {
    maxWait: 10_000,
    timeout: 60_000
  }
});

function argValue(name: string) {
  const idx = process.argv.indexOf(name);
  if (idx < 0) return "";
  return process.argv[idx + 1] ?? "";
}

function stringValue(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function emailValue(value: unknown) {
  return stringValue(value).toLowerCase();
}

function isoDateValue(value: unknown) {
  const raw = stringValue(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return "";
  return raw;
}

function dateTimeValue(value: unknown, fallbackDateIso: string) {
  const raw = stringValue(value);
  const parsed = raw ? new Date(raw) : null;
  if (parsed && !Number.isNaN(parsed.getTime())) return parsed;
  return new Date(`${fallbackDateIso}T00:00:00.000Z`);
}

function intValue(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.floor(parsed);
}

function requireImportJsonPath() {
  const jsonPath = argValue("--json");
  if (!jsonPath) {
    throw new Error("Missing --json path. Example: npm run reports:reset-import -- --json tmp/spreadsheets/reports_import.json --dry-run");
  }
  return jsonPath;
}

async function readImportFile(jsonPath: string) {
  const raw = await readFile(jsonPath, "utf-8");
  const parsed = JSON.parse(raw) as ImportFile;
  if (!parsed || !Array.isArray(parsed.rows)) throw new Error("Import JSON must contain a rows array.");
  return parsed;
}

async function buildReports(rows: ImportRow[]) {
  const emails = [...new Set(rows.map((row) => emailValue(row.Email)).filter(Boolean))];
  const users = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { id: true, email: true }
  });
  const userIdByEmail = new Map(users.map((user) => [user.email.toLowerCase(), user.id]));
  const missingEmails = emails.filter((email) => !userIdByEmail.has(email));
  if (missingEmails.length > 0) {
    throw new Error(`Missing users for import: ${missingEmails.join(", ")}`);
  }

  const reportByKey = new Map<string, ParsedReport>();
  const reportIds = new Set<string>();
  const activityIds = new Set<string>();
  const errors: string[] = [];

  rows.forEach((row, index) => {
    const rowNo = index + 2;
    const email = emailValue(row.Email);
    const userId = userIdByEmail.get(email);
    const dateIso = isoDateValue(row.ReportDate);
    const reportId = stringValue(row.ReportID);
    const activityId = stringValue(row.ActivityID);
    const type = stringValue(row.ActivtyType);
    const desc = stringValue(row.ActivityDescription);
    const minutes = intValue(row.ActivtyDuration);

    if (!email || !userId) errors.push(`Row ${rowNo}: missing/unknown email`);
    if (!dateIso) errors.push(`Row ${rowNo}: invalid ReportDate`);
    if (!reportId) errors.push(`Row ${rowNo}: missing ReportID`);
    if (!activityId) errors.push(`Row ${rowNo}: missing ActivityID`);
    if (!type) errors.push(`Row ${rowNo}: missing ActivtyType`);
    if (!desc) errors.push(`Row ${rowNo}: missing ActivityDescription`);
    if (!Number.isFinite(minutes) || minutes <= 0) errors.push(`Row ${rowNo}: invalid ActivtyDuration`);
    if (!email || !userId || !dateIso || !reportId || !activityId || !type || !desc || minutes <= 0) return;

    const groupKey = `${email}|${dateIso}`;
    const createdAt = dateTimeValue(row.TimeStamp, dateIso);
    const existing = reportByKey.get(groupKey);
    if (existing && existing.id !== reportId) {
      errors.push(`Row ${rowNo}: multiple ReportID values for ${groupKey}`);
      return;
    }
    if (!existing && reportIds.has(reportId)) {
      errors.push(`Row ${rowNo}: duplicate ReportID used by another report`);
      return;
    }
    if (activityIds.has(activityId)) {
      errors.push(`Row ${rowNo}: duplicate ActivityID`);
      return;
    }

    activityIds.add(activityId);

    if (!existing) {
      reportIds.add(reportId);
      const date = parseISO(dateIso);
      reportByKey.set(groupKey, {
        id: reportId,
        userId,
        dateIso,
        employeeEmail: email,
        employeeName: stringValue(row.Name) || email.split("@")[0] || email,
        teamName: stringValue(row.Team),
        position: stringValue(row.Position) || null,
        week: getISOWeek(date),
        month: date.getMonth() + 1,
        year: date.getFullYear(),
        totalMinutes: 0,
        createdAt,
        updatedAt: createdAt,
        activities: []
      });
    }

    const report = reportByKey.get(groupKey)!;
    report.totalMinutes += minutes;
    if (createdAt < report.createdAt) report.createdAt = createdAt;
    if (createdAt > report.updatedAt) report.updatedAt = createdAt;
    report.activities.push({ id: activityId, type, desc, minutes, createdAt });
  });

  if (errors.length > 0) {
    throw new Error(`Import validation failed:\n${errors.slice(0, 30).join("\n")}${errors.length > 30 ? "\n..." : ""}`);
  }

  return [...reportByKey.values()].sort((a, b) => a.dateIso.localeCompare(b.dateIso) || a.employeeEmail.localeCompare(b.employeeEmail));
}

async function backupAffectedTables() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.join(process.cwd(), "tmp", "import-backups");
  await mkdir(backupDir, { recursive: true });
  const filePath = path.join(backupDir, `before-reports-reset-${timestamp}.json`);

  const [
    dailyReports,
    dailyReportActivities,
    tasks,
    taskComments,
    taskEvents,
    absences,
    absenceEvents,
    performanceEvaluations,
    performanceGoals,
    performancePersonalItems,
    performanceLogs,
    externalCalendarEvents,
    notificationDeliveries
  ] = await Promise.all([
    prisma.dailyReport.findMany(),
    prisma.dailyReportActivity.findMany(),
    prisma.task.findMany(),
    prisma.taskComment.findMany(),
    prisma.taskEvent.findMany(),
    prisma.absence.findMany(),
    prisma.absenceEvent.findMany(),
    prisma.performanceEvaluation.findMany(),
    prisma.performanceGoal.findMany(),
    prisma.performancePersonalItem.findMany(),
    prisma.performanceLog.findMany(),
    prisma.externalCalendarEvent.findMany({
      where: { entityType: { in: ["TASK_DUE", "ABSENCE"] } }
    }),
    prisma.notificationDelivery.findMany({
      where: { entityType: { in: ["TASK", "ABSENCE"] } }
    })
  ]);

  await writeFile(
    filePath,
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        note: "Local safety backup before replacing daily reports and clearing tasks/absence/performance operational data.",
        dailyReports,
        dailyReportActivities,
        tasks,
        taskComments,
        taskEvents,
        absences,
        absenceEvents,
        performanceEvaluations,
        performanceGoals,
        performancePersonalItems,
        performanceLogs,
        externalCalendarEvents,
        notificationDeliveries
      },
      null,
      2
    ),
    "utf-8"
  );

  return filePath;
}

async function currentCounts() {
  const [
    dailyReports,
    dailyReportActivities,
    tasks,
    taskComments,
    taskEvents,
    absences,
    absenceEvents,
    performanceEvaluations,
    performanceGoals,
    performancePersonalItems,
    performanceLogs,
    externalCalendarEvents,
    notificationDeliveries
  ] = await Promise.all([
    prisma.dailyReport.count(),
    prisma.dailyReportActivity.count(),
    prisma.task.count(),
    prisma.taskComment.count(),
    prisma.taskEvent.count(),
    prisma.absence.count(),
    prisma.absenceEvent.count(),
    prisma.performanceEvaluation.count(),
    prisma.performanceGoal.count(),
    prisma.performancePersonalItem.count(),
    prisma.performanceLog.count(),
    prisma.externalCalendarEvent.count({ where: { entityType: { in: ["TASK_DUE", "ABSENCE"] } } }),
    prisma.notificationDelivery.count({ where: { entityType: { in: ["TASK", "ABSENCE"] } } })
  ]);
  return {
    dailyReports,
    dailyReportActivities,
    tasks,
    taskComments,
    taskEvents,
    absences,
    absenceEvents,
    performanceEvaluations,
    performanceGoals,
    performancePersonalItems,
    performanceLogs,
    externalCalendarEvents,
    notificationDeliveries
  };
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

async function applyResetAndImport(reports: ParsedReport[]) {
  const reportRows: Prisma.DailyReportCreateManyInput[] = reports.map((report) => ({
    id: report.id,
    userId: report.userId,
    dateIso: report.dateIso,
    employeeEmail: report.employeeEmail,
    employeeName: report.employeeName,
    teamName: report.teamName,
    position: report.position,
    week: report.week,
    month: report.month,
    year: report.year,
    totalMinutes: report.totalMinutes,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt
  }));
  const activityRows: Prisma.DailyReportActivityCreateManyInput[] = reports.flatMap((report) =>
    report.activities.map((activity) => ({
      id: activity.id,
      reportId: report.id,
      type: activity.type,
      desc: activity.desc,
      minutes: activity.minutes,
      createdAt: activity.createdAt
    }))
  );

  return prisma.$transaction(async (tx) => {
    const deleted = {
      notificationDeliveries: await tx.notificationDelivery.deleteMany({ where: { entityType: { in: ["TASK", "ABSENCE"] } } }),
      externalCalendarEvents: await tx.externalCalendarEvent.deleteMany({ where: { entityType: { in: ["TASK_DUE", "ABSENCE"] } } }),
      taskComments: await tx.taskComment.deleteMany({}),
      taskEvents: await tx.taskEvent.deleteMany({}),
      tasks: await tx.task.deleteMany({}),
      absenceEvents: await tx.absenceEvent.deleteMany({}),
      absences: await tx.absence.deleteMany({}),
      performanceLogs: await tx.performanceLog.deleteMany({}),
      performancePersonalItems: await tx.performancePersonalItem.deleteMany({}),
      performanceGoals: await tx.performanceGoal.deleteMany({}),
      performanceEvaluations: await tx.performanceEvaluation.deleteMany({}),
      dailyReportActivities: await tx.dailyReportActivity.deleteMany({}),
      dailyReports: await tx.dailyReport.deleteMany({})
    };

    let reportsCreated = 0;
    for (const part of chunk(reportRows, 100)) {
      const result = await tx.dailyReport.createMany({ data: part });
      reportsCreated += result.count;
    }

    let activitiesCreated = 0;
    for (const part of chunk(activityRows, 250)) {
      const result = await tx.dailyReportActivity.createMany({ data: part });
      activitiesCreated += result.count;
    }

    return {
      deleted,
      imported: {
        dailyReports: reportsCreated,
        dailyReportActivities: activitiesCreated
      }
    };
  });
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const apply = process.argv.includes("--apply");
  if (dryRun === apply) throw new Error("Use exactly one of --dry-run or --apply.");

  const jsonPath = requireImportJsonPath();
  const importFile = await readImportFile(jsonPath);
  const reports = await buildReports(importFile.rows);
  const activities = reports.reduce((sum, report) => sum + report.activities.length, 0);
  const users = new Set(reports.map((report) => report.employeeEmail));
  const teams = new Set(reports.map((report) => report.teamName).filter(Boolean));
  const dateRange = {
    from: reports[0]?.dateIso ?? null,
    to: reports[reports.length - 1]?.dateIso ?? null
  };
  const before = await currentCounts();

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          mode: "dry-run",
          source: importFile.source ?? jsonPath,
          importPlan: {
            dailyReports: reports.length,
            dailyReportActivities: activities,
            users: users.size,
            teams: [...teams].sort(),
            dateRange
          },
          currentDataThatWillBeReplacedOrCleared: before
        },
        null,
        2
      )
    );
    return;
  }

  const backupPath = await backupAffectedTables();
  const result = await applyResetAndImport(reports);
  const after = await currentCounts();
  console.log(
    JSON.stringify(
      {
        mode: "apply",
        source: importFile.source ?? jsonPath,
        backupPath,
        importPlan: {
          dailyReports: reports.length,
          dailyReportActivities: activities,
          users: users.size,
          teams: [...teams].sort(),
          dateRange
        },
        result,
        after
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
