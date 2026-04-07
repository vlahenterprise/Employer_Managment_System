import "server-only";

import { prisma } from "./db";
import { APP_TIMEZONE, getAppSettings } from "./app-settings";
import { buildApprovalHierarchyContext, canManagerApproveEmployee, loadOrgUsers } from "./org";
import { formatInTimeZone, fromZonedTime } from "@/server/time";
import { normalizeIsoDate } from "./iso-date";
import { getScopedEmployeeIds, isAdminRole, isManagerRole } from "./rbac";
import { idSchema, isoDateSchema, requiredTextSchema } from "./validation";
import { notifyTaskCreated, notifyTaskDecision, syncTaskDueCalendarEvent } from "./google-workspace";

function normalizeEmail(value: string) {
  return String(value || "").trim().toLowerCase();
}

function todayIso() {
  return formatInTimeZone(new Date(), APP_TIMEZONE, "yyyy-MM-dd");
}

function parseRangeUtc(fromIso: string, toIso: string) {
  const from = fromZonedTime(`${fromIso}T00:00:00`, APP_TIMEZONE);
  const to = fromZonedTime(`${toIso}T23:59:59.999`, APP_TIMEZONE);
  return { from, to };
}

export type TaskFilters = {
  fromIso: string;
  toIso: string;
  teamId: string | null;
  employeeId: string | null;
  _missingDates?: boolean;
};

export function normalizeTaskFilters(filters: {
  fromIso?: string | null;
  toIso?: string | null;
  teamId?: string | null;
  employeeId?: string | null;
}): TaskFilters {
  const fromIsoNorm = normalizeIsoDate(filters.fromIso ?? "");
  const toIsoNorm = normalizeIsoDate(filters.toIso ?? "");

  if (!fromIsoNorm || !toIsoNorm) {
    return { fromIso: "", toIso: "", teamId: null, employeeId: null, _missingDates: true };
  }

  let fromIso = fromIsoNorm;
  let toIso = toIsoNorm;
  if (fromIso > toIso) {
    const tmp = fromIso;
    fromIso = toIso;
    toIso = tmp;
  }

  const teamId = filters.teamId && filters.teamId !== "ALL" ? String(filters.teamId) : null;
  const employeeId = filters.employeeId && filters.employeeId !== "ALL" ? String(filters.employeeId) : null;

  return { fromIso, toIso, teamId, employeeId };
}

async function canApproveTask(actor: { id: string; role: "ADMIN" | "HR" | "MANAGER" | "USER" }, assigneeId: string) {
  if (isAdminRole(actor.role)) return true;
  const actorId = actor.id;
  if (!actorId || !assigneeId) return false;
  if (actorId === assigneeId) return false;

  const settings = await getAppSettings();
  const context = await buildApprovalHierarchyContext({
    allowAncestor: Boolean(Number(settings.AllowAncestorApprovalTasks || 0)),
    employeeIds: [assigneeId]
  });
  return canManagerApproveEmployee(actorId, assigneeId, context);
}

export type TaskDashboardItem = {
  taskId: string;
  title: string;
  description: string;
  priority: "LOW" | "MED" | "HIGH" | "CRIT";
  status: "OPEN" | "IN_PROGRESS" | "FOR_APPROVAL" | "APPROVED" | "RETURNED" | "CANCELLED";
  team: { id: string; name: string } | null;
  assignee: { id: string; name: string; email: string };
  delegator: { id: string; name: string; email: string };
  delegatedIso: string;
  dueIso: string;
  returnedCount: number;
  overdue: boolean;
  criticalOverdue: boolean;
  approvedOnTime: boolean;
  approvedLate: boolean;
  empComment: string;
  adminComment: string;
  canApprove: boolean;
};

export type TaskDashboard = {
  ok: true;
  filters: TaskFilters;
  totals: {
    totalTasks: number;
    overdue: number;
    criticalOverdue: number;
    returnedTotal: number;
    returnedEver: number;
    returnRate: number;
    approvedOnTime: number;
    approvedLate: number;
    open: number;
    inProgress: number;
    forApproval: number;
    approved: number;
    returned: number;
  };
  chartStatus: Array<{ label: string; value: number }>;
  chartApproved: Array<{ label: string; value: number }>;
  chartTri: Array<{ label: string; value: number }>;
  byEmployee: Array<{
    id: string;
    name: string;
    email: string;
    total: number;
    open: number;
    inProgress: number;
    forApproval: number;
    approved: number;
    returned: number;
    overdue: number;
    criticalOverdue: number;
  }>;
  tasks: TaskDashboardItem[];
  approvals: TaskDashboardItem[];
};

