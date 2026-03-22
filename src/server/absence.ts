import "server-only";

import { prisma } from "./db";
import { APP_TIMEZONE, getAppSettings } from "./app-settings";
import { buildApprovalHierarchyContext, canManagerApproveEmployee, loadOrgUsers } from "./org";
import { formatInTimeZone, fromZonedTime } from "@/server/time";
import { normalizeIsoDate } from "./iso-date";
import { getScopedEmployeeIds, isAdminRole, isManagerRole } from "./rbac";
import { idSchema, isoDateSchema } from "./validation";

function utcDateFromIso(iso: string) {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number.parseInt(m[1], 10);
  const mo = Number.parseInt(m[2], 10);
  const d = Number.parseInt(m[3], 10);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  return new Date(Date.UTC(y, mo - 1, d));
}

function businessDays(fromIso: string, toIso: string) {
  const from = utcDateFromIso(fromIso);
  const to = utcDateFromIso(toIso);
  if (!from || !to) return 0;
  if (from.getTime() > to.getTime()) return 0;
  let count = 0;
  const cur = new Date(from.getTime());
  while (cur.getTime() <= to.getTime()) {
    const day = cur.getUTCDay(); // 0 Sun, 6 Sat
    if (day !== 0 && day !== 6) count += 1;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return count;
}

function businessDaysByYear(fromIso: string, toIso: string, year: number) {
  const from = utcDateFromIso(fromIso);
  const to = utcDateFromIso(toIso);
  if (!from || !to) return 0;
  if (from.getTime() > to.getTime()) return 0;
  let count = 0;
  const cur = new Date(from.getTime());
  while (cur.getTime() <= to.getTime()) {
    if (cur.getUTCFullYear() === year) {
      const day = cur.getUTCDay();
      if (day !== 0 && day !== 6) count += 1;
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return count;
}

function toIsoInTz(d: Date | null | undefined) {
  if (!d) return "";
  return formatInTimeZone(d, APP_TIMEZONE, "yyyy-MM-dd");
}

function normalizeEmail(value: string) {
  return String(value || "").trim().toLowerCase();
}

export type AbsenceType = "ANNUAL_LEAVE" | "HOME_OFFICE" | "SLAVA" | "OTHER" | "SICK";
export type AbsenceStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export type AbsenceCalendarItem = {
  absenceId: string;
  employee: { id: string; name: string; email: string; teamName: string };
  type: AbsenceType;
  status: "PENDING" | "APPROVED";
  fromIso: string;
  toIso: string;
  days: number;
};

export type AbsenceRequestItem = {
  absenceId: string;
  type: AbsenceType;
  status: AbsenceStatus;
  fromIso: string;
  toIso: string;
  days: number;
  approvedAtIso: string;
  approverEmail: string;
  comment: string;
  overlapWarning: boolean;
};

export async function checkAbsenceOverlap(params: {
  actor: { id: string; teamId: string | null };
  fromIso: string;
  toIso: string;
}) {
  const { actor } = params;
  if (!actor.teamId) return { ok: true as const, count: 0, names: [] as string[] };
  const fromIsoParsed = isoDateSchema.safeParse(params.fromIso);
  const toIsoParsed = isoDateSchema.safeParse(params.toIso);
  if (!fromIsoParsed.success || !toIsoParsed.success) return { ok: false as const, error: "INVALID_DATE" };
  const fromIso = fromIsoParsed.data;
  const toIso = toIsoParsed.data;

  const from = fromZonedTime(`${fromIso}T00:00:00`, APP_TIMEZONE);
  const to = fromZonedTime(`${toIso}T23:59:59.999`, APP_TIMEZONE);

  const rows = await prisma.absence.findMany({
    where: {
      status: { in: ["PENDING", "APPROVED"] },
      employee: { teamId: actor.teamId, id: { not: actor.id } },
      dateFrom: { lte: to },
      dateTo: { gte: from }
    },
    select: { employee: { select: { name: true } } }
  });

  const names = new Set<string>();
  for (const r of rows) {
    const name = String(r.employee?.name || "").trim();
    if (name) names.add(name);
  }
  return { ok: true as const, count: names.size, names: [...names].sort((a, b) => a.localeCompare(b)) };
}

export async function submitAbsenceRequest(params: {
  actor: { id: string; email: string; name: string; role: "ADMIN" | "HR" | "MANAGER" | "USER"; teamId: string | null };
  payload: { type: AbsenceType; fromIso: string; toIso: string; comment?: string | null };
}) {
  const type = String(params.payload.type || "").trim().toUpperCase() as AbsenceType;
  let fromIso = normalizeIsoDate(params.payload.fromIso) || "";
  let toIso = normalizeIsoDate(params.payload.toIso) || "";
  const comment = String(params.payload.comment || "").trim();

  const validTypes: AbsenceType[] = ["ANNUAL_LEAVE", "HOME_OFFICE", "SLAVA", "OTHER", "SICK"];
  if (!validTypes.includes(type)) return { ok: false as const, error: "INVALID_TYPE" };
  if (!fromIso || !toIso) return { ok: false as const, error: "INVALID_DATE" };

  if (type === "SLAVA") {
    toIso = fromIso;
  }
  if (fromIso > toIso) {
    const tmp = fromIso;
    fromIso = toIso;
    toIso = tmp;
  }

  const days = type === "SLAVA" ? 1 : businessDays(fromIso, toIso);
  if (days <= 0) return { ok: false as const, error: "NO_BUSINESS_DAYS" };

  const overlap = await checkAbsenceOverlap({
    actor: { id: params.actor.id, teamId: params.actor.teamId },
    fromIso,
    toIso
  });

  const dateFrom = fromZonedTime(`${fromIso}T00:00:00`, APP_TIMEZONE);
  const dateTo = fromZonedTime(`${toIso}T23:59:59.999`, APP_TIMEZONE);

  const absence = await prisma.absence.create({
    data: {
      employeeId: params.actor.id,
      type,
      status: "PENDING",
      dateFrom,
      dateTo,
      days,
      comment: comment || null,
      overlapWarning: overlap.ok ? overlap.count > 0 : false
    },
    select: { id: true }
  });

  await prisma.absenceEvent.create({
    data: {
      absenceId: absence.id,
      action: "SUBMITTED",
      actorId: params.actor.id,
      actorEmail: normalizeEmail(params.actor.email),
      actorName: params.actor.name,
      comment: comment || null
    }
  });

  return { ok: true as const, absenceId: absence.id, days, overlap: overlap.ok ? overlap : { ok: true as const, count: 0, names: [] } };
}

async function canApproveAbsence(actor: { id: string; role: "ADMIN" | "HR" | "MANAGER" | "USER" }, employeeId: string) {
  if (isAdminRole(actor.role)) return true;
  const actorId = actor.id;
  if (!actorId || !employeeId) return false;
  if (actorId === employeeId) return false;

  const settings = await getAppSettings();
  const context = await buildApprovalHierarchyContext({
    allowAncestor: Boolean(Number(settings.AllowAncestorApprovalAbsence || 0)),
    employeeIds: [employeeId]
  });
  return canManagerApproveEmployee(actorId, employeeId, context);
}

export async function getAbsenceCalendar(params: {
  actor: { id: string; role: "ADMIN" | "HR" | "MANAGER" | "USER"; teamId: string | null };
  range: {
    fromIso: string;
    toIso: string;
    teamId?: string | null;
    status?: "ALL" | "PENDING" | "APPROVED";
    type?: "ALL" | AbsenceType;
    includeMine?: boolean;
  };
}) {
  const fromIsoParsed = isoDateSchema.safeParse(params.range.fromIso);
  const toIsoParsed = isoDateSchema.safeParse(params.range.toIso);
  if (!fromIsoParsed.success || !toIsoParsed.success) return { ok: false as const, error: "INVALID_DATE" };
  const fromIso = fromIsoParsed.data;
  const toIsoRaw = toIsoParsed.data;

  let from = fromIso;
  let to = toIsoRaw;
  if (from > to) {
    const tmp = from;
    from = to;
    to = tmp;
  }

  const isAdmin = isAdminRole(params.actor.role);
  const includeMine = Boolean(params.range.includeMine);

  const fromDt = fromZonedTime(`${from}T00:00:00`, APP_TIMEZONE);
  const toDt = fromZonedTime(`${to}T23:59:59.999`, APP_TIMEZONE);

  const statusFilter = params.range.status && params.range.status !== "ALL" ? params.range.status : null;
  const typeFilter = params.range.type && params.range.type !== "ALL" ? params.range.type : null;

  const teamIdFilter = isAdmin ? (params.range.teamId ? String(params.range.teamId) : null) : params.actor.teamId;
  if (!isAdmin && !teamIdFilter) return { ok: true as const, items: [] as AbsenceCalendarItem[] };

  const rows = await prisma.absence.findMany({
    where: {
      status: { in: ["PENDING", "APPROVED"] },
      dateFrom: { lte: toDt },
      dateTo: { gte: fromDt },
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(typeFilter ? { type: typeFilter } : {}),
      employee: teamIdFilter ? { teamId: teamIdFilter } : undefined,
      ...(!includeMine ? { employeeId: { not: params.actor.id } } : {})
    },
    orderBy: [{ dateFrom: "asc" }, { employee: { name: "asc" } }],
    select: {
      id: true,
      type: true,
      status: true,
      dateFrom: true,
      dateTo: true,
      days: true,
      employee: { select: { id: true, name: true, email: true, team: { select: { name: true } } } }
    }
  });

  const items: AbsenceCalendarItem[] = rows.map((r) => ({
    absenceId: r.id,
    employee: {
      id: r.employee.id,
      name: r.employee.name,
      email: r.employee.email,
      teamName: r.employee.team?.name || ""
    },
    type: r.type as AbsenceType,
    status: r.status as any,
    fromIso: toIsoInTz(r.dateFrom),
    toIso: toIsoInTz(r.dateTo),
    days: Number(r.days || 0)
  }));

  return { ok: true as const, fromIso: from, toIso: to, items };
}

export async function getMyAbsenceRequests(actor: { id: string }) {
  const rows = await prisma.absence.findMany({
    where: { employeeId: actor.id },
    orderBy: [{ dateFrom: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      type: true,
      status: true,
      dateFrom: true,
      dateTo: true,
      days: true,
      approvedAt: true,
      approver: { select: { email: true } },
      comment: true,
      overlapWarning: true
    }
  });

  const items: AbsenceRequestItem[] = rows.map((r) => ({
    absenceId: r.id,
    type: r.type as AbsenceType,
    status: r.status as AbsenceStatus,
    fromIso: toIsoInTz(r.dateFrom),
    toIso: toIsoInTz(r.dateTo),
    days: Number(r.days || 0),
    approvedAtIso: r.approvedAt ? formatInTimeZone(r.approvedAt, APP_TIMEZONE, "yyyy-MM-dd HH:mm") : "",
    approverEmail: r.approver?.email || "",
    comment: r.comment || "",
    overlapWarning: Boolean(r.overlapWarning)
  }));

  return { ok: true as const, items };
}

export async function getAbsenceRemaining(actor: { id: string }) {
  const [app, user] = await Promise.all([
    getAppSettings(),
    prisma.user.findUnique({
      where: { id: actor.id },
      select: { id: true, annualLeaveDays: true, homeOfficeDays: true, slavaDays: true, carryOverAnnualLeave: true }
    })
  ]);

  const annualLimit = Math.max(0, Number(user?.annualLeaveDays ?? app.AnnualLeaveDays ?? 0));
  const homeLimit = Math.max(0, Number(user?.homeOfficeDays ?? app.HomeOfficeLimit ?? 0));
  const slavaLimit = Math.max(0, Number(user?.slavaDays ?? 1));

  const year = new Date().getFullYear();
  const cutoff = new Date(Date.UTC(year, 5, 30, 23, 59, 59));
  const carryoverRaw = Math.max(0, Number(user?.carryOverAnnualLeave ?? 0));
  const now = new Date();
  const carryover = now.getTime() <= cutoff.getTime() ? carryoverRaw : 0;

  const approved = await prisma.absence.findMany({
    where: { employeeId: actor.id, status: "APPROVED" },
    select: { type: true, dateFrom: true, dateTo: true }
  });

  let usedAnnual = 0;
  let usedHome = 0;
  let usedSlava = 0;

  for (const a of approved) {
    const fromIso = toIsoInTz(a.dateFrom);
    const toIso = toIsoInTz(a.dateTo);
    const type = a.type as AbsenceType;
    const days = type === "SLAVA" ? (Number.parseInt(fromIso.slice(0, 4), 10) === year ? 1 : 0) : businessDaysByYear(fromIso, toIso, year);
    if (type === "ANNUAL_LEAVE") usedAnnual += days;
    if (type === "HOME_OFFICE") usedHome += days;
    if (type === "SLAVA") usedSlava += days;
  }

  const annualRemaining = Math.max(0, annualLimit + carryover - usedAnnual);
  const homeOfficeRemaining = Math.max(0, homeLimit - usedHome);
  const slavaRemaining = Math.max(0, slavaLimit - usedSlava);

  return {
    ok: true as const,
    year,
    annualRemaining,
    homeOfficeRemaining,
    slavaRemaining,
    carryover,
    carryoverUntil: formatInTimeZone(cutoff, "UTC", "yyyy-MM-dd")
  };
}

export async function getAbsenceApprovals(actor: { id: string; role: "ADMIN" | "HR" | "MANAGER" | "USER" }) {
  if (!isManagerRole(actor.role)) return { ok: true as const, items: [] as Array<any> };

  const orgUsers = await loadOrgUsers();
  const scopedIds = [...getScopedEmployeeIds({ id: actor.id, role: actor.role }, orgUsers)].filter((id) => id !== actor.id);

  const rows = await prisma.absence.findMany({
    where: { status: "PENDING", employeeId: { in: scopedIds } },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      type: true,
      dateFrom: true,
      dateTo: true,
      days: true,
      employee: { select: { id: true, name: true, email: true, team: { select: { name: true } } } }
    }
  });

  const items = rows.map((r) => ({
    absenceId: r.id,
    employee: {
      id: r.employee.id,
      name: r.employee.name,
      email: r.employee.email,
      teamName: r.employee.team?.name || ""
    },
    type: r.type as AbsenceType,
    fromIso: toIsoInTz(r.dateFrom),
    toIso: toIsoInTz(r.dateTo),
    days: Number(r.days || 0),
    canApprove: true
  }));

  return { ok: true as const, items };
}

export async function approveAbsence(params: {
  actor: { id: string; email: string; name: string; role: "ADMIN" | "HR" | "MANAGER" | "USER" };
  absenceId: string;
  comment?: string | null;
  status: "APPROVED" | "REJECTED";
}) {
  if (!isManagerRole(params.actor.role)) return { ok: false as const, error: "NO_ACCESS" };
  const absenceIdParsed = idSchema.safeParse(params.absenceId);
  if (!absenceIdParsed.success) return { ok: false as const, error: "ABSENCE_NOT_FOUND" };
  const absenceId = absenceIdParsed.data;

  const row = await prisma.absence.findUnique({
    where: { id: absenceId },
    select: { id: true, employeeId: true, status: true }
  });
  if (!row) return { ok: false as const, error: "ABSENCE_NOT_FOUND" };

  const can = await canApproveAbsence(params.actor, row.employeeId);
  if (!can) return { ok: false as const, error: "NO_ACCESS" };

  const comment = String(params.comment || "").trim();

  await prisma.absence.update({
    where: { id: absenceId },
    data: {
      status: params.status,
      approverId: params.actor.id,
      approvedAt: new Date(),
      comment: comment || null
    }
  });

  await prisma.absenceEvent.create({
    data: {
      absenceId,
      action: params.status,
      actorId: params.actor.id,
      actorEmail: normalizeEmail(params.actor.email),
      actorName: params.actor.name,
      comment: comment || null
    }
  });

  return { ok: true as const };
}

export async function cancelAbsence(params: {
  actor: { id: string; email: string; name: string; role: "ADMIN" | "HR" | "MANAGER" | "USER" };
  absenceId: string;
  comment?: string | null;
}) {
  const absenceIdParsed = idSchema.safeParse(params.absenceId);
  if (!absenceIdParsed.success) return { ok: false as const, error: "ABSENCE_NOT_FOUND" };
  const absenceId = absenceIdParsed.data;

  const row = await prisma.absence.findUnique({
    where: { id: absenceId },
    select: { id: true, employeeId: true, status: true }
  });
  if (!row) return { ok: false as const, error: "ABSENCE_NOT_FOUND" };
  if (row.status === "CANCELLED") return { ok: true as const };

  const isSelf = row.employeeId === params.actor.id;
  const can = isManagerRole(params.actor.role) ? await canApproveAbsence(params.actor, row.employeeId) : false;
  if (!isSelf && !can) return { ok: false as const, error: "NO_ACCESS" };

  const comment = String(params.comment || "").trim();

  await prisma.absence.update({
    where: { id: absenceId },
    data: {
      status: "CANCELLED",
      approverId: params.actor.id,
      approvedAt: new Date(),
      comment: comment || null
    }
  });

  await prisma.absenceEvent.create({
    data: {
      absenceId,
      action: "CANCELLED",
      actorId: params.actor.id,
      actorEmail: normalizeEmail(params.actor.email),
      actorName: params.actor.name,
      comment: comment || null
    }
  });

  return { ok: true as const };
}

export async function getAbsenceManagerStats(actor: { id: string; role: "ADMIN" | "HR" | "MANAGER" | "USER" }) {
  const orgUsers = await loadOrgUsers();
  const allowedIds = getScopedEmployeeIds({ id: actor.id, role: actor.role }, orgUsers);

  const [app, users] = await Promise.all([
    getAppSettings(),
    prisma.user.findMany({
      where: { id: { in: [...allowedIds] } },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        team: { select: { name: true } },
        position: true,
        annualLeaveDays: true,
        homeOfficeDays: true,
        slavaDays: true,
        carryOverAnnualLeave: true
      }
    })
  ]);

  const year = new Date().getFullYear();
  const cutoff = new Date(Date.UTC(year, 5, 30, 23, 59, 59));
  const now = new Date();

  const approved = await prisma.absence.findMany({
    where: { status: "APPROVED", employeeId: { in: [...allowedIds] } },
    select: { employeeId: true, type: true, dateFrom: true, dateTo: true }
  });

  const usage: Record<string, { annual: number; home: number; slava: number }> = {};
  for (const u of users) usage[u.id] = { annual: 0, home: 0, slava: 0 };

  for (const a of approved) {
    const fromIso = toIsoInTz(a.dateFrom);
    const toIso = toIsoInTz(a.dateTo);
    const type = a.type as AbsenceType;
    const days = type === "SLAVA" ? (Number.parseInt(fromIso.slice(0, 4), 10) === year ? 1 : 0) : businessDaysByYear(fromIso, toIso, year);
    if (!usage[a.employeeId]) usage[a.employeeId] = { annual: 0, home: 0, slava: 0 };
    if (type === "ANNUAL_LEAVE") usage[a.employeeId].annual += days;
    if (type === "HOME_OFFICE") usage[a.employeeId].home += days;
    if (type === "SLAVA") usage[a.employeeId].slava += days;
  }

  const items = users.map((u) => {
    const limits = {
      annual: Math.max(0, Number(u.annualLeaveDays ?? app.AnnualLeaveDays ?? 0)),
      home: Math.max(0, Number(u.homeOfficeDays ?? app.HomeOfficeLimit ?? 0)),
      slava: Math.max(0, Number(u.slavaDays ?? 1))
    };
    const used = usage[u.id] ?? { annual: 0, home: 0, slava: 0 };
    const carryoverRaw = Math.max(0, Number(u.carryOverAnnualLeave ?? 0));
    const carryover = now.getTime() <= cutoff.getTime() ? carryoverRaw : 0;
    return {
      name: u.name,
      email: u.email,
      team: u.team?.name || "",
      position: u.position || "",
      annualLimit: limits.annual,
      annualUsed: used.annual,
      annualRemaining: Math.max(0, limits.annual + carryover - used.annual),
      homeLimit: limits.home,
      homeUsed: used.home,
      homeRemaining: Math.max(0, limits.home - used.home),
      slavaLimit: limits.slava,
      slavaUsed: used.slava,
      slavaRemaining: Math.max(0, limits.slava - used.slava),
      carryover,
      carryoverUntil: formatInTimeZone(cutoff, "UTC", "yyyy-MM-dd")
    };
  });

  return { ok: true as const, year, items };
}
