import "server-only";

import { prisma } from "./db";
import { APP_TIMEZONE } from "./app-settings";
import { formatInTimeZone } from "@/server/time";
import { addDays } from "date-fns";
import { getScopedEmployeeIds, hasHrAddon, isManagerRole } from "./rbac";
import { loadOrgUsers } from "./org";

export type InboxActor = {
  id: string;
  email: string;
  role: "ADMIN" | "HR" | "MANAGER" | "USER";
  hrAddon?: boolean;
  adminAddon?: boolean;
};

export type InboxItem = {
  id: string;
  title: string;
  description: string;
  href: string;
  tone: "review" | "warning" | "info" | "success";
  meta?: string;
};

export type InboxPayload = {
  needsMyAction: InboxItem[];
  assignedToMe: InboxItem[];
  recentUpdates: InboxItem[];
  totals: {
    needsMyAction: number;
    assignedToMe: number;
    recentUpdates: number;
  };
};

function todayIso() {
  return formatInTimeZone(new Date(), APP_TIMEZONE, "yyyy-MM-dd");
}

function pushUnique(target: InboxItem[], item: InboxItem) {
  if (target.some((existing) => existing.id === item.id)) return;
  target.push(item);
}

export async function getInboxData(actor: InboxActor, limit = 8): Promise<InboxPayload> {
  const needsMyAction: InboxItem[] = [];
  const assignedToMe: InboxItem[] = [];
  const recentUpdates: InboxItem[] = [];
  const manager = isManagerRole(actor.role);
  const hrAccess = hasHrAddon(actor);
  const orgUsers = await loadOrgUsers();
  const scopedIds = [...getScopedEmployeeIds(actor, orgUsers)];
  const today = todayIso();
  const [
    myTasks,
    approvalTasks,
    myAbsences,
    approvalAbsences,
    myEvaluations,
    teamEvaluations,
    notifications,
    onboardingRows,
    teamReportsToday
  ] = await Promise.all([
    prisma.task.findMany({
      where: {
        assigneeId: actor.id,
        status: { in: ["OPEN", "IN_PROGRESS", "RETURNED", "FOR_APPROVAL"] }
      },
      orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
      take: 20,
      select: { id: true, title: true, status: true, dueDate: true, updatedAt: true }
    }),
    manager
      ? prisma.task.findMany({
          where: {
            assigneeId: { in: scopedIds.filter((id) => id !== actor.id) },
            status: "FOR_APPROVAL"
          },
          orderBy: [{ updatedAt: "desc" }],
          take: 20,
          select: {
            id: true,
            title: true,
            assignee: { select: { name: true } },
            updatedAt: true
          }
        })
      : Promise.resolve([]),
    prisma.absence.findMany({
      where: {
        employeeId: actor.id,
        updatedAt: { gte: addDays(new Date(), -30) }
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 10,
      select: { id: true, status: true, type: true, dateFrom: true, dateTo: true, updatedAt: true }
    }),
    manager
      ? prisma.absence.findMany({
          where: {
            employeeId: { in: scopedIds.filter((id) => id !== actor.id) },
            status: "PENDING"
          },
          orderBy: [{ createdAt: "desc" }],
          take: 20,
          select: {
            id: true,
            type: true,
            dateFrom: true,
            dateTo: true,
            employee: { select: { name: true } }
          }
        })
      : Promise.resolve([]),
    prisma.performanceEvaluation.findMany({
      where: {
        employeeId: actor.id,
        status: { in: ["OPEN", "SELF_SUBMITTED"] }
      },
      orderBy: [{ periodEnd: "desc" }],
      take: 6,
      select: { id: true, periodLabel: true, status: true, periodEnd: true }
    }),
    manager
      ? prisma.performanceEvaluation.findMany({
          where: {
            employeeId: { in: scopedIds.filter((id) => id !== actor.id) },
            status: { in: ["OPEN", "SELF_SUBMITTED"] }
          },
          orderBy: [{ periodEnd: "desc" }],
          take: 20,
          select: {
            id: true,
            status: true,
            periodLabel: true,
            employee: { select: { name: true } }
          }
        })
      : Promise.resolve([]),
    prisma.hrNotification.findMany({
      where: { userId: actor.id },
      orderBy: [{ createdAt: "desc" }],
      take: 12,
      select: { id: true, title: true, body: true, href: true, isRead: true, createdAt: true }
    }),
    prisma.onboarding.findMany({
      where: hrAccess
        ? {
            OR: [
              { hrOwnerId: actor.id },
              { status: { in: ["WAITING_HR_ACTIONS", "PLANNED", "ACTIVE"] } }
            ]
          }
        : manager
          ? {
              OR: [
                { managerId: actor.id },
                { employeeId: { in: scopedIds } }
              ],
              status: { not: "COMPLETED" }
            }
          : { employeeId: actor.id, status: { not: "COMPLETED" } },
      orderBy: [{ updatedAt: "desc" }],
      take: 12,
      select: {
        id: true,
        status: true,
        updatedAt: true,
        employee: { select: { id: true, name: true } },
        candidate: { select: { fullName: true } }
      }
    }),
    manager
      ? prisma.user.findMany({
          where: {
            id: { in: scopedIds.filter((id) => id !== actor.id) },
            status: "ACTIVE"
          },
          orderBy: [{ name: "asc" }],
          select: {
            id: true,
            name: true,
            dailyReports: {
              where: { dateIso: today },
              select: { id: true }
            }
          }
        })
      : Promise.resolve([])
  ]);

  for (const task of myTasks) {
    const dueIso = task.dueDate ? formatInTimeZone(task.dueDate, APP_TIMEZONE, "yyyy-MM-dd") : null;
    const overdue = Boolean(dueIso && dueIso < today);
    const dueToday = dueIso === today;
    if (task.status === "RETURNED") {
      pushUnique(needsMyAction, {
        id: `task-returned-${task.id}`,
        title: task.title,
        description: "Task was returned and needs your update.",
        href: "/tasks",
        tone: "warning",
        meta: dueIso || undefined
      });
    } else {
      pushUnique(assignedToMe, {
        id: `task-${task.id}`,
        title: task.title,
        description: overdue ? "Overdue task." : dueToday ? "Due today." : `Status: ${task.status}`,
        href: "/tasks",
        tone: overdue ? "warning" : dueToday ? "review" : "info",
        meta: dueIso || undefined
      });
    }
  }

  for (const task of approvalTasks) {
    pushUnique(needsMyAction, {
      id: `task-approval-${task.id}`,
      title: task.title,
      description: `${task.assignee.name} submitted this task for review.`,
      href: "/tasks",
      tone: "review"
    });
  }

  for (const absence of approvalAbsences) {
    pushUnique(needsMyAction, {
      id: `absence-approval-${absence.id}`,
      title: `${absence.employee.name} requested ${absence.type}`,
      description: `${formatInTimeZone(absence.dateFrom, APP_TIMEZONE, "yyyy-MM-dd")} → ${formatInTimeZone(absence.dateTo, APP_TIMEZONE, "yyyy-MM-dd")}`,
      href: "/absence",
      tone: "review"
    });
  }

  for (const evaluation of myEvaluations) {
    pushUnique(needsMyAction, {
      id: `my-eval-${evaluation.id}`,
      title: `Performance ${evaluation.periodLabel}`,
      description: evaluation.status === "OPEN" ? "Complete your self-assessment." : "Waiting for manager review.",
      href: `/performance/${evaluation.id}`,
      tone: evaluation.status === "OPEN" ? "review" : "info"
    });
  }

  for (const evaluation of teamEvaluations) {
    if (evaluation.status === "SELF_SUBMITTED") {
      pushUnique(needsMyAction, {
        id: `team-eval-${evaluation.id}`,
        title: `${evaluation.employee?.name || "Employee"} is waiting for review`,
        description: `${evaluation.periodLabel} is ready for manager scoring.`,
        href: `/performance/${evaluation.id}`,
        tone: "review"
      });
    }
  }

  if (manager) {
    const employeesMissingGoals = teamReportsToday.filter(Boolean);
    for (const reportUser of employeesMissingGoals) {
      if (reportUser.dailyReports.length > 0) continue;
      pushUnique(needsMyAction, {
        id: `missing-report-${reportUser.id}`,
        title: `${reportUser.name} is missing today's daily report`,
        description: "Open Team view for follow-up.",
        href: "/team",
        tone: "warning",
        meta: today
      });
    }
  }

  for (const onboarding of onboardingRows) {
    const ownerName = onboarding.employee?.name || onboarding.candidate?.fullName || "Onboarding";
    const description =
      onboarding.status === "WAITING_EMPLOYEE_ACTIONS"
        ? "Employee has pending onboarding actions."
        : onboarding.status === "WAITING_MANAGER_ACTIONS"
          ? "Manager follow-up is required."
          : onboarding.status === "WAITING_HR_ACTIONS"
            ? "HR follow-up is required."
            : "Active onboarding in progress.";

    const target =
      onboarding.status === "WAITING_EMPLOYEE_ACTIONS" && onboarding.employee?.id === actor.id
        ? needsMyAction
        : hrAccess && onboarding.status === "WAITING_HR_ACTIONS"
          ? needsMyAction
          : manager && onboarding.status === "WAITING_MANAGER_ACTIONS"
            ? needsMyAction
            : assignedToMe;

    pushUnique(target, {
      id: `onboarding-${onboarding.id}`,
      title: ownerName,
      description,
      href: `/onboarding/${onboarding.id}`,
      tone: onboarding.status === "ACTIVE" ? "info" : "review",
      meta: onboarding.status
    });
  }

  for (const absence of myAbsences) {
    if (absence.status === "PENDING") continue;
    pushUnique(recentUpdates, {
      id: `absence-update-${absence.id}`,
      title: `${absence.type} request updated`,
      description: `Status: ${absence.status}`,
      href: "/absence",
      tone: absence.status === "APPROVED" ? "success" : "warning",
      meta: formatInTimeZone(absence.updatedAt, APP_TIMEZONE, "yyyy-MM-dd")
    });
  }

  for (const notification of notifications) {
    const target = notification.isRead ? recentUpdates : needsMyAction;
    pushUnique(target, {
      id: `hr-notification-${notification.id}`,
      title: notification.title,
      description: notification.body || "Open the related record for more detail.",
      href: notification.href || "/hr",
      tone: notification.isRead ? "info" : "review",
      meta: formatInTimeZone(notification.createdAt, APP_TIMEZONE, "yyyy-MM-dd HH:mm")
    });
  }

  return {
    needsMyAction: needsMyAction.slice(0, limit),
    assignedToMe: assignedToMe.slice(0, limit),
    recentUpdates: recentUpdates.slice(0, limit),
    totals: {
      needsMyAction: needsMyAction.length,
      assignedToMe: assignedToMe.length,
      recentUpdates: recentUpdates.length
    }
  };
}