export async function getTaskPickers(actor: { id: string; role: "ADMIN" | "HR" | "MANAGER" | "USER" }) {
  const canManage = isManagerRole(actor.role);
  const orgUsers = await loadOrgUsers();
  const allowedIds = canManage ? getScopedEmployeeIds({ id: actor.id, role: actor.role }, orgUsers) : null;

  const [teams, users] = await Promise.all([
    prisma.team.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, teamId: true }
    })
  ]);

  const employeesByTeam: Record<string, Array<{ id: string; name: string; email: string }>> = {};
  const teamIds = new Set<string>();

  for (const u of users) {
    if (allowedIds && !allowedIds.has(u.id)) continue;
    if (!u.teamId) continue;
    teamIds.add(u.teamId);
    if (!employeesByTeam[u.teamId]) employeesByTeam[u.teamId] = [];
    employeesByTeam[u.teamId].push({ id: u.id, name: u.name, email: u.email });
  }

  for (const teamId of Object.keys(employeesByTeam)) {
    employeesByTeam[teamId].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }

  return {
    ok: true as const,
    teams: teams.filter((t) => teamIds.has(t.id)),
    employeesByTeam
  };
}

export async function getTaskDashboard(actor: { id: string; email: string; role: "ADMIN" | "HR" | "MANAGER" | "USER" }, filtersRaw: TaskFilters): Promise<TaskDashboard> {
  const canManage = isManagerRole(actor.role);
  const f = { ...filtersRaw };

  if (!canManage) {
    f.teamId = null;
    f.employeeId = actor.id;
  }

  if (f._missingDates) {
    return {
      ok: true,
      filters: f,
      totals: {
        totalTasks: 0,
        overdue: 0,
        criticalOverdue: 0,
        returnedTotal: 0,
        returnedEver: 0,
        returnRate: 0,
        approvedOnTime: 0,
        approvedLate: 0,
        open: 0,
        inProgress: 0,
        forApproval: 0,
        approved: 0,
        returned: 0
      },
      chartStatus: [],
      chartApproved: [],
      chartTri: [],
      byEmployee: [],
      tasks: [],
      approvals: []
    };
  }

  const orgUsers = await loadOrgUsers();
  const allowedIds = canManage ? getScopedEmployeeIds({ id: actor.id, role: actor.role }, orgUsers) : null;

  const range = parseRangeUtc(f.fromIso, f.toIso);
  const tIso = todayIso();

  const tasks = await prisma.task.findMany({
    where: {
      status: { not: "CANCELLED" },
      delegatedAt: { gte: range.from, lte: range.to },
      ...(allowedIds ? { assigneeId: { in: [...allowedIds] } } : {}),
      ...(f.teamId ? { teamId: f.teamId } : {}),
      ...(f.employeeId ? { assigneeId: f.employeeId } : {})
    },
    orderBy: [{ delegatedAt: "desc" }, { dueDate: "asc" }],
    select: {
      id: true,
      title: true,
      description: true,
      priority: true,
      status: true,
      team: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true, email: true } },
      delegator: { select: { id: true, name: true, email: true } },
      delegatedAt: true,
      dueDate: true,
      forApprovalAt: true,
      approvedAt: true,
      returnedCount: true,
      employeeComment: true,
      adminComment: true,
      updatedAt: true
    }
  });

  // Precompute approval context once for all unique assignees (fixes N+1)
  const uniqueAssigneeIds = [...new Set(tasks.map((t) => t.assignee.id))];
  let approvalContextCache: Awaited<ReturnType<typeof buildApprovalHierarchyContext>> | null = null;
  let approvalSettingAllowAncestor = false;
  if (!isAdminRole(actor.role) && uniqueAssigneeIds.length > 0) {
    const settings = await getAppSettings();
    approvalSettingAllowAncestor = Boolean(Number(settings.AllowAncestorApprovalTasks || 0));
    approvalContextCache = await buildApprovalHierarchyContext({
      allowAncestor: approvalSettingAllowAncestor,
      employeeIds: uniqueAssigneeIds
    });
  }

  const items: TaskDashboardItem[] = [];
  for (const t of tasks) {
    const delegatedIso = formatInTimeZone(t.delegatedAt, APP_TIMEZONE, "yyyy-MM-dd");
    const dueIso = t.dueDate ? formatInTimeZone(t.dueDate, APP_TIMEZONE, "yyyy-MM-dd") : "";
    const overdue = Boolean(dueIso && dueIso < tIso && t.status !== "APPROVED");
    const criticalOverdue = overdue && t.priority === "CRIT";

    let approvedOnTime = false;
    let approvedLate = false;
    if (t.status === "APPROVED" && t.approvedAt && t.dueDate) {
      const dueEnd = fromZonedTime(`${dueIso}T23:59:59`, APP_TIMEZONE);
      approvedOnTime = t.approvedAt.getTime() <= dueEnd.getTime();
      approvedLate = !approvedOnTime;
    }

    const canApprove = isAdminRole(actor.role)
      ? true
      : actor.id !== t.assignee.id && approvalContextCache != null
        ? canManagerApproveEmployee(actor.id, t.assignee.id, approvalContextCache)
        : false;

    items.push({
      taskId: t.id,
      title: t.title,
      description: t.description ?? "",
      priority: t.priority,
      status: t.status,
      team: t.team ? { id: t.team.id, name: t.team.name } : null,
      assignee: { id: t.assignee.id, name: t.assignee.name, email: t.assignee.email },
      delegator: { id: t.delegator.id, name: t.delegator.name, email: t.delegator.email },
      delegatedIso,
      dueIso,
      returnedCount: t.returnedCount || 0,
      overdue,
      criticalOverdue,
      approvedOnTime,
      approvedLate,
      empComment: t.employeeComment ?? "",
      adminComment: t.adminComment ?? "",
      canApprove
    });
  }

  const priorityRank: Record<string, number> = { CRIT: 0, HIGH: 1, MED: 2, LOW: 3 };
  items.sort((a, b) => {
    const pa = priorityRank[a.priority] ?? 9;
    const pb = priorityRank[b.priority] ?? 9;
    if (pa !== pb) return pa - pb;
    const da = String(a.dueIso || "9999-12-31");
    const db = String(b.dueIso || "9999-12-31");
    if (da !== db) return da.localeCompare(db);
    return String(a.delegatedIso || "").localeCompare(String(b.delegatedIso || ""));
  });

  const totals = {
    totalTasks: items.length,
    overdue: 0,
    criticalOverdue: 0,
    returnedTotal: 0,
    returnedEver: 0,
    returnRate: 0,
    approvedOnTime: 0,
    approvedLate: 0,
    open: 0,
    inProgress: 0,
    forApproval: 0,
    approved: 0,
    returned: 0
  };

  for (const t of items) {
    if (t.overdue) totals.overdue += 1;
    if (t.criticalOverdue) totals.criticalOverdue += 1;
    totals.returnedTotal += Number(t.returnedCount || 0);
    if (Number(t.returnedCount || 0) > 0) totals.returnedEver += 1;

    if (t.status === "OPEN") totals.open += 1;
    if (t.status === "IN_PROGRESS") totals.inProgress += 1;
    if (t.status === "FOR_APPROVAL") totals.forApproval += 1;
    if (t.status === "APPROVED") totals.approved += 1;
    if (t.status === "RETURNED") totals.returned += 1;

    if (t.approvedOnTime) totals.approvedOnTime += 1;
    if (t.approvedLate) totals.approvedLate += 1;
  }

  totals.returnRate = totals.totalTasks ? Math.round((totals.returnedEver / totals.totalTasks) * 1000) / 10 : 0;

  const byEmployeeMap = new Map<
    string,
    {
      id: string;
      name: string;
      email: string;
      total: number;
      open: number;
      inProgress: number;
      forApproval: number;
      approved: number;
      returned: number;
      overdue: number;
      criticalOverdue: number;
    }
  >();

  for (const t of items) {
    const key = t.assignee.id;
    const row =
      byEmployeeMap.get(key) || {
        id: t.assignee.id,
        name: t.assignee.name,
        email: t.assignee.email,
        total: 0,
        open: 0,
        inProgress: 0,
        forApproval: 0,
        approved: 0,
        returned: 0,
        overdue: 0,
        criticalOverdue: 0
      };
    row.total += 1;
    if (t.overdue) row.overdue += 1;
    if (t.criticalOverdue) row.criticalOverdue += 1;
    if (t.status === "OPEN") row.open += 1;
    if (t.status === "IN_PROGRESS") row.inProgress += 1;
    if (t.status === "FOR_APPROVAL") row.forApproval += 1;
    if (t.status === "APPROVED") row.approved += 1;
    if (t.status === "RETURNED") row.returned += 1;
    byEmployeeMap.set(key, row);
  }

  const byEmployee = [...byEmployeeMap.values()].sort((a, b) => b.total - a.total);

  const chartStatus = [
    { label: "Open", value: totals.open },
    { label: "In progress", value: totals.inProgress },
    { label: "For approval", value: totals.forApproval },
    { label: "Approved", value: totals.approved },
    { label: "Returned", value: totals.returned }
  ].filter((x) => x.value > 0);

  const chartApproved = [
    { label: "Returned", value: totals.returnedEver },
    { label: "Approved", value: totals.approved }
  ].filter((x) => x.value > 0);

  const chartTri = [
    { label: "Approved on time", value: totals.approvedOnTime },
    { label: "Approved after deadline", value: totals.approvedLate }
  ].filter((x) => x.value > 0);

  const approvals = items.filter((t) => t.status === "FOR_APPROVAL" && t.canApprove);

  return { ok: true, filters: f, totals, chartStatus, chartApproved, chartTri, byEmployee, tasks: items, approvals };
}

