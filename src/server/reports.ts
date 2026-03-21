import { prisma } from "./db";
import { APP_TIMEZONE, getAppSettings } from "./app-settings";
import { getISOWeek, parseISO } from "date-fns";
import { normalizeIsoDate } from "./iso-date";
import { buildPaginationMeta, normalizePagination, type PaginationInput } from "./pagination";
import { getScopedEmployeeIds, hasHrAddon, isManagerRole } from "./rbac";
import { loadOrgUsers } from "./org";

function todayIsoInTz(timeZone: string) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

export type DailyActivityInput = {
  type: string;
  desc: string;
  minutes: number;
};

export async function getActivityTypesForTeam(teamId: string | null | undefined) {
  if (!teamId) return [];
  const rows = await prisma.activityType.findMany({
    where: { teamId, isActive: true },
    orderBy: { name: "asc" },
    select: { name: true }
  });
  return rows.map((r) => r.name);
}

export async function checkDailyReportExists(userId: string, dateIso: string) {
  const iso = normalizeIsoDate(dateIso);
  if (!iso) return { ok: false as const, error: "INVALID_DATE" };
  const report = await prisma.dailyReport.findUnique({
    where: { userId_dateIso: { userId, dateIso: iso } },
    select: { id: true }
  });
  return { ok: true as const, exists: Boolean(report) };
}

export async function deleteDailyReport(params: {
  actor: { id: string; email: string; role: "ADMIN" | "HR" | "MANAGER" | "USER" };
  dateIso: string;
  targetEmail?: string | null;
}) {
  const { actor } = params;
  const iso = normalizeIsoDate(params.dateIso);
  if (!iso) return { ok: false as const, error: "INVALID_DATE" };

  let userId = actor.id;
  if (isManagerRole(actor.role) && params.targetEmail) {
    const target = await prisma.user.findUnique({
      where: { email: params.targetEmail.toLowerCase().trim() },
      select: { id: true }
    });
    if (!target) return { ok: false as const, error: "USER_NOT_FOUND" };
    if (target.id !== actor.id) {
      const orgUsers = await loadOrgUsers();
      const scopedIds = getScopedEmployeeIds(actor, orgUsers);
      if (!scopedIds.has(target.id)) return { ok: false as const, error: "NO_ACCESS" };
    }
    userId = target.id;
  }

  try {
    await prisma.dailyReport.delete({ where: { userId_dateIso: { userId, dateIso: iso } } });
    return { ok: true as const, deleted: 1 };
  } catch {
    return { ok: false as const, error: "NOT_FOUND" };
  }
}

export async function saveDailyReport(params: {
  user: {
    id: string;
    email: string;
    name: string;
    role: "ADMIN" | "HR" | "MANAGER" | "USER";
    team?: { name: string } | null;
    position?: string | null;
  };
  dateIso: string;
  activities: DailyActivityInput[];
}) {
  const { user, activities } = params;
  const iso = normalizeIsoDate(params.dateIso);
  if (!iso) return { ok: false as const, error: "INVALID_DATE" };

  const todayIso = todayIsoInTz(APP_TIMEZONE);
  if (iso > todayIso) {
    return { ok: false as const, error: "FUTURE_DATE", message: "Future dates are not allowed. Choose today or earlier." };
  }

  if (!Array.isArray(activities) || activities.length === 0) {
    return { ok: false as const, error: "NO_ACTIVITIES", message: "Please add at least one activity." };
  }

  const cleaned: DailyActivityInput[] = [];
  for (const activity of activities) {
    const type = String(activity?.type ?? "").trim();
    const desc = String(activity?.desc ?? "").trim();
    const minutes = Number(activity?.minutes ?? 0);
    if (!type) return { ok: false as const, error: "MISSING_ACTIVITY_TYPE", message: "Missing activity type." };
    if (!desc) return { ok: false as const, error: "MISSING_DESCRIPTION", message: "Missing description." };
    if (!Number.isFinite(minutes) || minutes <= 0) {
      return { ok: false as const, error: "INVALID_DURATION", message: "Invalid duration." };
    }
    cleaned.push({ type, desc, minutes: Math.floor(minutes) });
  }

  const settings = await getAppSettings();
  const minH = Number(settings.MinDayActivtyDuration || 1);
  const maxH = Number(settings.MaxDayActivtyDuration || 20);
  const maxAct = Math.max(1, Math.floor(settings.MaxActivitiesPerDay || 20));

  const totalMinutes = cleaned.reduce((sum, a) => sum + a.minutes, 0);
  const minMinutes = Math.floor(minH * 60);
  const maxMinutes = Math.floor(maxH * 60);

  if (totalMinutes < minMinutes) {
    return { ok: false as const, error: "MIN_HOURS", message: `Minimum is ${minH}h per day.` };
  }
  if (totalMinutes > maxMinutes) {
    return { ok: false as const, error: "MAX_HOURS", message: `Maximum is ${maxH}h per day.` };
  }
  if (cleaned.length > maxAct) {
    return { ok: false as const, error: "MAX_ACTIVITIES", message: `Maximum is ${maxAct} activities.` };
  }

  const exists = await prisma.dailyReport.findUnique({
    where: { userId_dateIso: { userId: user.id, dateIso: iso } },
    select: { id: true }
  });
  if (exists) {
    return {
      ok: false as const,
      error: "EXISTS",
      message: "A report already exists for that date. Delete it and re-enter."
    };
  }

  const date = parseISO(iso);
  const week = getISOWeek(date);
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  try {
    const report = await prisma.dailyReport.create({
      data: {
        userId: user.id,
        dateIso: iso,
        employeeEmail: user.email,
        employeeName: user.name,
        teamName: user.team?.name ?? "",
        position: user.position ?? null,
        week,
        month,
        year,
        totalMinutes,
        activities: {
          create: cleaned.map((a) => ({
            type: a.type,
            desc: a.desc,
            minutes: a.minutes
          }))
        }
      },
      select: { id: true }
    });

    return {
      ok: true as const,
      reportId: report.id,
      saved: cleaned.length,
      totalMinutes
    };
  } catch {
    return { ok: false as const, error: "DB_ERROR", message: "Could not save report." };
  }
}

