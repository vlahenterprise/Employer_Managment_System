import "server-only";

import { unstable_cache } from "next/cache";
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

const getTeamAbsencesTodayCached = unstable_cache(
  async (teamId: string, actorId: string) => {
    const now = new Date();
    return prisma.absence.findMany({
      where: {
        employee: { teamId },
        employeeId: { not: actorId },
        status: "APPROVED",
        dateFrom: { lte: now },
        dateTo: { gte: now }
      },
      orderBy: [{ dateTo: "asc" }],
      select: {
        id: true,
        type: true,
        employee: { select: { id: true, name: true } }
      }
    });
  },
  ["home-team-absences-today"],
  { revalidate: 60 }
);

const getHrCountsCached = unstable_cache(
  async () => {
    const [hrApprovedRequests, hrScreening, hrRoundTwo, hrFinalRound, hrApprovedForHire, talentPoolCount] =
      await Promise.all([
        prisma.hrProcess.count({ where: { status: "OPEN" } }),
        prisma.hrProcessCandidate.count({ where: { status: { in: ["HR_SCREENING", "ON_HOLD"] } } }),
        prisma.hrProcessCandidate.count({ where: { status: "INTERVIEW_SCHEDULED" } }),
        prisma.hrProcessCandidate.count({ where: { status: "WAITING_FINAL_APPROVAL" } }),
        prisma.hrProcessCandidate.count({ where: { status: "APPROVED_FOR_EMPLOYMENT" } }),
        prisma.hrCandidate.count({ where: { applications: { some: { status: "ARCHIVED" } } } })
      ]);

    return { hrApprovedRequests, hrScreening, hrRoundTwo, hrFinalRound, hrApprovedForHire, talentPoolCount };
  },
  ["home-hr-counts"],
  { revalidate: 60 }
);

export async function getHomeDashboard(actor: HomeActor) {
  const hrEnabled = isHrModuleEnabled();
  const manager = isManagerRole(actor.role);
  const hrAccess = hrEnabled && hasHrAddon(actor);
  const adminAccess = hasAccessAdmin(actor);
  const orgUsers = await loadOrgUsers();
  const scopedIds = [...getScopedEmployeeIds(actor, orgUsers)];
  const today = todayIso();
  const weekStart = startOfWeekIso();
  const defaultHrCounts = {
    hrApprovedRequests: 0,
    hrScreening: 0,
    hrRoundTwo: 0,
    hrFinalRound: 0,
    hrApprovedForHire: 0,
    talentPoolCount: 0
  };

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
    hrCounts,
    hrOverdueOnboarding
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
      ? getTeamAbsencesTodayCached(actor.teamId, actor.id)
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
    hrAccess ? getHrCountsCached() : Promise.resolve(defaultHrCounts),
    hrAccess
      ? prisma.onboarding.count({
          where: {
            status: { in: ["WAITING_HR_ACTIONS", "PLANNED", "ACTIVE"] },
            updatedAt: { lt: new Date(`${weekStart}T00:00:00.000Z`) }
          }
        })
      : Promise.resolve(0)
  ]);

  const {
    hrApprovedRequests,
    hrScreening,
    hrRoundTwo,
    hrFinalRound,
    hrApprovedForHire,
    talentPoolCount: hrTalentPoolCount
  } = hrCounts;

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
      talentPoolCount: hrTalentPoolCount
    }
  };
}
