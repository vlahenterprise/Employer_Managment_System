import "server-only";

import type { OnboardingItemOwner, OnboardingStatus, UserRole } from "@prisma/client";
import { prisma } from "./db";
import { getAllSettingsMap } from "./settings";
import { canViewEmployeeProfile, getScopedEmployeeIds, hasHrAddon, isManagerRole } from "./rbac";
import { loadOrgUsers } from "./org";
import { getPositionResourceFallbackByUserId } from "./org-structure";

type OnboardingActor = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  hrAddon?: boolean;
  adminAddon?: boolean;
};

type ChecklistSeed = {
  title: string;
  description?: string;
  ownerType: OnboardingItemOwner;
};

const DEFAULT_CHECKLIST: ChecklistSeed[] = [
  { title: "System access ready", ownerType: "HR" },
  { title: "Equipment ready", ownerType: "HR" },
  { title: "Introduction to team", ownerType: "MANAGER" },
  { title: "Job description shared", ownerType: "MANAGER" },
  { title: "Work instructions shared", ownerType: "MANAGER" },
  { title: "Onboarding materials shared", ownerType: "HR" },
  { title: "Initial tasks defined", ownerType: "MANAGER" },
  { title: "First week check-in", ownerType: "MANAGER" },
  { title: "30-day check-in", ownerType: "MANAGER" }
];

function cleanText(value: string | null | undefined) {
  return String(value || "").trim();
}

function normalizeChecklist(items: unknown): ChecklistSeed[] {
  if (!Array.isArray(items)) return DEFAULT_CHECKLIST;
  const normalized: ChecklistSeed[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const title = cleanText(String(row.title || ""));
    const description = cleanText(String(row.description || ""));
    const ownerType = cleanText(String(row.ownerType || "SHARED")).toUpperCase() as OnboardingItemOwner;
    if (!title) continue;
    if (!["HR", "MANAGER", "EMPLOYEE", "SHARED"].includes(ownerType)) continue;
    normalized.push({ title, description: description || undefined, ownerType });
  }

  return normalized.length ? normalized : DEFAULT_CHECKLIST;
}

async function loadChecklistSettings() {
  const settings = await getAllSettingsMap();
  const raw = cleanText(settings.OnboardingDefaultChecklist);
  if (!raw) return DEFAULT_CHECKLIST;
  try {
    return normalizeChecklist(JSON.parse(raw));
  } catch {
    return DEFAULT_CHECKLIST;
  }
}

export function canEditOnboarding(actor: Pick<OnboardingActor, "id" | "role" | "hrAddon">, onboarding: { managerId: string | null }) {
  return hasHrAddon(actor) || actor.id === onboarding.managerId;
}

export async function ensureOnboardingForApprovedCandidate(params: {
  processId: string;
  candidateId: string;
  managerId?: string | null;
  teamId?: string | null;
  hrOwnerId?: string | null;
  startDate?: Date | null;
  jobDescriptionUrl?: string | null;
  workInstructionsUrl?: string | null;
}) {
  const existing = await prisma.onboarding.findFirst({
    where: {
      OR: [
        { processId: params.processId },
        { candidateId: params.candidateId }
      ]
    },
    select: { id: true }
  });
  if (existing) return existing;

  const checklist = await loadChecklistSettings();
  return prisma.onboarding.create({
    data: {
      processId: params.processId,
      candidateId: params.candidateId,
      managerId: params.managerId || null,
      teamId: params.teamId || null,
      hrOwnerId: params.hrOwnerId || null,
      startDate: params.startDate || null,
      status: "PLANNED",
      jobDescriptionUrl: cleanText(params.jobDescriptionUrl) || null,
      workInstructionsUrl: cleanText(params.workInstructionsUrl) || null,
      items: {
        create: checklist.map((item, index) => ({
          title: item.title,
          description: item.description || null,
          ownerType: item.ownerType,
          order: index
        }))
      }
    },
    select: { id: true }
  });
}

