import "server-only";

import type { OnboardingItemOwner, OnboardingStatus, UserRole } from "@prisma/client";
import { prisma } from "./db";
import { getAllSettingsMap } from "./settings";
import { idSchema, optionalTextSchema, requiredTextSchema } from "./validation";
import { canViewEmployeeProfile, getScopedEmployeeIds, hasHrAddon, isManagerRole } from "./rbac";
import { loadOrgUsers } from "./org";
import { getPositionResourceFallbackByPositionId, getPositionResourceFallbackByUserId } from "./org-structure";
import {
  buildOnboardingDueDate,
  isOnboardingPhaseReadyForClose,
  normalizeOnboardingLinks,
  parseOnboardingLinksInput,
  serializeOnboardingLinksInput,
  type OnboardingResourceLink
} from "@/lib/onboarding";
import { normalizeOrgSearchText } from "@/lib/org-system";

export type OnboardingActor = {
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

function parseOptionalDate(value: Date | string | null | undefined) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const raw = cleanText(String(value || ""));
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
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

function canManageOnboardingTemplates(actor: Pick<OnboardingActor, "role" | "hrAddon">) {
  return hasHrAddon(actor);
}

export function canEditOnboarding(actor: Pick<OnboardingActor, "id" | "role" | "hrAddon">, onboarding: { managerId: string | null }) {
  return hasHrAddon(actor) || actor.id === onboarding.managerId;
}

function canConfirmManager(actor: Pick<OnboardingActor, "id">, onboarding: { managerId: string | null }) {
  return Boolean(onboarding.managerId) && actor.id === onboarding.managerId;
}

function normalizeOwnerType(value: string | null | undefined): OnboardingItemOwner {
  const normalized = cleanText(value).toUpperCase();
  if (normalized === "HR" || normalized === "MANAGER" || normalized === "EMPLOYEE" || normalized === "SHARED") {
    return normalized;
  }
  return "SHARED";
}

function normalizePositiveInt(value: string | number | null | undefined) {
  if (value == null || value === "") return null;
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.max(0, Math.floor(num));
}

function validateLinksText(value: string | null | undefined) {
  const parsed = parseOnboardingLinksInput(value);
  return parsed;
}

function resolveOnboardingItemLinks(item: { links: unknown; driveUrl: string | null }): OnboardingResourceLink[] {
  const links = normalizeOnboardingLinks(item.links);
  if (links.length) return links;
  return item.driveUrl ? [{ label: "Drive", url: item.driveUrl }] : [];
}

async function loadTemplateByPositionId(positionId: string) {
  const id = cleanText(positionId);
  if (!id) return null;
  return prisma.onboardingTemplate.findUnique({
    where: { positionId: id },
    include: {
      position: { select: { id: true, title: true, tier: true } },
      steps: {
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        include: { mentor: { select: { id: true, name: true, email: true } } }
      }
    }
  });
}

async function resolvePositionAndTemplateByTitle(positionTitle: string | null | undefined) {
  const positions = await prisma.orgPosition.findMany({
    where: { isActive: true },
    select: { id: true, title: true, tier: true, order: true }
  });
  const match = positions.find((position) => normalizeOrgSearchText(position.title) === normalizeOrgSearchText(positionTitle));
  if (!match) return { position: null, template: null };
  const template = await loadTemplateByPositionId(match.id);
  return { position: match, template };
}

type TemplateLike = {
  steps: Array<{
    id: string;
    title: string;
    description?: string | null;
    ownerType: OnboardingItemOwner;
    dueOffsetDays?: number | null;
    mentorId?: string | null;
    links?: unknown;
    hrConfirmationRequired?: boolean | null;
    managerConfirmationRequired?: boolean | null;
    order?: number | null;
  }>;
} | null;

async function buildTemplateItemData(template: TemplateLike, startDate: Date | null) {
  if (template?.steps.length) {
    return template.steps.map((step, index) => ({
      templateStepId: step.id,
      title: step.title,
      description: step.description || null,
      ownerType: step.ownerType,
      driveUrl: normalizeOnboardingLinks(step.links)[0]?.url ?? null,
      links: normalizeOnboardingLinks(step.links),
      dueDate: buildOnboardingDueDate(startDate, step.dueOffsetDays),
      mentorId: step.mentorId || null,
      hrConfirmationRequired: step.hrConfirmationRequired === true,
      managerConfirmationRequired: step.managerConfirmationRequired === true,
      order: step.order ?? index
    }));
  }

  const checklist = await loadChecklistSettings();
  return checklist.map((item, index) => ({
    title: item.title,
    description: item.description || null,
    ownerType: item.ownerType,
    order: index,
    hrConfirmationRequired: false,
    managerConfirmationRequired: false
  }));
}

function getItemProgress(items: Array<{
  isCompleted: boolean;
  hrConfirmationRequired: boolean;
  managerConfirmationRequired: boolean;
  hrConfirmedAt: Date | null;
  managerConfirmedAt: Date | null;
}>) {
  if (!items.length) return 0;
  const completed = items.filter((item) => isOnboardingPhaseReadyForClose(item)).length;
  return Math.round((completed / items.length) * 100);
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
      OR: [{ processId: params.processId }, { candidateId: params.candidateId }]
    },
    select: { id: true }
  });
  if (existing) return existing;

  const process = await prisma.hrProcess.findUnique({
    where: { id: params.processId },
    select: { positionTitle: true }
  });
  const resolved = await resolvePositionAndTemplateByTitle(process?.positionTitle);
  const templateItems = await buildTemplateItemData(resolved.template, params.startDate || null);
  const resources = resolved.position ? await getPositionResourceFallbackByPositionId(resolved.position.id) : null;

  return prisma.onboarding.create({
    data: {
      processId: params.processId,
      candidateId: params.candidateId,
      positionId: resolved.position?.id ?? null,
      templateId: resolved.template?.id ?? null,
      managerId: params.managerId || null,
      teamId: params.teamId || null,
      hrOwnerId: params.hrOwnerId || null,
      startDate: params.startDate || null,
      status: "PLANNED",
      jobDescriptionUrl: cleanText(params.jobDescriptionUrl) || resources?.jobDescriptionUrl || null,
      workInstructionsUrl: cleanText(params.workInstructionsUrl) || resources?.workInstructionsUrl || null,
      items: { create: templateItems }
    },
    select: { id: true }
  });
}