export type ReportsFiltersInput = {
  fromIso?: string | null;
  toIso?: string | null;
  teamName?: string | null;
  position?: string | null;
  employeeEmail?: string | null;
};

export function normalizeReportsFilters(filters: ReportsFiltersInput) {
  const fromRaw = String(filters.fromIso ?? "").trim();
  const toRaw = String(filters.toIso ?? "").trim();
  const fromIso = normalizeIsoDate(fromRaw);
  const toIsoRaw = normalizeIsoDate(toRaw);
  if (!fromIso || !toIsoRaw) {
    return { fromIso: "", toIso: "", teamName: null, position: null, employeeEmail: null, _missingDates: true as const };
  }

  const todayIso = todayIsoInTz(APP_TIMEZONE);
  let toIso = toIsoRaw > todayIso ? todayIso : toIsoRaw;
  let from = fromIso;
  let to = toIso;

  if (from > to) {
    const tmp = from;
    from = to;
    to = tmp;
  }

  const teamName = filters.teamName && filters.teamName !== "ALL" ? String(filters.teamName) : null;
  const position = filters.position && filters.position !== "ALL" ? String(filters.position) : null;
  const employeeEmail =
    filters.employeeEmail && filters.employeeEmail !== "ALL" ? String(filters.employeeEmail).toLowerCase().trim() : null;

  return { fromIso: from, toIso: to, teamName, position, employeeEmail, _missingDates: false as const };
}

export async function getReportsGrid(params: {
  actor: { id: string; email: string; role: "ADMIN" | "HR" | "MANAGER" | "USER"; hrAddon?: boolean };
  filters: ReportsFiltersInput;
  pagination?: PaginationInput;
}) {
  const f = normalizeReportsFilters(params.filters);
  const pagination = normalizePagination({ ...params.pagination, defaultPageSize: 50, maxPageSize: 100 });
  if (f._missingDates) {
    return { ok: true as const, filters: f, rows: [], meta: buildPaginationMeta(0, pagination) };
  }

  const where: any = {
    dateIso: { gte: f.fromIso, lte: f.toIso }
  };

  if (hasHrAddon(params.actor)) {
    if (f.employeeEmail) where.employeeEmail = f.employeeEmail;
    if (f.teamName) where.teamName = f.teamName;
    if (f.position) where.position = f.position;
  } else if (isManagerRole(params.actor.role)) {
    const orgUsers = await loadOrgUsers();
    const scopedIds = [...getScopedEmployeeIds({ id: params.actor.id, role: params.actor.role }, orgUsers)];
    const scopedUsers = await prisma.user.findMany({
      where: { id: { in: scopedIds } },
      select: { email: true }
    });
    const allowedEmails = scopedUsers.map((user) => user.email.toLowerCase());
    if (f.employeeEmail && !allowedEmails.includes(f.employeeEmail)) {
      return { ok: true as const, filters: f, rows: [], meta: buildPaginationMeta(0, pagination) };
    }
    where.employeeEmail = f.employeeEmail || { in: allowedEmails };
    if (f.teamName) where.teamName = f.teamName;
    if (f.position) where.position = f.position;
  } else {
    where.employeeEmail = params.actor.email.toLowerCase().trim();
  }

  const [total, rows] = await Promise.all([
    prisma.dailyReport.count({ where }),
    prisma.dailyReport.findMany({
      where,
      orderBy: [{ dateIso: "desc" }, { employeeName: "asc" }],
      skip: pagination.skip,
      take: pagination.take,
      select: {
        id: true,
        dateIso: true,
        employeeEmail: true,
        employeeName: true,
        teamName: true,
        position: true,
        totalMinutes: true,
        _count: { select: { activities: true } }
      }
    })
  ]);

  return {
    ok: true as const,
    filters: f,
    meta: buildPaginationMeta(total, pagination),
    rows: rows.map((r) => ({
      reportId: r.id,
      dateIso: r.dateIso,
      email: r.employeeEmail,
      name: r.employeeName,
      team: r.teamName,
      position: r.position,
      totalMinutes: r.totalMinutes,
      activities: r._count.activities
    }))
  };
}

