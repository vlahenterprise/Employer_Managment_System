import "server-only";

import bcrypt from "bcryptjs";
import { prisma } from "./db";
import { APP_TIMEZONE, getAppSettings } from "./app-settings";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { getAllowedEmployeesForManager, loadOrgUsers } from "./org";

function utcDateFromIso(iso: string) {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number.parseInt(m[1], 10);
  const mo = Number.parseInt(m[2], 10);
  const d = Number.parseInt(m[3], 10);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  return new Date(Date.UTC(y, mo - 1, d));
}

function isoFromUtcDate(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function addDaysIso(iso: string, days: number) {
  const d = utcDateFromIso(iso);
  if (!d) return "";
  d.setUTCDate(d.getUTCDate() + days);
  return isoFromUtcDate(d);
}

function todayIsoInTz() {
  return formatInTimeZone(new Date(), APP_TIMEZONE, "yyyy-MM-dd");
}

function toIsoInTz(d: Date) {
  return formatInTimeZone(d, APP_TIMEZONE, "yyyy-MM-dd");
}

function normalizeEmail(value: string) {
  return String(value || "").trim().toLowerCase();
}

function periodRange(months: number, now: Date) {
  const nowIso = formatInTimeZone(now, APP_TIMEZONE, "yyyy-MM-dd");
  const y = Number.parseInt(nowIso.slice(0, 4), 10);
  const m = Number.parseInt(nowIso.slice(5, 7), 10) - 1;
  const startMonth = Math.floor(m / months) * months;
  const startIso = `${y}-${String(startMonth + 1).padStart(2, "0")}-01`;
  const endUtc = new Date(Date.UTC(y, startMonth + months, 0));
  const endIso = isoFromUtcDate(endUtc);
  return {
    startIso,
    endIso,
    label: `${startIso} → ${endIso}`,
    startAt: fromZonedTime(`${startIso}T00:00:00`, APP_TIMEZONE),
    endAt: fromZonedTime(`${endIso}T00:00:00`, APP_TIMEZONE)
  };
}

function selfWindow(periodEndIso: string, startDays: number, deadlineDays: number) {
  const startIso = addDaysIso(periodEndIso, -Math.max(0, Math.floor(startDays)));
  const deadlineIso = addDaysIso(periodEndIso, -Math.max(0, Math.floor(deadlineDays)));
  return { startIso, deadlineIso, endIso: periodEndIso };
}

async function canManageEvaluation(actor: { id: string; role: "ADMIN" | "HR" | "MANAGER" | "USER" }, evaluation: { employeeId: string; managerId: string }) {
  if (actor.role === "ADMIN") return true;
  if (actor.role === "HR") return false;
  return actor.id === evaluation.managerId;
}

async function verifyActorPassword(actorId: string, password: string) {
  const row = await prisma.user.findUnique({ where: { id: actorId }, select: { passwordHash: true } });
  if (!row?.passwordHash) return false;
  return bcrypt.compare(password, row.passwordHash);
}

export async function createPerformanceEvaluation(params: {
  actor: { id: string; email: string; name: string; role: "ADMIN" | "HR" | "MANAGER" | "USER" };
  employeeId: string;
  goals?: Array<{ title: string; description?: string | null; weight: number }>;
}) {
  if (params.actor.role !== "ADMIN" && params.actor.role !== "MANAGER") return { ok: false as const, error: "NO_ACCESS" };
  const employeeId = String(params.employeeId || "").trim();
  if (!employeeId) return { ok: false as const, error: "MISSING_EMPLOYEE" };
  if (employeeId === params.actor.id) return { ok: false as const, error: "SELF_NOT_ALLOWED" };

  const employee = await prisma.user.findUnique({
    where: { id: employeeId },
    select: { id: true, email: true, name: true, status: true, managerId: true, team: { select: { name: true } } }
  });
  if (!employee || employee.status !== "ACTIVE") return { ok: false as const, error: "EMPLOYEE_NOT_FOUND" };

  if (params.actor.role === "MANAGER" && employee.managerId !== params.actor.id) {
    return { ok: false as const, error: "NO_ACCESS" };
  }

  const cleanedGoals = Array.isArray(params.goals)
    ? params.goals
        .map((goal) => ({
          title: String(goal.title || "").trim(),
          description: String(goal.description || "").trim() || null,
          weight: Number(goal.weight || 0)
        }))
        .filter((goal) => goal.title)
    : [];
  if (cleanedGoals.length > 5) return { ok: false as const, error: "MAX_5_GOALS" };
  if (cleanedGoals.some((goal) => !Number.isFinite(goal.weight) || goal.weight < 0)) {
    return { ok: false as const, error: "WEIGHT_OVER_100" };
  }
  const initialWeight = cleanedGoals.reduce((sum, goal) => sum + Math.max(0, Number(goal.weight || 0)), 0);
  if (initialWeight > 100) return { ok: false as const, error: "WEIGHT_OVER_100" };

  const existing = await prisma.performanceEvaluation.findMany({
    where: { employeeId },
    select: { id: true, status: true, periodLabel: true }
  });
  if (existing.some((e) => e.status !== "CLOSED" && e.status !== "CANCELLED")) {
    return { ok: false as const, error: "OPEN_EVALUATION_EXISTS" };
  }

  const settings = await getAppSettings();
  const months = Math.max(1, Math.floor(Number(settings.PerformancePeriodMonths || 3)));
  const range = periodRange(months, new Date());
  if (existing.some((e) => String(e.periodLabel || "").trim() === range.label)) {
    return { ok: false as const, error: "PERIOD_EXISTS" };
  }

  const questions = await prisma.performanceQuestion.findMany({
    where: { isActive: true },
    orderBy: { qNo: "asc" },
    select: { id: true, qNo: true, area: true, description: true, scale: true }
  });

  const created = await prisma.$transaction(async (tx) => {
    const evalRow = await tx.performanceEvaluation.create({
      data: {
        employeeId,
        managerId: employee.managerId || params.actor.id,
        periodStart: range.startAt,
        periodEnd: range.endAt,
        periodLabel: range.label,
        status: "OPEN",
        locked: false,
        unlockOverride: false
      },
      select: { id: true }
    });

    if (questions.length) {
      await tx.performancePersonalItem.createMany({
        data: questions.map((q) => ({
          evaluationId: evalRow.id,
          questionId: q.id,
          qNo: q.qNo,
          area: q.area,
          description: q.description,
          scale: q.scale
        }))
      });
    }

    if (cleanedGoals.length) {
      await tx.performanceGoal.createMany({
        data: cleanedGoals.map((goal) => ({
          evaluationId: evalRow.id,
          title: goal.title,
          description: goal.description,
          weight: Math.max(0, Number(goal.weight || 0))
        }))
      });
    }

    await tx.performanceLog.create({
      data: {
        evaluationId: evalRow.id,
        actorId: params.actor.id,
        actorEmail: normalizeEmail(params.actor.email),
        action: "CREATE_EVAL",
        field: "status",
        oldValue: "",
        newValue: "OPEN"
      }
    });

    return evalRow;
  });

  return { ok: true as const, evalId: created.id, periodLabel: range.label, employee: { name: employee.name, email: employee.email, team: employee.team?.name || "" } };
}

export async function getPerformanceMyEvaluations(actor: { id: string }) {
  const rows = await prisma.performanceEvaluation.findMany({
    where: { employeeId: actor.id },
    orderBy: [{ periodEnd: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      periodLabel: true,
      periodStart: true,
      status: true,
      locked: true,
      personalScore: true,
      goalsScore: true,
      finalScore: true,
      periodEnd: true,
      manager: { select: { name: true, email: true } }
    }
  });
  return { ok: true as const, items: rows };
}

export async function getPerformanceTeamEvaluations(actor: { id: string; role: "ADMIN" | "HR" | "MANAGER" | "USER" }) {
  if (actor.role === "USER") return { ok: true as const, items: [] as any[] };

  const settings = await getAppSettings();
  const startDays = Math.max(1, Math.floor(Number(settings.PerformanceSelfReviewStartDays || 20)));
  const deadlineDays = Math.max(1, Math.floor(Number(settings.PerformanceSelfReviewDeadlineDays || 10)));
  const criticalDays = Math.max(1, Math.floor(Number(settings.PerformanceCriticalDays || 3)));
  const todayIso = todayIsoInTz();

  const orgUsers = await loadOrgUsers();
  const allowed =
    actor.role === "ADMIN" || actor.role === "HR"
      ? new Set(orgUsers.map((u) => u.id))
      : getAllowedEmployeesForManager(actor.id, orgUsers);
  const rows = await prisma.performanceEvaluation.findMany({
    where: { employeeId: { in: [...allowed] } },
    orderBy: [{ periodEnd: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      periodLabel: true,
      periodStart: true,
      status: true,
      locked: true,
      finalScore: true,
      periodEnd: true,
      employee: { select: { name: true, email: true, team: { select: { name: true } } } },
      manager: { select: { name: true, email: true } }
    }
  });
  const items = rows.map((e) => {
    const endIso = toIsoInTz(e.periodEnd);
    const window = selfWindow(endIso, startDays, deadlineDays);
    const criticalStartIso = addDaysIso(window.deadlineIso, -criticalDays);
    const critical = e.status === "OPEN" && Boolean(criticalStartIso && todayIso >= criticalStartIso);
    const needsReview = e.status === "SELF_SUBMITTED";
    return { ...e, critical, needsReview };
  });
  return { ok: true as const, items };
}

export async function getPerformanceDirectReports(actor: { id: string }) {
  const rows = await prisma.user.findMany({
    where: { managerId: actor.id, status: "ACTIVE" },
    orderBy: [{ name: "asc" }],
    select: { id: true, name: true, email: true, team: { select: { name: true } }, position: true }
  });
  return { ok: true as const, items: rows };
}

export async function getPerformanceManageableEmployees(actor: { id: string; role: "ADMIN" | "HR" | "MANAGER" | "USER" }) {
  if (actor.role === "USER") return { ok: true as const, items: [] as any[] };

  const orgUsers = await loadOrgUsers();
  const allowed =
    actor.role === "ADMIN" || actor.role === "HR"
      ? new Set(orgUsers.map((u) => u.id))
      : getAllowedEmployeesForManager(actor.id, orgUsers);

  const where: { status: "ACTIVE"; id?: { in: string[] } } = { status: "ACTIVE" };
  where.id = { in: [...allowed] };

  const rows = await prisma.user.findMany({
    where,
    orderBy: [{ name: "asc" }],
    select: { id: true, name: true, email: true, team: { select: { name: true } }, position: true }
  });

  return { ok: true as const, items: rows };
}

export async function getPerformanceEvaluationDetail(actor: { id: string; role: "ADMIN" | "HR" | "MANAGER" | "USER" }, evalId: string) {
  const id = String(evalId || "").trim();
  if (!id) return { ok: false as const, error: "EVAL_NOT_FOUND" };

  const e = await prisma.performanceEvaluation.findUnique({
    where: { id },
    select: {
      id: true,
      employeeId: true,
      managerId: true,
      periodStart: true,
      periodEnd: true,
      periodLabel: true,
      status: true,
      locked: true,
      lockedAt: true,
      lockedById: true,
      unlockOverride: true,
      personalScore: true,
      goalsScore: true,
      finalScore: true,
      managerFinalComment: true,
      employee: { select: { id: true, name: true, email: true, team: { select: { name: true } }, position: true } },
      manager: { select: { id: true, name: true, email: true } },
      lockedBy: { select: { id: true, name: true, email: true } },
      goals: {
        orderBy: [{ createdAt: "asc" }],
        select: {
          id: true,
          title: true,
          description: true,
          weight: true,
          employeeScore: true,
          employeeComment: true,
          managerScore: true,
          managerComment: true
        }
      },
      personalItems: {
        orderBy: [{ qNo: "asc" }],
        select: { id: true, qNo: true, area: true, description: true, scale: true, managerRating: true, managerComment: true }
      }
    }
  });
  if (!e) return { ok: false as const, error: "EVAL_NOT_FOUND" };

  const isEmployee = e.employeeId === actor.id;
  const canManage = await canManageEvaluation(actor, { employeeId: e.employeeId, managerId: e.managerId });
  const canView = isEmployee || canManage || actor.role === "HR";
  if (!canView) return { ok: false as const, error: "NO_ACCESS" };

  const settings = await getAppSettings();
  const startDays = Math.max(0, Math.floor(Number(settings.PerformanceSelfReviewStartDays || 20)));
  const deadlineDays = Math.max(0, Math.floor(Number(settings.PerformanceSelfReviewDeadlineDays || 10)));

  const endIso = toIsoInTz(e.periodEnd);
  const window = selfWindow(endIso, startDays, deadlineDays);
  const todayIso = todayIsoInTz();

  const canSelfEdit = isEmployee && e.status === "OPEN" && !e.locked && (todayIso <= window.deadlineIso || e.unlockOverride);
  const canSelfSubmit = isEmployee && e.status === "OPEN" && !e.locked && todayIso >= window.startIso && todayIso <= window.deadlineIso;

  const canEditGoals = canManage && e.status === "OPEN" && !e.locked;
  const canManagerReview = canManage && e.status !== "CLOSED" && e.status !== "CANCELLED" && !e.locked;

  return {
    ok: true as const,
    evaluation: e,
    window,
    perms: {
      isEmployee,
      canManage,
      canSelfEdit,
      canSelfSubmit,
      canEditGoals,
      canManagerReview
    }
  };
}

export async function getPerformanceHistoryForEmployee(employeeId: string) {
  const id = String(employeeId || "").trim();
  if (!id) return [] as Array<{ id: string; periodLabel: string; finalScore: number | null; periodEnd: Date }>;
  return prisma.performanceEvaluation.findMany({
    where: { employeeId: id, status: "CLOSED" },
    orderBy: [{ periodEnd: "desc" }],
    select: { id: true, periodLabel: true, finalScore: true, periodEnd: true }
  });
}

export async function savePerformanceGoals(params: {
  actor: { id: string; email: string; role: "ADMIN" | "HR" | "MANAGER" | "USER" };
  evalId: string;
  goals: Array<{ goalId?: string | null; title: string; description?: string | null; weight: number }>;
}) {
  const id = String(params.evalId || "").trim();
  if (!id) return { ok: false as const, error: "EVAL_NOT_FOUND" };
  if (!Array.isArray(params.goals) || params.goals.length === 0) return { ok: false as const, error: "NO_GOALS" };
  if (params.goals.length > 5) return { ok: false as const, error: "MAX_5_GOALS" };

  const detail = await getPerformanceEvaluationDetail({ id: params.actor.id, role: params.actor.role }, id);
  if (!detail.ok) return detail;
  if (!detail.perms.canEditGoals) return { ok: false as const, error: "GOALS_LOCKED" };

  const cleaned = params.goals.map((g) => ({
    goalId: String(g.goalId || "").trim() || null,
    title: String(g.title || "").trim(),
    description: String(g.description || "").trim() || null,
    weight: Number(g.weight || 0)
  }));
  if (cleaned.some((g) => !g.title)) return { ok: false as const, error: "MISSING_TITLE" };

  const sum = cleaned.reduce((s, g) => s + Math.max(0, Number(g.weight || 0)), 0);
  if (sum > 100) return { ok: false as const, error: "WEIGHT_OVER_100" };

  const existingById = new Map(detail.evaluation.goals.map((goal) => [goal.id, goal]));
  const submittedIds = cleaned.map((goal) => goal.goalId).filter(Boolean) as string[];
  const toDelete = detail.evaluation.goals.filter((goal) => !submittedIds.includes(goal.id));
  const hasProgress = (goal: (typeof detail.evaluation.goals)[number]) =>
    goal.employeeScore != null ||
    goal.managerScore != null ||
    String(goal.employeeComment || "").trim().length > 0 ||
    String(goal.managerComment || "").trim().length > 0;
  if (toDelete.some(hasProgress)) return { ok: false as const, error: "GOAL_IN_USE" };

  await prisma.$transaction(async (tx) => {
    if (toDelete.length) {
      await tx.performanceGoal.deleteMany({
        where: {
          id: { in: toDelete.map((goal) => goal.id) }
        }
      });
    }

    for (const goal of cleaned) {
      if (goal.goalId && existingById.has(goal.goalId)) {
        await tx.performanceGoal.update({
          where: { id: goal.goalId },
          data: {
            title: goal.title,
            description: goal.description,
            weight: Math.max(0, Number(goal.weight || 0))
          }
        });
      } else {
        await tx.performanceGoal.create({
          data: {
            evaluationId: id,
            title: goal.title,
            description: goal.description,
            weight: Math.max(0, Number(goal.weight || 0))
          }
        });
      }
    }
    await tx.performanceLog.create({
      data: {
        evaluationId: id,
        actorId: params.actor.id,
        actorEmail: normalizeEmail(params.actor.email),
        action: "SAVE_GOALS",
        field: "goals",
        oldValue: "",
        newValue: `count=${cleaned.length}`
      }
    });
    await tx.performanceEvaluation.update({ where: { id }, data: { updatedAt: new Date() } });
  });

  return { ok: true as const };
}

export async function savePerformanceSelfReview(params: {
  actor: { id: string; email: string; role: "ADMIN" | "HR" | "MANAGER" | "USER" };
  evalId: string;
  items: Array<{ goalId: string; percent: number; comment: string }>;
}) {
  const id = String(params.evalId || "").trim();
  if (!id) return { ok: false as const, error: "EVAL_NOT_FOUND" };
  if (!Array.isArray(params.items) || params.items.length === 0) return { ok: false as const, error: "NO_ITEMS" };

  const detail = await getPerformanceEvaluationDetail({ id: params.actor.id, role: params.actor.role }, id);
  if (!detail.ok) return detail;
  if (!detail.perms.isEmployee) return { ok: false as const, error: "NO_ACCESS" };
  if (!detail.perms.canSelfEdit) return { ok: false as const, error: "DEADLINE_PASSED" };

  for (const it of params.items) {
    const pct = Number(it.percent || 0);
    if (!Number.isFinite(pct) || pct < 0 || pct > 200) return { ok: false as const, error: "PERCENT_RANGE" };
    const c = String(it.comment || "").trim();
    if (!c) return { ok: false as const, error: "COMMENT_REQUIRED" };
  }

  await prisma.$transaction(async (tx) => {
    for (const it of params.items) {
      await tx.performanceGoal.update({
        where: { id: it.goalId },
        data: { employeeScore: Number(it.percent), employeeComment: String(it.comment).trim() }
      });
    }
    await tx.performanceLog.create({
      data: {
        evaluationId: id,
        actorId: params.actor.id,
        actorEmail: normalizeEmail(params.actor.email),
        action: "SELF_SAVE",
        field: "selfReview",
        oldValue: "",
        newValue: `count=${params.items.length}`
      }
    });
    await tx.performanceEvaluation.update({ where: { id }, data: { updatedAt: new Date() } });
  });

  return { ok: true as const };
}

export async function submitPerformanceSelfReview(params: {
  actor: { id: string; email: string; role: "ADMIN" | "HR" | "MANAGER" | "USER" };
  evalId: string;
}) {
  const id = String(params.evalId || "").trim();
  if (!id) return { ok: false as const, error: "EVAL_NOT_FOUND" };

  const detail = await getPerformanceEvaluationDetail({ id: params.actor.id, role: params.actor.role }, id);
  if (!detail.ok) return detail;
  if (!detail.perms.isEmployee) return { ok: false as const, error: "NO_ACCESS" };
  if (!detail.perms.canSelfSubmit) return { ok: false as const, error: "SELF_SUBMIT_WINDOW" };

  if (detail.evaluation.goals.length === 0) return { ok: false as const, error: "NO_GOALS" };
  for (const g of detail.evaluation.goals) {
    if (!String(g.employeeComment || "").trim()) return { ok: false as const, error: "MISSING_SELF_REVIEW" };
  }

  await prisma.performanceEvaluation.update({
    where: { id },
    data: { status: "SELF_SUBMITTED", updatedAt: new Date() }
  });
  await prisma.performanceLog.create({
    data: {
      evaluationId: id,
      actorId: params.actor.id,
      actorEmail: normalizeEmail(params.actor.email),
      action: "SELF_SUBMIT",
      field: "status",
      oldValue: detail.evaluation.status,
      newValue: "SELF_SUBMITTED"
    }
  });

  return { ok: true as const };
}

export async function savePerformanceManagerReview(params: {
  actor: { id: string; email: string; role: "ADMIN" | "HR" | "MANAGER" | "USER" };
  evalId: string;
  items: Array<{ goalId: string; percent: number; comment: string }>;
}) {
  const id = String(params.evalId || "").trim();
  if (!id) return { ok: false as const, error: "EVAL_NOT_FOUND" };
  if (!Array.isArray(params.items) || params.items.length === 0) return { ok: false as const, error: "NO_ITEMS" };

  const detail = await getPerformanceEvaluationDetail({ id: params.actor.id, role: params.actor.role }, id);
  if (!detail.ok) return detail;
  if (!detail.perms.canManagerReview) return { ok: false as const, error: "NO_ACCESS" };

  for (const it of params.items) {
    const pct = Number(it.percent || 0);
    if (!Number.isFinite(pct) || pct < 0 || pct > 200) return { ok: false as const, error: "PERCENT_RANGE" };
    const c = String(it.comment || "").trim();
    if (!c) return { ok: false as const, error: "COMMENT_REQUIRED" };
  }

  await prisma.$transaction(async (tx) => {
    for (const it of params.items) {
      await tx.performanceGoal.update({
        where: { id: it.goalId },
        data: { managerScore: Number(it.percent), managerComment: String(it.comment).trim() }
      });
    }
    await tx.performanceLog.create({
      data: {
        evaluationId: id,
        actorId: params.actor.id,
        actorEmail: normalizeEmail(params.actor.email),
        action: "MANAGER_GOAL_REVIEW",
        field: "managerReview",
        oldValue: "",
        newValue: `count=${params.items.length}`
      }
    });
    await tx.performanceEvaluation.update({ where: { id }, data: { updatedAt: new Date() } });
  });

  return { ok: true as const };
}

export async function savePerformancePersonalReview(params: {
  actor: { id: string; email: string; role: "ADMIN" | "HR" | "MANAGER" | "USER" };
  evalId: string;
  items: Array<{ itemId: string; rating: number; comment: string }>;
}) {
  const id = String(params.evalId || "").trim();
  if (!id) return { ok: false as const, error: "EVAL_NOT_FOUND" };
  if (!Array.isArray(params.items) || params.items.length === 0) return { ok: false as const, error: "NO_ITEMS" };

  const detail = await getPerformanceEvaluationDetail({ id: params.actor.id, role: params.actor.role }, id);
  if (!detail.ok) return detail;
  if (!detail.perms.canManagerReview) return { ok: false as const, error: "NO_ACCESS" };

  for (const it of params.items) {
    const rating = Number(it.rating || 0);
    if (!Number.isFinite(rating) || rating < 0 || rating > 10) return { ok: false as const, error: "RATING_RANGE" };
    const c = String(it.comment || "").trim();
    if (!c) return { ok: false as const, error: "COMMENT_REQUIRED" };
  }

  await prisma.$transaction(async (tx) => {
    for (const it of params.items) {
      await tx.performancePersonalItem.update({
        where: { id: it.itemId },
        data: { managerRating: Number(it.rating), managerComment: String(it.comment).trim() }
      });
    }
    await tx.performanceLog.create({
      data: {
        evaluationId: id,
        actorId: params.actor.id,
        actorEmail: normalizeEmail(params.actor.email),
        action: "PERSONAL_REVIEW",
        field: "personalReview",
        oldValue: "",
        newValue: `count=${params.items.length}`
      }
    });
    await tx.performanceEvaluation.update({ where: { id }, data: { updatedAt: new Date() } });
  });

  return { ok: true as const };
}

export async function lockPerformanceEvaluation(params: {
  actor: { id: string; email: string; role: "ADMIN" | "HR" | "MANAGER" | "USER" };
  evalId: string;
  password: string;
}) {
  const id = String(params.evalId || "").trim();
  if (!id) return { ok: false as const, error: "EVAL_NOT_FOUND" };
  const okPw = await verifyActorPassword(params.actor.id, String(params.password || ""));
  if (!okPw) return { ok: false as const, error: "BAD_PASSWORD" };

  const detail = await getPerformanceEvaluationDetail({ id: params.actor.id, role: params.actor.role }, id);
  if (!detail.ok) return detail;
  if (!detail.perms.canManage) return { ok: false as const, error: "NO_ACCESS" };
  if (detail.evaluation.status === "CLOSED") return { ok: false as const, error: "CLOSED" };
  if (detail.evaluation.locked) return { ok: true as const };

  if (detail.evaluation.goals.length === 0) return { ok: false as const, error: "NO_GOALS" };
  for (const g of detail.evaluation.goals) {
    if (!String(g.employeeComment || "").trim()) return { ok: false as const, error: "MISSING_SELF_REVIEW" };
    if (!String(g.managerComment || "").trim() || g.managerScore == null) return { ok: false as const, error: "MISSING_MANAGER_GOALS" };
  }
  if (detail.evaluation.personalItems.length === 0) return { ok: false as const, error: "MISSING_PERSONAL" };
  for (const p of detail.evaluation.personalItems) {
    if (!String(p.managerComment || "").trim()) return { ok: false as const, error: "COMMENT_REQUIRED" };
    if (p.managerRating == null) return { ok: false as const, error: "RATING_RANGE" };
  }

  await prisma.performanceEvaluation.update({
    where: { id },
    data: {
      status: "SELF_SUBMITTED",
      locked: true,
      lockedAt: new Date(),
      lockedById: params.actor.id,
      unlockOverride: false,
      updatedAt: new Date()
    }
  });
  await prisma.performanceLog.create({
    data: {
      evaluationId: id,
      actorId: params.actor.id,
      actorEmail: normalizeEmail(params.actor.email),
      action: "LOCK",
      field: "locked",
      oldValue: "",
      newValue: "TRUE"
    }
  });

  return { ok: true as const };
}

export async function unlockPerformanceEvaluation(params: {
  actor: { id: string; email: string; role: "ADMIN" | "HR" | "MANAGER" | "USER" };
  evalId: string;
  password: string;
}) {
  const id = String(params.evalId || "").trim();
  if (!id) return { ok: false as const, error: "EVAL_NOT_FOUND" };
  const okPw = await verifyActorPassword(params.actor.id, String(params.password || ""));
  if (!okPw) return { ok: false as const, error: "BAD_PASSWORD" };

  const detail = await getPerformanceEvaluationDetail({ id: params.actor.id, role: params.actor.role }, id);
  if (!detail.ok) return detail;
  if (!detail.perms.canManage) return { ok: false as const, error: "NO_ACCESS" };
  if (detail.evaluation.status === "CLOSED") return { ok: false as const, error: "CLOSED" };

  const endIso = toIsoInTz(detail.evaluation.periodEnd);
  if (todayIsoInTz() > endIso) return { ok: false as const, error: "PERIOD_ENDED" };

  await prisma.performanceEvaluation.update({
    where: { id },
    data: {
      status: "OPEN",
      locked: false,
      lockedAt: null,
      lockedById: null,
      unlockOverride: true,
      updatedAt: new Date()
    }
  });
  await prisma.performanceLog.create({
    data: {
      evaluationId: id,
      actorId: params.actor.id,
      actorEmail: normalizeEmail(params.actor.email),
      action: "UNLOCK",
      field: "locked",
      oldValue: "TRUE",
      newValue: ""
    }
  });

  return { ok: true as const };
}

export async function closePerformanceEvaluation(params: {
  actor: { id: string; email: string; role: "ADMIN" | "HR" | "MANAGER" | "USER" };
  evalId: string;
  finalComment?: string | null;
}) {
  const id = String(params.evalId || "").trim();
  if (!id) return { ok: false as const, error: "EVAL_NOT_FOUND" };

  const detail = await getPerformanceEvaluationDetail({ id: params.actor.id, role: params.actor.role }, id);
  if (!detail.ok) return detail;
  if (!detail.perms.canManage) return { ok: false as const, error: "NO_ACCESS" };
  if (detail.evaluation.status === "CLOSED") return { ok: false as const, error: "CLOSED" };
  if (!detail.evaluation.locked) return { ok: false as const, error: "NOT_LOCKED" };

  const settings = await getAppSettings();
  const allowCloseBefore = Boolean(Number(settings.PerformanceAllowCloseBeforePeriodEnd || 0));
  const endIso = toIsoInTz(detail.evaluation.periodEnd);
  if (todayIsoInTz() < endIso && !allowCloseBefore) return { ok: false as const, error: "PERIOD_NOT_ENDED" };

  if (detail.evaluation.goals.length === 0) return { ok: false as const, error: "NO_GOALS" };
  for (const g of detail.evaluation.goals) {
    if (!String(g.employeeComment || "").trim()) return { ok: false as const, error: "MISSING_SELF_REVIEW" };
    if (!String(g.managerComment || "").trim() || g.managerScore == null) return { ok: false as const, error: "MISSING_MANAGER_GOALS" };
  }
  if (detail.evaluation.personalItems.length === 0) return { ok: false as const, error: "MISSING_PERSONAL" };
  for (const p of detail.evaluation.personalItems) {
    if (!String(p.managerComment || "").trim()) return { ok: false as const, error: "COMMENT_REQUIRED" };
    if (p.managerRating == null) return { ok: false as const, error: "RATING_RANGE" };
  }

  const totalW = detail.evaluation.goals.reduce((s, g) => s + Math.max(0, Number(g.weight || 0)), 0);
  let goalsScore = 0;
  for (const g of detail.evaluation.goals) {
    goalsScore += Math.max(0, Number(g.weight || 0)) * Number(g.managerScore || 0);
  }
  goalsScore = goalsScore / Math.max(1, totalW);

  const personalScore =
    detail.evaluation.personalItems.reduce((s, p) => s + Number(p.managerRating || 0), 0) /
    Math.max(1, detail.evaluation.personalItems.length);

  const wP = Number(settings.PerformancePersonalWeight || 30) / 100;
  const wG = Number(settings.PerformanceGoalsWeight || 70) / 100;
  const personalPct = (personalScore / 10) * 100;
  const finalScore = personalPct * wP + goalsScore * wG;

  await prisma.performanceEvaluation.update({
    where: { id },
    data: {
      status: "CLOSED",
      closedAt: new Date(),
      personalScore,
      goalsScore,
      finalScore,
      managerFinalComment: String(params.finalComment || "").trim() || null,
      updatedAt: new Date()
    }
  });
  await prisma.performanceLog.create({
    data: {
      evaluationId: id,
      actorId: params.actor.id,
      actorEmail: normalizeEmail(params.actor.email),
      action: "CLOSE",
      field: "status",
      oldValue: detail.evaluation.status,
      newValue: "CLOSED"
    }
  });

  return { ok: true as const, personalScore, goalsScore, finalScore };
}

export async function cancelPerformanceEvaluation(params: {
  actor: { id: string; email: string; role: "ADMIN" | "HR" | "MANAGER" | "USER" };
  evalId: string;
  reason?: string | null;
}) {
  const id = String(params.evalId || "").trim();
  if (!id) return { ok: false as const, error: "EVAL_NOT_FOUND" };

  const detail = await getPerformanceEvaluationDetail({ id: params.actor.id, role: params.actor.role }, id);
  if (!detail.ok) return detail;
  if (!detail.perms.canManage) return { ok: false as const, error: "NO_ACCESS" };
  if (detail.evaluation.status === "CLOSED") return { ok: false as const, error: "CLOSED" };

  await prisma.performanceEvaluation.update({ where: { id }, data: { status: "CANCELLED", updatedAt: new Date() } });
  await prisma.performanceLog.create({
    data: {
      evaluationId: id,
      actorId: params.actor.id,
      actorEmail: normalizeEmail(params.actor.email),
      action: "CANCEL",
      field: "status",
      oldValue: detail.evaluation.status,
      newValue: "CANCELLED"
    }
  });
  if (params.reason) {
    await prisma.performanceLog.create({
      data: {
        evaluationId: id,
        actorId: params.actor.id,
        actorEmail: normalizeEmail(params.actor.email),
        action: "CANCEL_REASON",
        field: "reason",
        oldValue: "",
        newValue: String(params.reason || "")
      }
    });
  }
  return { ok: true as const };
}

export async function deletePerformanceEvaluation(params: {
  actor: { id: string; email: string; role: "ADMIN" | "HR" | "MANAGER" | "USER" };
  evalId: string;
}) {
  const id = String(params.evalId || "").trim();
  if (!id) return { ok: false as const, error: "EVAL_NOT_FOUND" };

  const detail = await getPerformanceEvaluationDetail({ id: params.actor.id, role: params.actor.role }, id);
  if (!detail.ok) return detail;
  if (!detail.perms.canManage) return { ok: false as const, error: "NO_ACCESS" };
  if (detail.evaluation.status === "CLOSED") return { ok: false as const, error: "CLOSED" };
  if (detail.evaluation.locked) return { ok: false as const, error: "LOCKED" };

  await prisma.$transaction([
    prisma.performanceLog.deleteMany({ where: { evaluationId: id } }),
    prisma.performancePersonalItem.deleteMany({ where: { evaluationId: id } }),
    prisma.performanceGoal.deleteMany({ where: { evaluationId: id } }),
    prisma.performanceEvaluation.delete({ where: { id } })
  ]);

  return { ok: true as const };
}