export async function getOnboardingDashboard(actor: OnboardingActor) {
  if (!hasHrAddon(actor) && !isManagerRole(actor.role)) {
    return { ok: false as const, error: "NO_ACCESS" };
  }

  const orgUsers = await loadOrgUsers();
  const scopedIds = getScopedEmployeeIds(actor, orgUsers);
  const where = hasHrAddon(actor)
    ? {}
    : {
        OR: [{ employeeId: actor.id }, { managerId: actor.id }, { employeeId: { in: [...scopedIds] } }]
      };

  const [items, activeUsers, positions, templates, approvedApplications] = await Promise.all([
    prisma.onboarding.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
      select: {
        id: true,
        status: true,
        startDate: true,
        updatedAt: true,
        note: true,
        processId: true,
        candidateId: true,
        employeeId: true,
        positionId: true,
        templateId: true,
        process: { select: { id: true, positionTitle: true, status: true } },
        candidate: { select: { id: true, fullName: true, email: true } },
        employee: { select: { id: true, name: true, email: true, position: true } },
        position: { select: { id: true, title: true, tier: true } },
        template: { select: { id: true, title: true, position: { select: { id: true, title: true, tier: true } } } },
        team: { select: { id: true, name: true } },
        manager: { select: { id: true, name: true, email: true } },
        hrOwner: { select: { id: true, name: true, email: true } },
        items: {
          orderBy: [{ order: "asc" }],
          select: {
            id: true,
            title: true,
            ownerType: true,
            isCompleted: true,
            hrConfirmationRequired: true,
            managerConfirmationRequired: true,
            hrConfirmedAt: true,
            managerConfirmedAt: true
          }
        }
      }
    }),
    prisma.user.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ name: "asc" }],
      select: { id: true, name: true, email: true, position: true, managerId: true, team: { select: { id: true, name: true } } }
    }),
    prisma.orgPosition.findMany({
      where: { isActive: true },
      orderBy: [{ tier: "asc" }, { order: "asc" }, { title: "asc" }],
      select: { id: true, title: true, tier: true }
    }),
    prisma.onboardingTemplate.findMany({
      orderBy: [{ position: { order: "asc" } }, { position: { title: "asc" } }],
      select: {
        id: true,
        title: true,
        description: true,
        isActive: true,
        positionId: true,
        position: { select: { id: true, title: true, tier: true } },
        steps: {
          orderBy: [{ order: "asc" }],
          select: { id: true, title: true, dueOffsetDays: true, ownerType: true }
        },
        _count: { select: { onboardings: true } }
      }
    }),
    hasHrAddon(actor)
      ? prisma.hrProcessCandidate.findMany({
          where: { status: "APPROVED_FOR_EMPLOYMENT" },
          orderBy: [{ updatedAt: "desc" }],
          select: {
            id: true,
            processId: true,
            candidateId: true,
            updatedAt: true,
            process: {
              select: {
                id: true,
                positionTitle: true,
                team: { select: { id: true, name: true } },
                manager: { select: { id: true, name: true } }
              }
            },
            candidate: {
              select: {
                id: true,
                fullName: true,
                email: true,
                onboardings: {
                  select: { id: true, processId: true, employeeId: true, status: true, templateId: true }
                }
              }
            }
          }
        })
      : Promise.resolve([])
  ]);

  const metrics = {
    total: items.length,
    planned: items.filter((item) => item.status === "PLANNED").length,
    active: items.filter((item) => item.status === "ACTIVE").length,
    waitingEmployee: items.filter((item) => item.status === "WAITING_EMPLOYEE_ACTIONS").length,
    waitingManager: items.filter((item) => item.status === "WAITING_MANAGER_ACTIONS").length,
    waitingHr: items.filter((item) => item.status === "WAITING_HR_ACTIONS").length,
    completed: items.filter((item) => item.status === "COMPLETED").length,
    templates: templates.length,
    readyToAssign: approvedApplications.filter((application) => {
      const linked = application.candidate.onboardings.find((onboarding) => onboarding.processId === application.processId);
      return !linked || !linked.employeeId;
    }).length
  };

  const templateByPositionId = new Map(templates.map((template) => [template.positionId, template] as const));
  const resolvedReadyAssignments = approvedApplications
    .map((application) => {
      const linked = application.candidate.onboardings.find((onboarding) => onboarding.processId === application.processId) || null;
      const position = positions.find(
        (entry) => normalizeOrgSearchText(entry.title) === normalizeOrgSearchText(application.process.positionTitle)
      );
      const suggestedTemplate = position ? templateByPositionId.get(position.id) ?? null : null;
      return {
        applicationId: application.id,
        processId: application.processId,
        onboardingId: linked?.id ?? null,
        employeeAssigned: Boolean(linked?.employeeId),
        positionTitle: application.process.positionTitle,
        team: application.process.team,
        manager: application.process.manager,
        candidate: { id: application.candidate.id, fullName: application.candidate.fullName, email: application.candidate.email },
        position,
        suggestedTemplateId: suggestedTemplate?.id ?? null,
        suggestedTemplateTitle: suggestedTemplate?.title || suggestedTemplate?.position.title || null,
        onboardingStatus: linked?.status ?? null,
        updatedAt: application.updatedAt
      };
    })
    .filter((row) => !row.employeeAssigned);

  return {
    ok: true as const,
    items: items.map((item) => ({
      ...item,
      progress: getItemProgress(item.items)
    })),
    metrics,
    users: activeUsers,
    positions,
    templates,
    readyAssignments: resolvedReadyAssignments,
    permissions: {
      canManageTemplates: canManageOnboardingTemplates(actor),
      canAssignEmployees: hasHrAddon(actor)
    }
  };
}