export async function createTask(params: {
  actor: { id: string; role: "ADMIN" | "HR" | "MANAGER" | "USER"; email: string; name: string };
  payload: { title: string; description: string; priority: "LOW" | "MED" | "HIGH" | "CRIT"; teamId: string | null; assigneeId: string; dueIso: string };
}) {
  if (!isManagerRole(params.actor.role)) return { ok: false as const, error: "NO_ACCESS" };

  const titleParsed = requiredTextSchema(200, "MISSING_TITLE").safeParse(params.payload.title);
  if (!titleParsed.success) return { ok: false as const, error: titleParsed.error.issues[0]?.message || "MISSING_TITLE" };
  const descriptionParsed = requiredTextSchema(5000, "MISSING_DESCRIPTION").safeParse(params.payload.description);
  if (!descriptionParsed.success) {
    return { ok: false as const, error: descriptionParsed.error.issues[0]?.message || "MISSING_DESCRIPTION" };
  }
  const assigneeIdParsed = idSchema.safeParse(params.payload.assigneeId);
  if (!assigneeIdParsed.success) return { ok: false as const, error: "MISSING_ASSIGNEE" };
  const dueIsoParsed = isoDateSchema.safeParse(params.payload.dueIso);
  if (!dueIsoParsed.success) return { ok: false as const, error: "MISSING_DUE_DATE" };

  const title = titleParsed.data;
  const description = descriptionParsed.data;
  const assigneeId = assigneeIdParsed.data;
  const dueIso = dueIsoParsed.data;

  const orgUsers = await loadOrgUsers();
  const allowedIds = getScopedEmployeeIds({ id: params.actor.id, role: params.actor.role }, orgUsers);
  if (!allowedIds.has(assigneeId)) return { ok: false as const, error: "NO_ACCESS" };

  const delegatedAt = new Date();
  const dueDate = fromZonedTime(`${dueIso}T00:00:00`, APP_TIMEZONE);

  const task = await prisma.$transaction(async (tx) => {
    const created = await tx.task.create({
      data: {
        title,
        description,
        priority: params.payload.priority,
        status: "OPEN",
        delegatorId: params.actor.id,
        assigneeId,
        teamId: params.payload.teamId,
        delegatedAt,
        dueDate,
        returnedCount: 0
      },
      select: { id: true }
    });
    await tx.taskEvent.create({
      data: {
        taskId: created.id,
        action: "CREATED",
        actorId: params.actor.id,
        actorEmail: normalizeEmail(params.actor.email),
        actorName: params.actor.name,
        comment: `Delegated to ${assigneeId}`
      }
    });
    return created;
  });

  await Promise.all([notifyTaskCreated(task.id), syncTaskDueCalendarEvent(task.id)]);

  return { ok: true as const, taskId: task.id };
}