export async function getReportsDashboard(params: {
  actor: { id: string; email: string; role: "ADMIN" | "HR" | "MANAGER" | "USER"; hrAddon?: boolean };
  filters: ReportsFiltersInput;
}) {
  const f = normalizeReportsFilters(params.filters);
  if (f._missingDates) {
    return {
      ok: true as const,
      filters: f,
      totals: { totalMinutes: 0, totalHours: 0, daysCount: 0, activitiesCount: 0, distinctTypes: 0 },
      topMost: [],
      topLeast: [],
      chart: []
    };
  }

  const reportWhere: any = {
    dateIso: { gte: f.fromIso, lte: f.toIso }
  };

  if (hasHrAddon(params.actor)) {
    if (f.employeeEmail) reportWhere.employeeEmail = f.employeeEmail;
    if (f.teamName) reportWhere.teamName = f.teamName;
    if (f.position) reportWhere.position = f.position;
  } else if (isManagerRole(params.actor.role)) {
    const orgUsers = await loadOrgUsers();
    const scopedIds = [...getScopedEmployeeIds({ id: params.actor.id, role: params.actor.role }, orgUsers)];
    const scopedUsers = await prisma.user.findMany({
      where: { id: { in: scopedIds } },
      select: { email: true }
    });
    const allowedEmails = scopedUsers.map((user) => user.email.toLowerCase());
    if (f.employeeEmail && !allowedEmails.includes(f.employeeEmail)) {
      return {
        ok: true as const,
        filters: f,
        totals: { totalMinutes: 0, totalHours: 0, daysCount: 0, activitiesCount: 0, distinctTypes: 0 },
        topMost: [],
        topLeast: [],
        chart: []
      };
    }
    reportWhere.employeeEmail = f.employeeEmail || { in: allowedEmails };
    if (f.teamName) reportWhere.teamName = f.teamName;
    if (f.position) reportWhere.position = f.position;
  } else {
    reportWhere.employeeEmail = params.actor.email.toLowerCase().trim();
  }

  const [distinctDays, activityAgg, byType] = await Promise.all([
    prisma.dailyReport.findMany({
      where: reportWhere,
      distinct: ["dateIso"],
      select: { dateIso: true }
    }),
    prisma.dailyReportActivity.aggregate({
      where: { report: reportWhere },
      _sum: { minutes: true },
      _count: { _all: true }
    }),
    prisma.dailyReportActivity.groupBy({
      by: ["type"],
      where: { report: reportWhere },
      _sum: { minutes: true }
    })
  ]);

  const totalMinutes = activityAgg._sum.minutes ?? 0;
  const activitiesCount = activityAgg._count._all ?? 0;
  const daysCount = distinctDays.length;

  const typesArr = byType
    .map((x) => ({ type: x.type, minutes: x._sum.minutes ?? 0 }))
    .filter((x) => x.minutes > 0);

  const topMost = [...typesArr].sort((a, b) => b.minutes - a.minutes).slice(0, 5);
  const topLeast = [...typesArr].sort((a, b) => a.minutes - b.minutes).slice(0, 5);
  const chart = [...typesArr].sort((a, b) => b.minutes - a.minutes);

  return {
    ok: true as const,
    filters: f,
    totals: {
      totalMinutes,
      totalHours: Math.round((totalMinutes / 60) * 100) / 100,
      daysCount,
      activitiesCount,
      distinctTypes: typesArr.length
    },
    topMost,
    topLeast,
    chart
  };
}