export async function getOnboardingTemplateDetail(actor: OnboardingActor, templateId: string) {
  if (!canManageOnboardingTemplates(actor)) return { ok: false as const, error: "NO_ACCESS" };
  const id = cleanText(templateId);
  if (!id) return { ok: false as const, error: "NOT_FOUND" };

  const [template, users] = await Promise.all([
    prisma.onboardingTemplate.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        isActive: true,
        positionId: true,
        position: { select: { id: true, title: true, tier: true } },
        createdAt: true,
        updatedAt: true,
        steps: {
          orderBy: [{ order: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
            title: true,
            description: true,
            ownerType: true,
            dueOffsetDays: true,
            mentorId: true,
            mentor: { select: { id: true, name: true, email: true } },
            links: true,
            hrConfirmationRequired: true,
            managerConfirmationRequired: true,
            order: true
          }
        },
        onboardings: {
          where: { status: { not: "COMPLETED" } },
          orderBy: [{ updatedAt: "desc" }],
          take: 6,
          select: {
            id: true,
            status: true,
            employee: { select: { id: true, name: true } },
            candidate: { select: { id: true, fullName: true } }
          }
        }
      }
    }),
    prisma.user.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ name: "asc" }],
      select: { id: true, name: true, email: true, position: true }
    })
  ]);

  if (!template) return { ok: false as const, error: "NOT_FOUND" };

  return {
    ok: true as const,
    template: {
      ...template,
      steps: template.steps.map((step) => ({
        ...step,
        linksText: serializeOnboardingLinksInput(step.links)
      }))
    },
    users
  };
}