export async function getOnboardingDashboard(actor: OnboardingActor) {
  if (!hasHrAddon(actor) && !isManagerRole(actor.role) && !actor.id) {
    return { ok: false as const, error: "NO_ACCESS" };
  }

  const orgUsers = await loadOrgUsers();
  const scopedIds = getScopedEmployeeIds(actor, orgUsers);
  const where = hasHrAddon(actor)
    ? {}
    : {
        OR: [
          { employeeId: actor.id },
          { managerId: actor.id },
          { employeeId: { in: [...scopedIds] } }
        ]
      };

  const [items, activeUsers] = await Promise.all([
    prisma.onboarding.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
      select: {
        id: true,
        status: true,
        startDate: true,
        updatedAt: true,
        note: true,
        process: { select: { id: true, positionTitle: true } },
        candidate: { select: { id: true, fullName: true, email: true } },
        employee: { select: { id: true, name: true, email: true, position: true } },
        team: { select: { id: true, name: true } },
        manager: { select: { id: true, name: true, email: true } },
        hrOwner: { select: { id: true, name: true, email: true } },
        items: {
          orderBy: [{ order: "asc" }],
          select: {
            id: true,
            title: true,
            ownerType: true,
            isCompleted: true
          }
        }
      }
    }),
    prisma.user.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ name: "asc" }],
      select: { id: true, name: true, email: true, position: true, team: { select: { id: true, name: true } } }
    })
  ]);

  const metrics = {
    total: items.length,
    planned: items.filter((item) => item.status === "PLANNED").length,
    active: items.filter((item) => item.status === "ACTIVE").length,
    waitingEmployee: items.filter((item) => item.status === "WAITING_EMPLOYEE_ACTIONS").length,
    waitingManager: items.filter((item) => item.status === "WAITING_MANAGER_ACTIONS").length,
    waitingHr: items.filter((item) => item.status === "WAITING_HR_ACTIONS").length,
    completed: items.filter((item) => item.status === "COMPLETED").length
  };

  return { ok: true as const, items, metrics, users: activeUsers };
}

export async function getOnboardingDetail(actor: OnboardingActor, onboardingId: string) {
  const id = cleanText(onboardingId);
  if (!id) return { ok: false as const, error: "NOT_FOUND" };

  const onboarding = await prisma.onboarding.findUnique({
    where: { id },
    select: {
      id: true,
      managerId: true,
      status: true,
      startDate: true,
      note: true,
      jobDescriptionUrl: true,
      workInstructionsUrl: true,
      onboardingDocsUrl: true,
      createdAt: true,
      updatedAt: true,
      process: { select: { id: true, positionTitle: true, status: true, desiredStartDate: true } },
      candidate: { select: { id: true, fullName: true, email: true, phone: true, cvDriveUrl: true } },
      employee: {
        select: {
          id: true,
          name: true,
          email: true,
          position: true,
          employmentDate: true,
          jobDescriptionUrl: true,
          workInstructionsUrl: true
        }
      },
      team: { select: { id: true, name: true } },
      manager: { select: { id: true, name: true, email: true } },
      hrOwner: { select: { id: true, name: true, email: true } },
      items: {
        orderBy: [{ order: "asc" }],
        select: {
          id: true,
          title: true,
          description: true,
          ownerType: true,
          driveUrl: true,
          isCompleted: true,
          completedAt: true,
          completedBy: { select: { id: true, name: true, email: true } }
        }
      }
    }
  });
  if (!onboarding) return { ok: false as const, error: "NOT_FOUND" };

  const orgUsers = await loadOrgUsers();
  const targetId = onboarding.employee?.id || onboarding.manager?.id || actor.id;
  const canView =
    hasHrAddon(actor) ||
    actor.id === onboarding.employee?.id ||
    actor.id === onboarding.manager?.id ||
    canViewEmployeeProfile(actor, targetId, orgUsers);
  if (!canView) return { ok: false as const, error: "NO_ACCESS" };

  const [users, orgResources] = await Promise.all([
    prisma.user.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ name: "asc" }],
      select: { id: true, name: true, email: true }
    }),
    onboarding.employee?.id
      ? getPositionResourceFallbackByUserId(onboarding.employee.id)
      : Promise.resolve<Awaited<ReturnType<typeof getPositionResourceFallbackByUserId>>>({
          positionTitle: onboarding.employee?.position ?? null,
          jobDescriptionUrl: null,
          workInstructionsUrl: null,
          positionDocuments: [],
          globalLinks: []
        })
  ]);

  return {
    ok: true as const,
    onboarding,
    orgResources,
    users,
    permissions: {
      canEdit: canEditOnboarding(actor, onboarding),
      isEmployee: actor.id === onboarding.employee?.id
    }
  };
}

