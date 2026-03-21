import "server-only";

import { prisma } from "./db";
import { canViewEmployeeProfile, getAccessSummary, hasHrAddon, isManagerRole } from "./rbac";
import { loadOrgUsers } from "./org";
import { formatInTimeZone } from "@/server/time";
import { APP_TIMEZONE } from "./app-settings";

export type ProfileActor = {
  id: string;
  role: "ADMIN" | "HR" | "MANAGER" | "USER";
  hrAddon?: boolean;
  adminAddon?: boolean;
};

function todayIso() {
  return formatInTimeZone(new Date(), APP_TIMEZONE, "yyyy-MM-dd");
}

export async function getEmployeeProfile(actor: ProfileActor, targetUserId?: string | null) {
  const orgUsers = await loadOrgUsers();
  const resolvedUserId = String(targetUserId || actor.id).trim() || actor.id;
  if (!canViewEmployeeProfile(actor, resolvedUserId, orgUsers)) {
    return { ok: false as const, error: "NO_ACCESS" };
  }

  const user = await prisma.user.findUnique({
    where: { id: resolvedUserId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      hrAddon: true,
      adminAddon: true,
      status: true,
      position: true,
      employmentDate: true,
      annualLeaveDays: true,
      homeOfficeDays: true,
      slavaDays: true,
      carryOverAnnualLeave: true,
      jobDescriptionUrl: true,
      workInstructionsUrl: true,
      team: { select: { id: true, name: true } },
      manager: { select: { id: true, name: true, email: true } },
      reports: { select: { id: true } },
      onboardingsAsEmployee: {
        where: { status: { not: "COMPLETED" } },
        orderBy: [{ updatedAt: "desc" }],
        take: 1,
        select: { id: true, status: true, startDate: true, hrOwner: { select: { name: true, email: true } } }
      },
      evaluations: {
        orderBy: [{ periodEnd: "desc" }],
        take: 4,
        select: { id: true, periodLabel: true, status: true, finalScore: true, periodEnd: true }
      }
    }
  });

  if (!user) return { ok: false as const, error: "NOT_FOUND" };

  const [taskCounts, latestReport, absenceSummary, activeAbsence] = await Promise.all([
    prisma.task.groupBy({
      by: ["status"],
      where: {
        assigneeId: user.id,
        status: { in: ["OPEN", "IN_PROGRESS", "FOR_APPROVAL", "RETURNED"] }
      },
      _count: { _all: true }
    }),
    prisma.dailyReport.findFirst({
      where: { userId: user.id },
      orderBy: [{ dateIso: "desc" }],
      select: { id: true, dateIso: true, totalMinutes: true }
    }),
    prisma.absence.groupBy({
      by: ["status"],
      where: { employeeId: user.id },
      _count: { _all: true }
    }),
    prisma.absence.findFirst({
      where: {
        employeeId: user.id,
        status: "APPROVED",
        dateFrom: { lte: new Date() },
        dateTo: { gte: new Date() }
      },
      orderBy: [{ dateTo: "asc" }],
      select: { id: true, type: true, dateFrom: true, dateTo: true }
    })
  ]);

  const openTasks = taskCounts.reduce((sum, item) => sum + item._count._all, 0);
  const overdueTasks = await prisma.task.count({
    where: {
      assigneeId: user.id,
      status: { in: ["OPEN", "IN_PROGRESS", "FOR_APPROVAL", "RETURNED"] },
      dueDate: { lt: new Date() }
    }
  });

  const currentEvaluation = user.evaluations[0] || null;

  return {
    ok: true as const,
    user,
    access: getAccessSummary(user),
    isSelf: actor.id === user.id,
    canSeeManagerScope: hasHrAddon(actor) || isManagerRole(actor.role),
    summary: {
      openTasks,
      overdueTasks,
      latestReport,
      absencePending: absenceSummary.find((item) => item.status === "PENDING")?._count._all || 0,
      absenceApproved: absenceSummary.find((item) => item.status === "APPROVED")?._count._all || 0,
      activeAbsence,
      directReports: user.reports.length,
      currentEvaluation,
      activeOnboarding: user.onboardingsAsEmployee[0] || null,
      todayIso: todayIso()
    }
  };
}