export async function createOrGetOnboardingTemplate(params: { actor: OnboardingActor; positionId: string }) {
  if (!canManageOnboardingTemplates(params.actor)) return { ok: false as const, error: "NO_ACCESS" };
  const positionId = cleanText(params.positionId);
  if (!idSchema.safeParse(positionId).success) return { ok: false as const, error: "POSITION_REQUIRED" };

  const existing = await prisma.onboardingTemplate.findUnique({
    where: { positionId },
    select: { id: true }
  });
  if (existing) return { ok: true as const, id: existing.id };

  const created = await prisma.onboardingTemplate.create({
    data: {
      positionId,
      createdById: params.actor.id
    },
    select: { id: true }
  });
  return { ok: true as const, id: created.id };
}

export async function updateOnboardingTemplate(params: {
  actor: OnboardingActor;
  templateId: string;
  title?: string | null;
  description?: string | null;
  isActive?: boolean | null;
}) {
  if (!canManageOnboardingTemplates(params.actor)) return { ok: false as const, error: "NO_ACCESS" };
  const templateId = cleanText(params.templateId);
  if (!idSchema.safeParse(templateId).success) return { ok: false as const, error: "NOT_FOUND" };

  await prisma.onboardingTemplate.update({
    where: { id: templateId },
    data: {
      title: cleanText(params.title) || null,
      description: cleanText(params.description) || null,
      isActive: params.isActive == null ? undefined : Boolean(params.isActive)
    }
  });

  return { ok: true as const };
}

export async function addOnboardingTemplateStep(params: {
  actor: OnboardingActor;
  templateId: string;
  title: string;
  description?: string | null;
  ownerType?: OnboardingItemOwner | null;
  dueOffsetDays?: number | null;
  mentorId?: string | null;
  hrConfirmationRequired?: boolean | null;
  managerConfirmationRequired?: boolean | null;
  linksText?: string | null;
}) {
  if (!canManageOnboardingTemplates(params.actor)) return { ok: false as const, error: "NO_ACCESS" };
  const templateId = cleanText(params.templateId);
  if (!idSchema.safeParse(templateId).success) return { ok: false as const, error: "NOT_FOUND" };
  const titleParsed = requiredTextSchema(180, "TITLE_REQUIRED").safeParse(params.title);
  if (!titleParsed.success) return { ok: false as const, error: titleParsed.error.issues[0]?.message || "TITLE_REQUIRED" };

  const maxOrder = await prisma.onboardingTemplateStep.aggregate({
    where: { templateId },
    _max: { order: true }
  });

  await prisma.onboardingTemplateStep.create({
    data: {
      templateId,
      title: titleParsed.data,
      description: optionalTextSchema(2000).parse(params.description ?? ""),
      ownerType: params.ownerType || "SHARED",
      dueOffsetDays: normalizePositiveInt(params.dueOffsetDays),
      mentorId: cleanText(params.mentorId) || null,
      hrConfirmationRequired: params.hrConfirmationRequired !== false,
      managerConfirmationRequired: params.managerConfirmationRequired !== false,
      links: validateLinksText(params.linksText),
      order: (maxOrder._max.order ?? -1) + 1
    }
  });

  return { ok: true as const };
}