export async function submitTaskForApproval(params: {
  actor: { id: string; role: "ADMIN" | "HR" | "MANAGER" | "USER"; email: string; name: string };
  taskId: string;
  comment: string;
}) {
  const taskId = String(params.taskId || "").trim();
  const comment = String(params.comment || "").trim();
  if (!idSchema.safeParse(taskId).success) return { ok: false as const, error: "TASK_NOT_FOUND" };
  if (!requiredTextSchema(5000, "COMMENT_REQUIRED").safeParse(comment).success) {
    return { ok: false as const, error: "COMMENT_REQUIRED" };
  }

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, status: true, assigneeId: true }
  });
  if (!task) return { ok: false as const, error: "TASK_NOT_FOUND" };

  if (task.assigneeId !== params.actor.id) {
    return { ok: false as const, error: "NO_ACCESS" };
  }

  if (task.status === "FOR_APPROVAL") return { ok: false as const, error: "ALREADY_FOR_APPROVAL" };
  if (task.status === "APPROVED") return { ok: false as const, error: "ALREADY_APPROVED" };

  await prisma.$transaction([
    prisma.task.update({
      where: { id: taskId },
      data: { status: "FOR_APPROVAL", forApprovalAt: new Date(), employeeComment: comment }
    }),
    prisma.taskEvent.create({
      data: {
        taskId,
        action: "SUBMIT_FOR_APPROVAL",
        actorId: params.actor.id,
        actorEmail: normalizeEmail(params.actor.email),
        actorName: params.actor.name,
        comment
      }
    })
  ]);

  await syncTaskDueCalendarEvent(taskId);

  return { ok: true as const };
}

