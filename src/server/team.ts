import "server-only";

import { prisma } from "./db";
import { formatInTimeZone } from "@/server/time";
import { APP_TIMEZONE } from "./app-settings";
import { getScopedEmployeeIds, isManagerRole } from "./rbac";
import { loadOrgUsers } from "./org";
import { isHrModuleEnabled } from "./features";

export type TeamActor = {
  id: string;
  role: "ADMIN" | "HR" | "MANAGER" | "USER";
};

function todayIso() {
  return formatInTimeZone(new Date(), APP_TIMEZONE, "yyyy-MM-dd");
}

export async function getTeamWorkspace(actor: TeamActor) {
  if (!isManagerRole(actor.role)) return { ok: false as const, error: "NO_ACCESS" };
  const hrEnabled = isHrModuleEnabled();

  const orgUsers = await loadOrgUsers();
  const scopedIds = [...getScopedEmployeeIds(actor, orgUsers)].filter((id) => id !== actor.id);
  const today = todayIso();
  if (scopedIds.length === 0) {
    return {
      ok: true as const,
      rows: [],
      metrics: {
        employees: 0,
        missingReports: 0,
        overdueTasks: 0,
        absentToday: 0,
        activeOnboarding: 0
      }
    };
  }

  const [employees, reportRows, overdueRows, absences, evaluations, onboardings] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: scopedIds }, status: "ACTIVE" },
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
        email: true,
        position: true,
        team: { select: { name: true } },
        manager: { select: { id: true, name: true } }
      }
    }),
    prisma.dailyReport.findMany({
      where: { userId: { in: scopedIds }, dateIso: today },
      select: { userId: true, id: true }
    }),
    prisma.task.groupBy({
      by: ["assigneeId"],
      where: {
        assigneeId: { in: scopedIds },
        status: { in: ["OPEN", "IN_PROGRESS", "FOR_APPROVAL", "RETURNED"] },
        dueDate: { lt: new Date() }
      },
      _count: { _all: true }
    }),
    prisma.absence.findMany({
      where: {
        employeeId: { in: scopedIds },
        status: "APPROVED",
        dateFrom: { lte: new Date() },
        dateTo: { gte: new Date() }
      },
      select: { employeeId: true, type: true, dateTo: true }
    }),
    prisma.performanceEvaluation.findMany({
      where: {
        employeeId: { in: scopedIds },
        status: { in: ["OPEN", "SELF_SUBMITTED", "CLOSED"] }
      },
      orderBy: [{ periodEnd: "desc" }],
      select: {
        employeeId: true,
        status: true,
        periodLabel: true,
        finalScore: true,
        periodEnd: true
      }
    }),
    hrEnabled
      ? prisma.onboarding.findMany({
          where: {
            employeeId: { in: scopedIds },
            status: { not: "COMPLETED" }
          },
          orderBy: [{ updatedAt: "desc" }],
          select: { employeeId: true, id: true, status: true }
        })
      : Promise.resolve([])
  ]);

  const reportsByUser = new Set(reportRows.map((row) => row.userId));
  const overdueByUser = new Map(overdueRows.map((row) => [row.assigneeId, row._count._all]));
  const absenceByUser = new Map(absences.map((row) => [row.employeeId, row]));
  const evaluationByUser = new Map<string, (typeof evaluations)[number]>();
  for (const evaluation of evaluations) {
    if (!evaluationByUser.has(evaluation.employeeId)) {
      evaluationByUser.set(evaluation.employeeId, evaluation);
    }
  }
  const onboardingByUser = new Map(onboardings.map((row) => [row.employeeId || "", row]));

  const rows = employees.map((employee) => ({
    ...employee,
    reportSubmittedToday: reportsByUser.has(employee.id),
    overdueTasks: overdueByUser.get(employee.id) || 0,
    activeAbsence: absenceByUser.get(employee.id) || null,
    currentEvaluation: evaluationByUser.get(employee.id) || null,
    activeOnboarding: onboardingByUser.get(employee.id) || null
  }));

  return {
    ok: true as const,
    rows,
    metrics: {
      employees: rows.length,
      missingReports: rows.filter((row) => !row.reportSubmittedToday).length,
      overdueTasks: rows.reduce((sum, row) => sum + row.overdueTasks, 0),
      absentToday: rows.filter((row) => row.activeAbsence).length,
      activeOnboarding: hrEnabled ? rows.filter((row) => row.activeOnboarding).length : 0
    }
  };
}
