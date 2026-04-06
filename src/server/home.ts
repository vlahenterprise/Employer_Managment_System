import "server-only";

import { prisma } from "./db";
import { APP_TIMEZONE } from "./app-settings";
import { formatInTimeZone } from "@/server/time";
import { getInboxData } from "./inbox";
import { getScopedEmployeeIds, hasAccessAdmin, hasHrAddon, isManagerRole } from "./rbac";
import { loadOrgUsers } from "./org";
import { getAbsenceRemaining } from "./absence";
import { isHrModuleEnabled } from "./features";

export type HomeActor = {
  id: string;
  email: string;
  role: "ADMIN" | "HR" | "MANAGER" | "USER";
  hrAddon?: boolean;
  adminAddon?: boolean;
  teamId?: string | null;
};

function todayIso() {
  return formatInTimeZone(new Date(), APP_TIMEZONE, "yyyy-MM-dd");
}

function startOfWeekIso() {
  const today = new Date();
  const day = today.getDay() || 7;
  const start = new Date(today);
  start.setDate(today.getDate() - day + 1);
  return formatInTimeZone(start, APP_TIMEZONE, "yyyy-MM-dd");
}

export async function getHomeDashboard(actor: HomeActor) {
  const hrEnabled = isHrModuleEnabled();
  const manager = isManagerRole(actor.role);
  const hrAccess = hrEnabled && hasHrAddon(actor);
  const adminAccess = hasAccessAdmin(actor);
  const orgUsers = await loadOrgUsers();
  const scopedIds = [...getScopedEmployeeIds(actor, orgUsers)];
  const today = todayIso();
  const weekStart = startOfWeekIso();

  const [
    todayTaskCount,
    overdueTaskCount,
    todayReport,
    remaining,
    teamAbsencesToday,
    inbox,
    activeOnboarding,
    teamOpenHiring,
    teamOverdueTasks,
    teamPendingAbsences,
    teamPerformance,
    missingReports,
    hrApprovedRequests,
    hrScreening,
    hrRoundTwo,
    hrFinalRound,
    hrApprovedForHire,
    hrOverdueOnboarding,
    talentPoolCount
  ] = await Promise.all([
    prisma.task.count({
      where: {
        assigneeId: actor.id,
        status: { in: ["OPEN", "IN_PROGRESS", "FOR_APPROVAL", "RETURNED"] },
        dueDate: { gte: new Date(`${today}T00:00:00.000Z`), lte: new Date(`${today}T23:59:59.999Z`) }
      }
    }),
    prisma.task.count({
      where: {
        assigneeId: actor.id,
        status: { in: ["OPEN", "IN_PROGRESS", "FOR_APPROVAL", "RETURNED"] },
        dueDate: { lt: new Date() }
      }
    }),
    prisma.dailyReport.findUnique({
      where: { userId_dateIso: { userId: actor.id, dateIso: today } },
      select: { id: true, totalMinutes: true }
    }),
    getAbsenceRemaining({ id: actor.id }),
    actor.teamId
      ? prisma.absence.findMany({
          where: {
            employee: { teamId: actor.teamId },
            employeeId: { not: actor.id },
            status: "APPROVED",
            dateFrom: { lte: new Date() },
            dateTo: { gte: new Date() }
          },
          orderBy: [{ dateTo: "asc" }],
          select: {
            id: true,
            type: true,
            employee: { select: { id: true, name: true } }
          }
        })
      : Promise.resolve([]),
    getInboxData(actor, 5),
    hrEnabled
      ? prisma.onboarding.findFirst({
          where: {
            OR: [
              { employeeId: actor.id },
              hrAccess ? { hrOwnerId: actor.id } : undefined,
              manager ? { managerId: actor.id } : undefined
            ].filter(Boolean) as any
          },
          orderBy: [{ updatedAt: "desc" }],
          select: {
            id: true,
            status: true,
            employee: { select: { name: true } },
            candidate: { select: { fullName: true } }
          }
        })
      : Promise.resolve(null),
    manager && hrEnabled
      ? prisma.hrProcess.count({
          where: {
            status: { in: ["DRAFT", "OPEN", "IN_PROGRESS", "ON_HOLD"] },
            OR: [
              { managerId: actor.id },
              { finalApproverId: actor.id },
              { teamId: { in: [...new Set(orgUsers.filter((user) => scopedIds.includes(user.id)).map((user) => user.teamId).filter(Boolean) as string[])] } }
            ]
          }
        })
      : Promise.resolve(0),
    manager
      ? prisma.task.count({
          where: {
            assigneeId: { in: scopedIds.filter((id) => id !== actor.id) },
            status: { in: ["OPEN", "IN_PROGRESS", "FOR_APPROVAL", "RETURNED"] },
            dueDate: { lt: new Date() }
          }
        })
      : Promise.resolve(0),
    manager
      ? prisma.absence.count({
          where: {
            employeeId: { in: scopedIds.filter((id) => id !== actor.id) },
            status: "PENDING"
          }
        })
      : Promise.resolve(0),
    manager
      ? prisma.performanceEvaluation.groupBy({
          by: ["status"],
          where: {
            employeeId: { in: scopedIds.filter((id) => id !== actor.id) },
            status: { in: ["OPEN", "SELF_SUBMITTED", "CLOSED"] }
          },
          _count: { _all: true }
        })
      : Promise.resolve([]),
    manager
      ? prisma.user.findMany({
          where: {
            id: { in: scopedIds.filter((id) => id !== actor.id) },
            status: "ACTIVE"
          },
          select: { id: true, name: true, dailyReports: { where: { dateIso: today }, select: { id: true } } }
        })
      : Promise.resolve([]),
    hrAccess
      ? prisma.hrProcess.count({ where: { status: "OPEN" } })
      : Promise.resolve(0),
    hrAccess
      ? prisma.hrProcessCandidate.count({ where: { status: "HR_SCREENING" } })
      : Promise.resolve(0),
    hrAccess
      ? prisma.hrProcessCandidate.count({ where: { status: "INTERVIEW_SCHEDULED" } })
      : Promise.resolve(0),
    hrAccess
      ? prisma.hrProcessCandidate.count({ where: { status: "WAITING_FINAL_APPROVAL" } })
      : Promise.resolve(0),
    hrAccess
      ? prisma.hrProcessCandidate.count({ where: { status: "APPROVED_FOR_EMPLOYMENT" } })
      : Promise.resolve(0),
    hrAccess
      ? prisma.onboarding.count({
          where: {
            status: { in: ["WAITING_HR_ACTIONS", "PLANNED", "ACTIVE"] },
            updatedAt: { lt: new Date(`${weekStart}T00:00:00.000Z`) }
          }
        })
      : Promise.resolve(0),
    hrAccess ? prisma.hrCandidate.count({ where: { applications: { some: { status: "ARCHIVED" } } } }) : Promise.resolve(0)
  ]);

  return {
    ok: true as const,
    mode: manager ? "manager" : hrAccess ? "hr" : adminAccess ? "admin" : "user",
    summary: {
      todayTaskCount,
      overdueTaskCount,
      todayReport,
      remaining,
      teamAbsencesToday,
      activeOnboarding,
      inbox,
      teamOpenHiring,
      teamOverdueTasks,
      teamPendingAbsences,
      teamPerformance,
      missingReports: missingReports.filter((item) => item.dailyReports.length === 0),
      hrApprovedRequests,
      hrScreening,
      hrRoundTwo,
      hrFinalRound,
      hrApprovedForHire,
      hrOverdueOnboarding,
      talentPoolCount
    }
  };
}