export async function approveTaskAction(params: {
  actor: { id: string; role: "ADMIN" | "HR" | "MANAGER" | "USER"; email: string; name: string };
  taskId: string;
  comment?: string | null;
}) {
  const taskId = String(params.taskId || "").trim();
  if (!idSchema.safeParse(taskId).success) return { ok: false as const, error: "TASK_NOT_FOUND" };

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, assigneeId: true }
  });
  if (!task) return { ok: false as const, error: "TASK_NOT_FOUND" };

  const can = await canApproveTask(params.actor, task.assigneeId);
  if (!can) return { ok: false as const, error: "NO_ACCESS" };

  const comment = String(params.comment || "").trim();

  await prisma.$transaction([
    prisma.task.update({
      where: { id: taskId },
      data: { status: "APPROVED", approvedAt: new Date(), adminComment: comment }
    }),
    prisma.taskEvent.create({
      data: {
        taskId,
        action: "APPROVED",
        actorId: params.actor.id,
        actorEmail: normalizeEmail(params.actor.email),
        actorName: params.actor.name,
        comment
      }
    })
  ]);

  await Promise.all([
    syncTaskDueCalendarEvent(taskId),
    notifyTaskDecision({
      taskId,
      decision: "APPROVED",
      actorName: params.actor.name,
      actorEmail: params.actor.email,
      comment
    })
  ]);

  return { ok: true as const };
}

export async function returnTaskAction(params: {
  actor: { id: string; role: "ADMIN" | "HR" | "MANAGER" | "USER"; email: string; name: string };
  taskId: string;
  comment?: string | null;
}) {
  const taskId = String(params.taskId || "").trim();
  if (!idSchema.safeParse(taskId).success) return { ok: false as const, error: "TASK_NOT_FOUND" };

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, assigneeId: true, returnedCount: true }
  });
  if (!task) return { ok: false as const, error: "TASK_NOT_FOUND" };

  const can = await canApproveTask(params.actor, task.assigneeId);
  if (!can) return { ok: false as const, error: "NO_ACCESS" };

  const comment = String(params.comment || "").trim();
  const next = (task.returnedCount || 0) + 1;

  await prisma.$transaction([
    prisma.task.update({
      where: { id: taskId },
      data: { status: "RETURNED", returnedCount: next, adminComment: comment }
    }),
    prisma.taskEvent.create({
      data: {
        taskId,
        action: "RETURNED",
        actorId: params.actor.id,
        actorEmail: normalizeEmail(params.actor.email),
        actorName: params.actor.name,
        comment
      }
    })
  ]);

  await notifyTaskDecision({
    taskId,
    decision: "RETURNED",
    actorName: params.actor.name,
    actorEmail: params.actor.email,
    comment
  });

  return { ok: true as const, returnedCount: next };
}

export async function cancelTaskAction(params: {
  actor: { id: string; role: "ADMIN" | "HR" | "MANAGER" | "USER"; email: string; name: string };
  taskId: string;
  comment?: string | null;
}) {
  const taskId = String(params.taskId || "").trim();
  if (!idSchema.safeParse(taskId).success) return { ok: false as const, error: "TASK_NOT_FOUND" };

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, assigneeId: true, status: true }
  });
  if (!task) return { ok: false as const, error: "TASK_NOT_FOUND" };
  if (task.status === "CANCELLED") return { ok: true as const };

  const can = await canApproveTask(params.actor, task.assigneeId);
  if (!can) return { ok: false as const, error: "NO_ACCESS" };

  const comment = String(params.comment || "").trim();

  await prisma.$transaction([
    prisma.task.update({
      where: { id: taskId },
      data: { status: "CANCELLED", cancelledAt: new Date(), adminComment: comment }
    }),
    prisma.taskEvent.create({
      data: {
        taskId,
        action: "CANCELLED",
        actorId: params.actor.id,
        actorEmail: normalizeEmail(params.actor.email),
        actorName: params.actor.name,
        comment
      }
    })
  ]);

  await Promise.all([
    syncTaskDueCalendarEvent(taskId),
    notifyTaskDecision({
      taskId,
      decision: "CANCELLED",
      actorName: params.actor.name,
      actorEmail: params.actor.email,
      comment
    })
  ]);

  return { ok: true as const };
}