export async function updateOnboardingTemplateStep(params: {
  actor: OnboardingActor;
  stepId: string;
  title: string;
  description?: string | null;
  ownerType?: OnboardingItemOwner | null;
  dueOffsetDays?: number | null;
  mentorId?: string | null;
  hrConfirmationRequired?: boolean | null;
  managerConfirmationRequired?: boolean | null;
  linksText?: string | null;
  order?: number | null;
}) {
  if (!canManageOnboardingTemplates(params.actor)) return { ok: false as const, error: "NO_ACCESS" };
  const stepId = cleanText(params.stepId);
  if (!idSchema.safeParse(stepId).success) return { ok: false as const, error: "STEP_NOT_FOUND" };
  const titleParsed = requiredTextSchema(180, "TITLE_REQUIRED").safeParse(params.title);
  if (!titleParsed.success) return { ok: false as const, error: titleParsed.error.issues[0]?.message || "TITLE_REQUIRED" };

  await prisma.onboardingTemplateStep.update({
    where: { id: stepId },
    data: {
      title: titleParsed.data,
      description: optionalTextSchema(2000).parse(params.description ?? ""),
      ownerType: params.ownerType || "SHARED",
      dueOffsetDays: normalizePositiveInt(params.dueOffsetDays),
      mentorId: cleanText(params.mentorId) || null,
      hrConfirmationRequired: params.hrConfirmationRequired !== false,
      managerConfirmationRequired: params.managerConfirmationRequired !== false,
      links: validateLinksText(params.linksText),
      order: normalizePositiveInt(params.order) ?? 0
    }
  });

  return { ok: true as const };
}

export async function deleteOnboardingTemplateStep(params: { actor: OnboardingActor; stepId: string }) {
  if (!canManageOnboardingTemplates(params.actor)) return { ok: false as const, error: "NO_ACCESS" };
  const stepId = cleanText(params.stepId);
  if (!idSchema.safeParse(stepId).success) return { ok: false as const, error: "STEP_NOT_FOUND" };
  await prisma.onboardingTemplateStep.delete({ where: { id: stepId } });
  return { ok: true as const };
}

export async function assignOnboardingProcess(params: {
  actor: OnboardingActor;
  templateId: string;
  employeeId: string;
  startDate?: string | Date | null;
  onboardingId?: string | null;
  status?: OnboardingStatus | null;
}) {
  if (!hasHrAddon(params.actor)) return { ok: false as const, error: "NO_ACCESS" };

  const templateId = cleanText(params.templateId);
  const employeeId = cleanText(params.employeeId);
  if (!idSchema.safeParse(templateId).success) return { ok: false as const, error: "TEMPLATE_REQUIRED" };
  if (!idSchema.safeParse(employeeId).success) return { ok: false as const, error: "EMPLOYEE_REQUIRED" };
  const onboardingId = cleanText(params.onboardingId) || null;
  const startDate = parseOptionalDate(params.startDate) || new Date();
  const status = params.status || "ACTIVE";

  const [template, employee, existingForEmployee] = await Promise.all([
    prisma.onboardingTemplate.findUnique({
      where: { id: templateId },
      include: {
        position: { select: { id: true, title: true } },
        steps: {
          orderBy: [{ order: "asc" }, { createdAt: "asc" }],
          include: { mentor: { select: { id: true } } }
        }
      }
    }),
    prisma.user.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        name: true,
        email: true,
        teamId: true,
        managerId: true
      }
    }),
    prisma.onboarding.findFirst({
      where: {
        employeeId,
        status: { not: "COMPLETED" },
        ...(onboardingId ? { id: { not: onboardingId } } : {})
      },
      select: { id: true }
    })
  ]);

  if (!template) return { ok: false as const, error: "TEMPLATE_REQUIRED" };
  if (!employee) return { ok: false as const, error: "EMPLOYEE_REQUIRED" };
  if (existingForEmployee) return { ok: false as const, error: "EMPLOYEE_ALREADY_HAS_ONBOARDING" };

  const resources = await getPositionResourceFallbackByPositionId(template.positionId);
  const itemsData = await buildTemplateItemData(template, startDate);
  const data = {
    templateId: template.id,
    positionId: template.positionId,
    employeeId: employee.id,
    teamId: employee.teamId,
    managerId: employee.managerId,
    hrOwnerId: params.actor.id,
    startDate,
    status,
    jobDescriptionUrl: resources.jobDescriptionUrl,
    workInstructionsUrl: resources.workInstructionsUrl
  };

  if (onboardingId) {
    const id = onboardingId;
    await prisma.$transaction(async (tx) => {
      await tx.onboarding.update({
        where: { id },
        data
      });
      await tx.onboardingItem.deleteMany({ where: { onboardingId: id } });
      if (itemsData.length) {
        await tx.onboardingItem.createMany({
          data: itemsData.map((item) => ({ onboardingId: id, ...item }))
        });
      }
    });
    return { ok: true as const, id };
  }

  const created = await prisma.onboarding.create({
    data: {
      ...data,
      items: { create: itemsData }
    },
    select: { id: true }
  });

  return { ok: true as const, id: created.id };
}