export async function updateOnboarding(params: {
  actor: OnboardingActor;
  onboardingId: string;
  status?: OnboardingStatus | null;
  startDate?: string | Date | null;
  note?: string | null;
  jobDescriptionUrl?: string | null;
  workInstructionsUrl?: string | null;
  onboardingDocsUrl?: string | null;
  employeeId?: string | null;
}) {
  const detail = await getOnboardingDetail(params.actor, params.onboardingId);
  if (!detail.ok) return detail;
  if (!detail.permissions.canEdit) return { ok: false as const, error: "NO_ACCESS" };

  const startDate =
    params.startDate instanceof Date
      ? params.startDate
      : cleanText(String(params.startDate || ""))
        ? new Date(String(params.startDate))
        : null;

  await prisma.onboarding.update({
    where: { id: params.onboardingId },
    data: {
      status: params.status || detail.onboarding.status,
      startDate: startDate && !Number.isNaN(startDate.getTime()) ? startDate : detail.onboarding.startDate,
      note: cleanText(params.note) || null,
      jobDescriptionUrl: cleanText(params.jobDescriptionUrl) || null,
      workInstructionsUrl: cleanText(params.workInstructionsUrl) || null,
      onboardingDocsUrl: cleanText(params.onboardingDocsUrl) || null,
      employeeId: cleanText(params.employeeId) || null
    }
  });

  return { ok: true as const };
}

export async function addOnboardingItem(params: {
  actor: OnboardingActor;
  onboardingId: string;
  title: string;
  description?: string | null;
  ownerType?: OnboardingItemOwner | null;
  driveUrl?: string | null;
}) {
  const detail = await getOnboardingDetail(params.actor, params.onboardingId);
  if (!detail.ok) return detail;
  if (!detail.permissions.canEdit) return { ok: false as const, error: "NO_ACCESS" };

  const title = cleanText(params.title);
  if (!title) return { ok: false as const, error: "TITLE_REQUIRED" };
  const maxOrder = detail.onboarding.items.reduce((max, item, index) => Math.max(max, index), -1);

  await prisma.onboardingItem.create({
    data: {
      onboardingId: params.onboardingId,
      title,
      description: cleanText(params.description) || null,
      ownerType: params.ownerType || "SHARED",
      driveUrl: cleanText(params.driveUrl) || null,
      order: maxOrder + 1
    }
  });

  return { ok: true as const };
}

export async function toggleOnboardingItem(params: {
  actor: OnboardingActor;
  itemId: string;
  completed: boolean;
}) {
  const item = await prisma.onboardingItem.findUnique({
    where: { id: cleanText(params.itemId) },
    select: { id: true, onboardingId: true, ownerType: true }
  });
  if (!item) return { ok: false as const, error: "ITEM_NOT_FOUND" };

  const detail = await getOnboardingDetail(params.actor, item.onboardingId);
  if (!detail.ok) return detail;
  const canEdit =
    detail.permissions.canEdit ||
    (detail.permissions.isEmployee && (item.ownerType === "EMPLOYEE" || item.ownerType === "SHARED"));
  if (!canEdit) return { ok: false as const, error: "NO_ACCESS" };

  await prisma.onboardingItem.update({
    where: { id: item.id },
    data: {
      isCompleted: params.completed,
      completedAt: params.completed ? new Date() : null,
      completedById: params.completed ? params.actor.id : null
    }
  });

  return { ok: true as const };
}