export async function getOnboardingDetail(actor: OnboardingActor, onboardingId: string) {
  const id = cleanText(onboardingId);
  if (!id) return { ok: false as const, error: "NOT_FOUND" };

  const onboarding = await prisma.onboarding.findUnique({
    where: { id },
    select: {
      id: true,
      managerId: true,
      positionId: true,
      templateId: true,
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
      position: { select: { id: true, title: true, tier: true } },
      template: {
        select: {
          id: true,
          title: true,
          position: { select: { id: true, title: true, tier: true } }
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
          links: true,
          dueDate: true,
          mentorId: true,
          mentor: { select: { id: true, name: true, email: true } },
          isCompleted: true,
          completedAt: true,
          completedBy: { select: { id: true, name: true, email: true } },
          hrConfirmationRequired: true,
          hrConfirmedAt: true,
          hrConfirmedBy: { select: { id: true, name: true, email: true } },
          managerConfirmationRequired: true,
          managerConfirmedAt: true,
          managerConfirmedBy: { select: { id: true, name: true, email: true } }
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

  const [users, templates, orgResources] = await Promise.all([
    prisma.user.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ name: "asc" }],
      select: { id: true, name: true, email: true, position: true }
    }),
    prisma.onboardingTemplate.findMany({
      where: { isActive: true },
      orderBy: [{ position: { order: "asc" } }, { position: { title: "asc" } }],
      select: {
        id: true,
        title: true,
        positionId: true,
        position: { select: { id: true, title: true, tier: true } }
      }
    }),
    onboarding.positionId
      ? getPositionResourceFallbackByPositionId(onboarding.positionId)
      : onboarding.employee?.id
        ? getPositionResourceFallbackByUserId(onboarding.employee.id)
        : Promise.resolve({
            positionTitle: onboarding.position?.title ?? onboarding.process?.positionTitle ?? null,
            jobDescriptionUrl: null,
            workInstructionsUrl: null,
            positionDocuments: [],
            globalLinks: []
          })
  ]);

  return {
    ok: true as const,
    onboarding: {
      ...onboarding,
      items: onboarding.items.map((item) => ({
        ...item,
        linksResolved: resolveOnboardingItemLinks(item),
        isReadyForClose: isOnboardingPhaseReadyForClose(item)
      }))
    },
    orgResources,
    users,
    templates,
    permissions: {
      canEdit: canEditOnboarding(actor, onboarding),
      canAssign: hasHrAddon(actor),
      canConfirmHr: hasHrAddon(actor),
      canConfirmManager: canConfirmManager(actor, onboarding),
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

  const startDate = parseOptionalDate(params.startDate) || detail.onboarding.startDate;

  await prisma.onboarding.update({
    where: { id: params.onboardingId },
    data: {
      status: params.status || detail.onboarding.status,
      startDate,
      note: cleanText(params.note) || null,
      jobDescriptionUrl: cleanText(params.jobDescriptionUrl) || null,
      workInstructionsUrl: cleanText(params.workInstructionsUrl) || null,
      onboardingDocsUrl: cleanText(params.onboardingDocsUrl) || null,
      employeeId: hasHrAddon(params.actor) ? cleanText(params.employeeId) || detail.onboarding.employee?.id || null : undefined
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
  dueDate?: string | Date | null;
  mentorId?: string | null;
  linksText?: string | null;
  hrConfirmationRequired?: boolean | null;
  managerConfirmationRequired?: boolean | null;
}) {
  const detail = await getOnboardingDetail(params.actor, params.onboardingId);
  if (!detail.ok) return detail;
  if (!detail.permissions.canEdit) return { ok: false as const, error: "NO_ACCESS" };
  if (detail.onboarding.templateId) return { ok: false as const, error: "TEMPLATE_PHASES_LOCKED" };

  const titleParsed = requiredTextSchema(180, "TITLE_REQUIRED").safeParse(params.title);
  if (!titleParsed.success) return { ok: false as const, error: titleParsed.error.issues[0]?.message || "TITLE_REQUIRED" };
  const maxOrder = detail.onboarding.items.reduce((max, _item, index) => Math.max(max, index), -1);

  await prisma.onboardingItem.create({
    data: {
      onboardingId: params.onboardingId,
      title: titleParsed.data,
      description: optionalTextSchema(2000).parse(params.description ?? ""),
      ownerType: normalizeOwnerType(params.ownerType),
      driveUrl: cleanText(params.driveUrl) || null,
      links: validateLinksText(params.linksText),
      dueDate: parseOptionalDate(params.dueDate),
      mentorId: cleanText(params.mentorId) || null,
      hrConfirmationRequired: params.hrConfirmationRequired === true,
      managerConfirmationRequired: params.managerConfirmationRequired === true,
      order: maxOrder + 1
    }
  });

  return { ok: true as const };
}

export async function updateOnboardingItem(params: {
  actor: OnboardingActor;
  onboardingId: string;
  itemId: string;
  title: string;
  description?: string | null;
  ownerType?: OnboardingItemOwner | null;
  driveUrl?: string | null;
  dueDate?: string | Date | null;
  mentorId?: string | null;
  linksText?: string | null;
  hrConfirmationRequired?: boolean | null;
  managerConfirmationRequired?: boolean | null;
}) {
  const detail = await getOnboardingDetail(params.actor, params.onboardingId);
  if (!detail.ok) return detail;
  if (!detail.permissions.canEdit) return { ok: false as const, error: "NO_ACCESS" };
  if (detail.onboarding.templateId) return { ok: false as const, error: "TEMPLATE_PHASES_LOCKED" };
  const itemId = cleanText(params.itemId);
  if (!idSchema.safeParse(itemId).success) return { ok: false as const, error: "ITEM_NOT_FOUND" };
  if (!detail.onboarding.items.some((item) => item.id === itemId)) return { ok: false as const, error: "ITEM_NOT_FOUND" };
  const titleParsed = requiredTextSchema(180, "TITLE_REQUIRED").safeParse(params.title);
  if (!titleParsed.success) return { ok: false as const, error: titleParsed.error.issues[0]?.message || "TITLE_REQUIRED" };

  await prisma.onboardingItem.update({
    where: { id: itemId },
    data: {
      title: titleParsed.data,
      description: optionalTextSchema(2000).parse(params.description ?? ""),
      ownerType: normalizeOwnerType(params.ownerType),
      driveUrl: cleanText(params.driveUrl) || null,
      links: validateLinksText(params.linksText),
      dueDate: parseOptionalDate(params.dueDate),
      mentorId: cleanText(params.mentorId) || null,
      hrConfirmationRequired: params.hrConfirmationRequired === true,
      managerConfirmationRequired: params.managerConfirmationRequired === true
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
  if (!detail.onboarding.items.some((entry) => entry.id === item.id)) return { ok: false as const, error: "ITEM_NOT_FOUND" };
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

export async function confirmOnboardingItem(params: {
  actor: OnboardingActor;
  onboardingId: string;
  itemId: string;
  kind: "HR" | "MANAGER";
  confirmed: boolean;
}) {
  const detail = await getOnboardingDetail(params.actor, params.onboardingId);
  if (!detail.ok) return detail;
  const itemId = cleanText(params.itemId);
  if (!idSchema.safeParse(itemId).success) return { ok: false as const, error: "ITEM_NOT_FOUND" };
  if (!detail.onboarding.items.some((item) => item.id === itemId)) return { ok: false as const, error: "ITEM_NOT_FOUND" };

  if (params.kind === "HR" && !detail.permissions.canConfirmHr) return { ok: false as const, error: "NO_ACCESS" };
  if (params.kind === "MANAGER" && !detail.permissions.canConfirmManager) return { ok: false as const, error: "NO_ACCESS" };

  await prisma.onboardingItem.update({
    where: { id: itemId },
    data:
      params.kind === "HR"
        ? {
            hrConfirmedAt: params.confirmed ? new Date() : null,
            hrConfirmedById: params.confirmed ? params.actor.id : null
          }
        : {
            managerConfirmedAt: params.confirmed ? new Date() : null,
            managerConfirmedById: params.confirmed ? params.actor.id : null
          }
  });

  return { ok: true as const };
}
