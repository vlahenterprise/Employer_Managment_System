import "server-only";

import { Prisma, type HrCandidateStatus, type HrPriority, type HrProcessStatus, type UserRole } from "@prisma/client";
import { prisma } from "./db";
import { buildOrgIndex, loadOrgUsers } from "./org";
import {
  getScopedEmployeeIds,
  hasHrAddon as actorHasHrAddon,
  hasManagementPanelAccess as actorHasManagementPanelAccess,
  isManagerRole
} from "./rbac";
import { logInfo } from "./log";
import { ensureOnboardingForApprovedCandidate } from "./onboarding";

type HrActor = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  hrAddon?: boolean;
  adminAddon?: boolean;
  teamId?: string | null;
  managerId?: string | null;
};

type ProcessFilterInput = {
  teamId?: string | null;
  status?: string | null;
  managerId?: string | null;
  query?: string | null;
};

const OPEN_PROCESS_STATUSES: HrProcessStatus[] = ["DRAFT", "OPEN", "IN_PROGRESS", "ON_HOLD", "APPROVED"];
const ACTIVE_CANDIDATE_STATUSES: HrCandidateStatus[] = [
  "NEW_APPLICANT",
  "HR_SCREENING",
  "SENT_TO_MANAGER",
  "WAITING_MANAGER_REVIEW",
  "INTERVIEW_SCHEDULED",
  "SECOND_ROUND_COMPLETED",
  "WAITING_FINAL_APPROVAL",
  "APPROVED_FOR_EMPLOYMENT"
];

function normalizeEmail(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function normalizePhone(value: string | null | undefined) {
  return String(value || "").replace(/[^+\d]/g, "").trim();
}

function cleanText(value: string | null | undefined) {
  return String(value || "").trim();
}

function toDateOrNull(value: string | Date | null | undefined) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function dedupe<T>(items: T[]) {
  return [...new Set(items)];
}

function hasActorHrAddon(actor: Pick<HrActor, "role" | "hrAddon">) {
  return actorHasHrAddon(actor);
}

function hasManagementPanel(actor: Pick<HrActor, "role">) {
  return actorHasManagementPanelAccess(actor);
}

function buildManagerChain(managerId: string | null | undefined, managerOf: Map<string, string | null>) {
  const chain: string[] = [];
  const seen = new Set<string>();
  let current = managerId ?? null;
  while (current && !seen.has(current)) {
    seen.add(current);
    chain.push(current);
    current = managerOf.get(current) ?? null;
  }
  return chain;
}

function isVisibleThroughManagerChain(actorId: string, managerId: string | null | undefined, managerOf: Map<string, string | null>) {
  if (!actorId || !managerId) return false;
  if (actorId === managerId) return true;
  return buildManagerChain(managerId, managerOf).includes(actorId);
}

function pickPrimaryManager(teamId: string | null | undefined, users: Awaited<ReturnType<typeof loadOrgUsers>>) {
  if (!teamId) return null;
  const teamManagers = users.filter(
    (user) => user.status === "ACTIVE" && user.teamId === teamId && isManagerRole(user.role)
  );
  if (teamManagers.length === 0) return null;
  const ids = new Set(teamManagers.map((user) => user.id));
  const highest = teamManagers.filter((user) => !user.managerId || !ids.has(user.managerId));
  return (highest[0] || teamManagers[0]) ?? null;
}

function pickFinalApprover(managerId: string | null | undefined, managerOf: Map<string, string | null>) {
  if (!managerId) return null;
  return managerOf.get(managerId) ?? null;
}

async function createNotificationsTx(
  tx: Omit<typeof prisma, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">,
  input: {
    userIds: string[];
    type: string;
    title: string;
    body?: string | null;
    href?: string | null;
    processId?: string | null;
    processCandidateId?: string | null;
  }
) {
  const userIds = dedupe(input.userIds.filter(Boolean));
  if (userIds.length === 0) return;
  await tx.hrNotification.createMany({
    data: userIds.map((userId) => ({
      userId,
      type: input.type,
      title: input.title,
      body: input.body || null,
      href: input.href || null,
      processId: input.processId || null,
      processCandidateId: input.processCandidateId || null
    }))
  });
}

async function logAuditTx(
  tx: Omit<typeof prisma, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">,
  input: {
    actorId?: string | null;
    processId?: string | null;
    processCandidateId?: string | null;
    candidateId?: string | null;
    action: string;
    field?: string | null;
    oldValue?: string | null;
    newValue?: string | null;
    comment?: string | null;
  }
) {
  await tx.hrAuditLog.create({
    data: {
      actorId: input.actorId || null,
      processId: input.processId || null,
      processCandidateId: input.processCandidateId || null,
      candidateId: input.candidateId || null,
      action: input.action,
      field: input.field || null,
      oldValue: input.oldValue || null,
      newValue: input.newValue || null,
      comment: input.comment || null
    }
  });
}

async function addCommentTx(
  tx: Omit<typeof prisma, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">,
  input: {
    processCandidateId: string;
    actorId?: string | null;
    stage: string;
    body?: string | null;
  }
) {
  const body = cleanText(input.body);
  if (!body) return;
  await tx.hrCandidateComment.create({
    data: {
      processCandidateId: input.processCandidateId,
      actorId: input.actorId || null,
      stage: input.stage,
      body
    }
  });
}

async function getCandidateProfileTx(
  tx: Omit<typeof prisma, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">,
  input: {
    candidateId?: string | null;
    fullName?: string | null;
    email?: string | null;
    phone?: string | null;
    linkedIn?: string | null;
    source?: string | null;
    cvDriveUrl?: string | null;
    createdById?: string | null;
    cvFileName?: string | null;
    cvMimeType?: string | null;
    cvData?: Buffer | null;
  }
) {
  if (input.candidateId) {
    const existing = await tx.hrCandidate.findUnique({ where: { id: input.candidateId } });
    if (!existing) return null;
    return tx.hrCandidate.update({
      where: { id: existing.id },
      data: {
        fullName: cleanText(input.fullName) || existing.fullName,
        email: normalizeEmail(input.email) || existing.email,
        phone: normalizePhone(input.phone) || existing.phone,
        linkedIn: cleanText(input.linkedIn) || existing.linkedIn,
        source: cleanText(input.source) || existing.source,
        cvDriveUrl: cleanText(input.cvDriveUrl) || existing.cvDriveUrl,
        latestCvFileName: input.cvFileName || existing.latestCvFileName,
        latestCvMimeType: input.cvMimeType || existing.latestCvMimeType,
        latestCvData: input.cvData || existing.latestCvData
      }
    });
  }

  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);
  const fullName = cleanText(input.fullName);
  if (!fullName) return null;

  const existing = await tx.hrCandidate.findFirst({
    where: {
      OR: [
        ...(email ? [{ email }] : []),
        ...(phone ? [{ phone }] : []),
        { fullName: { equals: fullName, mode: "insensitive" } }
      ]
    }
  });

  if (existing) {
    return tx.hrCandidate.update({
      where: { id: existing.id },
      data: {
        fullName,
        email: email || existing.email,
        phone: phone || existing.phone,
        linkedIn: cleanText(input.linkedIn) || existing.linkedIn,
        source: cleanText(input.source) || existing.source,
        cvDriveUrl: cleanText(input.cvDriveUrl) || existing.cvDriveUrl,
        latestCvFileName: input.cvFileName || existing.latestCvFileName,
        latestCvMimeType: input.cvMimeType || existing.latestCvMimeType,
        latestCvData: input.cvData || existing.latestCvData
      }
    });
  }

  return tx.hrCandidate.create({
    data: {
      fullName,
      email: email || null,
      phone: phone || null,
      linkedIn: cleanText(input.linkedIn) || null,
      source: cleanText(input.source) || null,
      cvDriveUrl: cleanText(input.cvDriveUrl) || null,
      createdById: input.createdById || null,
      latestCvFileName: input.cvFileName || null,
      latestCvMimeType: input.cvMimeType || null,
      latestCvData: input.cvData || null
    }
  });
}

export function hasHrSystemAccess(actor: Pick<HrActor, "role" | "hrAddon">) {
  return hasActorHrAddon(actor);
}

export function hasManagementPanelAccess(actor: Pick<HrActor, "role">) {
  return actorHasManagementPanelAccess(actor);
}

export async function getHrDashboard(actor: HrActor, rawFilters: ProcessFilterInput = {}) {
  if (!hasActorHrAddon(actor)) return { ok: false as const, error: "NO_ACCESS" };

  const query = cleanText(rawFilters.query);
  const status = cleanText(rawFilters.status).toUpperCase();
  const teamId = cleanText(rawFilters.teamId) || null;
  const managerId = cleanText(rawFilters.managerId) || null;

  const where: any = {};
  if (teamId) where.teamId = teamId;
  if (managerId) where.managerId = managerId;
  if (status && status !== "ALL") where.status = status;
  if (query) {
    where.OR = [
      { positionTitle: { contains: query, mode: "insensitive" } },
      { reason: { contains: query, mode: "insensitive" } },
      { note: { contains: query, mode: "insensitive" } },
      { team: { is: { name: { contains: query, mode: "insensitive" } } } }
    ];
  }

  const [teams, processes, candidates, notifications, users] = await Promise.all([
    prisma.team.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.hrProcess.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
      select: {
        id: true,
        positionTitle: true,
        requestedHeadcount: true,
        priority: true,
        reason: true,
        note: true,
        status: true,
        adChannel: true,
        adPublishedAt: true,
        openedAt: true,
        closedAt: true,
        cancelledAt: true,
        team: { select: { id: true, name: true } },
        openedBy: { select: { id: true, name: true, email: true } },
        manager: { select: { id: true, name: true, email: true } },
        finalApprover: { select: { id: true, name: true, email: true } },
        candidates: {
          orderBy: [{ updatedAt: "desc" }],
          select: {
            id: true,
            status: true,
            appliedAt: true,
            interviewScheduledAt: true,
            secondRoundCompletedAt: true,
            finalDecisionAt: true,
            candidate: { select: { id: true, fullName: true, email: true, phone: true, source: true } }
          }
        }
      }
    }),
    prisma.hrCandidate.findMany({
      where: query
        ? {
            OR: [
              { fullName: { contains: query, mode: "insensitive" } },
              { email: { contains: query, mode: "insensitive" } },
              { phone: { contains: query, mode: "insensitive" } }
            ]
          }
        : undefined,
      orderBy: [{ updatedAt: "desc" }],
      take: 24,
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        source: true,
        cvDriveUrl: true,
        talentPoolTag: true,
        lastContactAt: true,
        latestCvFileName: true,
        updatedAt: true,
        applications: {
          orderBy: [{ updatedAt: "desc" }],
          take: 6,
          select: {
            id: true,
            status: true,
            updatedAt: true,
            process: { select: { id: true, positionTitle: true, status: true, team: { select: { name: true } } } }
          }
        }
      }
    }),
    prisma.hrNotification.findMany({
      where: { userId: actor.id },
      orderBy: [{ createdAt: "desc" }],
      take: 12,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        href: true,
        isRead: true,
        createdAt: true
      }
    }),
    prisma.user.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ name: "asc" }],
      select: { id: true, name: true, email: true, teamId: true, role: true, managerId: true, hrAddon: true }
    })
  ]);

  const metrics = {
    totalProcesses: processes.length,
    openProcesses: processes.filter((process) => OPEN_PROCESS_STATUSES.includes(process.status)).length,
    approvedProcesses: processes.filter((process) => process.status === "APPROVED").length,
    cancelledProcesses: processes.filter((process) => process.status === "CANCELED").length,
    totalCandidates: processes.reduce((sum, process) => sum + process.candidates.length, 0),
    approvedCandidates: processes.reduce(
      (sum, process) =>
        sum + process.candidates.filter((candidate) => candidate.status === "APPROVED_FOR_EMPLOYMENT").length,
      0
    )
  };

  return { ok: true as const, filters: { teamId, status: status || "ALL", managerId, query }, teams, users, metrics, processes, candidates, notifications };
}

export async function getHrProcessDetail(actor: HrActor, processId: string) {
  const id = cleanText(processId);
  if (!id) return { ok: false as const, error: "PROCESS_NOT_FOUND" };

  const process = await prisma.hrProcess.findUnique({
    where: { id },
    select: {
      id: true,
      positionTitle: true,
      requestedHeadcount: true,
      priority: true,
      reason: true,
      note: true,
      status: true,
      requestType: true,
      adChannel: true,
      adPublishedAt: true,
      openedAt: true,
      closedAt: true,
      cancelledAt: true,
      desiredStartDate: true,
      superiorComment: true,
      superiorDecidedAt: true,
      team: { select: { id: true, name: true } },
      openedBy: { select: { id: true, name: true, email: true } },
      manager: { select: { id: true, name: true, email: true } },
      finalApprover: { select: { id: true, name: true, email: true } },
      candidates: {
        orderBy: [{ updatedAt: "desc" }],
        select: {
          id: true,
          status: true,
          source: true,
          appliedAt: true,
          initialContactAt: true,
          hrComment: true,
          firstRoundComment: true,
          screeningResult: true,
          managerComment: true,
          finalComment: true,
          interviewScheduledAt: true,
          secondRoundCompletedAt: true,
          finalDecisionAt: true,
          archivedAt: true,
          cancelledAt: true,
          closedReason: true,
          managerProposedSlots: true,
          candidate: {
            select: {
              id: true,
              fullName: true,
              email: true,
              phone: true,
              linkedIn: true,
              source: true,
              cvDriveUrl: true,
              talentPoolTag: true,
              lastContactAt: true,
              latestCvFileName: true,
              latestCvMimeType: true
            }
          },
          comments: {
            orderBy: [{ createdAt: "desc" }],
            select: {
              id: true,
              stage: true,
              body: true,
              createdAt: true,
              actor: { select: { id: true, name: true, email: true } }
            }
          }
        }
      },
      auditLogs: {
        orderBy: [{ createdAt: "desc" }],
        take: 40,
        select: {
          id: true,
          action: true,
          field: true,
          oldValue: true,
          newValue: true,
          comment: true,
          createdAt: true,
          actor: { select: { id: true, name: true, email: true } }
        }
      }
    }
  });
  if (!process) return { ok: false as const, error: "PROCESS_NOT_FOUND" };

  const orgUsers = await loadOrgUsers();
  const { managerOf } = buildOrgIndex(orgUsers);
  const canView =
    hasActorHrAddon(actor) ||
    actor.id === process.manager?.id ||
    actor.id === process.finalApprover?.id ||
    actor.id === process.openedBy.id ||
    isVisibleThroughManagerChain(actor.id, process.manager?.id, managerOf);
  if (!canView) return { ok: false as const, error: "NO_ACCESS" };

  const allCandidates = await prisma.hrCandidate.findMany({
    orderBy: [{ updatedAt: "desc" }],
    take: 80,
    select: { id: true, fullName: true, email: true, phone: true, latestCvFileName: true, cvDriveUrl: true, source: true }
  });

  return {
    ok: true as const,
    process,
    existingCandidates: allCandidates,
    permissions: {
      canHrManage: hasActorHrAddon(actor),
      canApproveRequest: actor.id === process.finalApprover?.id && process.status === "DRAFT",
      canManagerReview: actor.id === process.manager?.id,
      canFinalApprove: actor.id === process.finalApprover?.id
    }
  };
}

export async function createHrProcess(params: {
  actor: HrActor;
  teamId?: string | null;
  positionTitle: string;
  requestType?: string | null;
  requestedHeadcount?: number;
  priority?: HrPriority;
  reason: string;
  note?: string | null;
  desiredStartDate?: Date | string | null;
}) {
  if (!isManagerRole(params.actor.role)) return { ok: false as const, error: "NO_ACCESS" };

  const positionTitle = cleanText(params.positionTitle);
  const reason = cleanText(params.reason);
  const note = cleanText(params.note);
  const requestType = cleanText(params.requestType);
  const requestedHeadcount = Math.max(1, Math.floor(Number(params.requestedHeadcount || 1)));
  const desiredStartDate = toDateOrNull(params.desiredStartDate);
  if (!positionTitle) return { ok: false as const, error: "POSITION_REQUIRED" };
  if (!reason) return { ok: false as const, error: "REASON_REQUIRED" };

  const orgUsers = await loadOrgUsers();
  const { managerOf } = buildOrgIndex(orgUsers);
  const selectedManagerId = params.actor.id;
  const finalApproverId = pickFinalApprover(params.actor.id, managerOf) || params.actor.managerId || null;
  if (!finalApproverId) return { ok: false as const, error: "SUPERIOR_REQUIRED" };
  const resolvedTeamId = cleanText(params.teamId) || params.actor.teamId || null;

  const created = await prisma.$transaction(async (tx) => {
    const process = await tx.hrProcess.create({
      data: {
        teamId: resolvedTeamId,
        positionTitle,
        requestType: requestType || null,
        requestedHeadcount,
        priority: params.priority || "MED",
        reason,
        note: note || null,
        status: "DRAFT",
        openedById: params.actor.id,
        managerId: selectedManagerId,
        finalApproverId,
        desiredStartDate
      },
      select: { id: true }
    });

    await logAuditTx(tx, {
      actorId: params.actor.id,
      processId: process.id,
      action: "PROCESS_CREATED",
      field: "status",
      newValue: "DRAFT",
      comment: `${positionTitle} · ${reason}`
    });

    await createNotificationsTx(tx, {
      userIds: [finalApproverId],
      type: "HIRING_REQUEST_APPROVAL",
      title: `Hiring request waiting approval: ${positionTitle}`,
      body: reason,
      href: `/management`,
      processId: process.id
    });

    return process;
  });

  logInfo("hr.process.created", {
    actorId: params.actor.id,
    processId: created.id,
    teamId: resolvedTeamId,
    managerId: selectedManagerId,
    finalApproverId,
    requestType: requestType || null
  });

  return { ok: true as const, processId: created.id };
}

export async function updateHrProcessMeta(params: {
  actor: HrActor;
  processId: string;
  status?: HrProcessStatus | null;
  adChannel?: string | null;
  adPublishedAt?: Date | string | null;
  note?: string | null;
}) {
  if (!hasActorHrAddon(params.actor)) return { ok: false as const, error: "NO_ACCESS" };
  const processId = cleanText(params.processId);
  if (!processId) return { ok: false as const, error: "PROCESS_NOT_FOUND" };
  const process = await prisma.hrProcess.findUnique({ where: { id: processId }, select: { id: true, status: true } });
  if (!process) return { ok: false as const, error: "PROCESS_NOT_FOUND" };

  const nextStatus = params.status || process.status;
  const adPublishedAt = toDateOrNull(params.adPublishedAt);
  const note = cleanText(params.note);
  const adChannel = cleanText(params.adChannel);

  await prisma.$transaction(async (tx) => {
    await tx.hrProcess.update({
      where: { id: processId },
      data: {
        status: nextStatus,
        adChannel: adChannel || null,
        adPublishedAt,
        note: note || null
      }
    });
    await logAuditTx(tx, {
      actorId: params.actor.id,
      processId,
      action: "PROCESS_UPDATED",
      field: "status",
      oldValue: process.status,
      newValue: nextStatus,
      comment: [adChannel ? `channel=${adChannel}` : "", note].filter(Boolean).join(" · ")
    });
  });

  logInfo("hr.process.updated", {
    actorId: params.actor.id,
    processId,
    status: nextStatus,
    adChannel: adChannel || null,
    adPublishedAt: adPublishedAt?.toISOString() || null
  });

  return { ok: true as const };
}

export async function reviewHiringRequest(params: {
  actor: HrActor;
  processId: string;
  decision: "APPROVE" | "REJECT";
  comment?: string | null;
}) {
  const processId = cleanText(params.processId);
  const comment = cleanText(params.comment);
  if (!processId) return { ok: false as const, error: "PROCESS_NOT_FOUND" };
  if (!comment) return { ok: false as const, error: "COMMENT_REQUIRED" };

  const process = await prisma.hrProcess.findUnique({
    where: { id: processId },
    select: {
      id: true,
      status: true,
      positionTitle: true,
      openedById: true,
      managerId: true,
      finalApproverId: true
    }
  });
  if (!process) return { ok: false as const, error: "PROCESS_NOT_FOUND" };
  if (process.finalApproverId !== params.actor.id) return { ok: false as const, error: "NO_ACCESS" };
  if (process.status !== "DRAFT") return { ok: false as const, error: "INVALID_STATUS" };

  const hrOwners = await prisma.user.findMany({
    where: { status: "ACTIVE", OR: [{ hrAddon: true }, { role: "HR" }] },
    select: { id: true }
  });

  const nextStatus: HrProcessStatus = params.decision === "APPROVE" ? "OPEN" : "ON_HOLD";

  await prisma.$transaction(async (tx) => {
    await tx.hrProcess.update({
      where: { id: processId },
      data: {
        status: nextStatus,
        superiorComment: comment,
        superiorDecidedAt: new Date()
      }
    });
    await logAuditTx(tx, {
      actorId: params.actor.id,
      processId,
      action: "HIRING_REQUEST_REVIEWED",
      field: "status",
      oldValue: process.status,
      newValue: nextStatus,
      comment
    });

    await createNotificationsTx(tx, {
      userIds: [process.openedById],
      type: params.decision === "APPROVE" ? "HIRING_REQUEST_APPROVED" : "HIRING_REQUEST_REJECTED",
      title:
        params.decision === "APPROVE"
          ? `Hiring request approved: ${process.positionTitle}`
          : `Hiring request rejected: ${process.positionTitle}`,
      body: comment,
      href: `/hr/${processId}`,
      processId
    });

    if (params.decision === "APPROVE") {
      await createNotificationsTx(tx, {
        userIds: hrOwners.map((row) => row.id),
        type: "HIRING_REQUEST_READY_FOR_HR",
        title: `Approved for HR: ${process.positionTitle}`,
        body: comment,
        href: `/hr/${processId}`,
        processId
      });
    }
  });

  return { ok: true as const };
}

export async function addCandidateToHrProcess(params: {
  actor: HrActor;
  processId: string;
  candidateId?: string | null;
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  linkedIn?: string | null;
  source?: string | null;
  appliedAt?: Date | string | null;
  hrComment?: string | null;
  firstRoundComment?: string | null;
  screeningResult?: string | null;
  cvDriveUrl?: string | null;
  cvFileName?: string | null;
  cvMimeType?: string | null;
  cvData?: Buffer | null;
}) {
  if (!hasActorHrAddon(params.actor)) return { ok: false as const, error: "NO_ACCESS" };
  const processId = cleanText(params.processId);
  if (!processId) return { ok: false as const, error: "PROCESS_NOT_FOUND" };

  const process = await prisma.hrProcess.findUnique({
    where: { id: processId },
    select: { id: true, status: true, positionTitle: true }
  });
  if (!process) return { ok: false as const, error: "PROCESS_NOT_FOUND" };
  if (process.status === "DRAFT" || process.status === "ON_HOLD" || process.status === "CANCELED" || process.status === "CLOSED" || process.status === "APPROVED") {
    return { ok: false as const, error: "PROCESS_LOCKED" };
  }

  const created = await prisma.$transaction(async (tx) => {
    const candidate = await getCandidateProfileTx(tx, {
      candidateId: params.candidateId,
      fullName: params.fullName,
      email: params.email,
      phone: params.phone,
      linkedIn: params.linkedIn,
      source: params.source,
      createdById: params.actor.id,
      cvDriveUrl: params.cvDriveUrl,
      cvFileName: params.cvFileName,
      cvMimeType: params.cvMimeType,
      cvData: params.cvData
    });
    if (!candidate) throw new Error("CANDIDATE_REQUIRED");

    const existing = await tx.hrProcessCandidate.findUnique({
      where: { processId_candidateId: { processId, candidateId: candidate.id } },
      select: { id: true }
    });
    if (existing) throw new Error("CANDIDATE_EXISTS");

    const application = await tx.hrProcessCandidate.create({
      data: {
        processId,
        candidateId: candidate.id,
        createdById: params.actor.id,
        status: "HR_SCREENING",
        source: cleanText(params.source) || candidate.source || null,
        appliedAt: toDateOrNull(params.appliedAt) || new Date(),
        hrComment: cleanText(params.hrComment) || null,
        firstRoundComment: cleanText(params.firstRoundComment) || null,
        screeningResult: cleanText(params.screeningResult) || null,
        initialContactAt: new Date()
      },
      select: { id: true }
    });

    await addCommentTx(tx, {
      processCandidateId: application.id,
      actorId: params.actor.id,
      stage: "HR_SCREENING",
      body: cleanText(params.firstRoundComment) || cleanText(params.hrComment)
    });
    await logAuditTx(tx, {
      actorId: params.actor.id,
      processId,
      processCandidateId: application.id,
      candidateId: candidate.id,
      action: "CANDIDATE_ADDED",
      field: "status",
      newValue: "HR_SCREENING",
      comment: candidate.fullName
    });
    await tx.hrProcess.update({
      where: { id: processId },
      data: {
        status: process.status === "OPEN" ? "IN_PROGRESS" : process.status
      }
    });

    return { applicationId: application.id, candidateId: candidate.id };
  }).catch((error) => {
    if (String((error as Error)?.message || "") === "CANDIDATE_REQUIRED") return null;
    if (String((error as Error)?.message || "") === "CANDIDATE_EXISTS") return "EXISTS";
    throw error;
  });

  if (created === null) return { ok: false as const, error: "CANDIDATE_REQUIRED" };
  if (created === "EXISTS") return { ok: false as const, error: "CANDIDATE_EXISTS" };

  logInfo("hr.candidate.added", {
    actorId: params.actor.id,
    processId,
    applicationId: created.applicationId,
    candidateId: created.candidateId
  });

  return { ok: true as const, ...created };
}

export async function hrScreenCandidate(params: {
  actor: HrActor;
  applicationId: string;
  decision: "REJECT" | "SEND_TO_MANAGER";
  hrComment?: string | null;
  firstRoundComment?: string | null;
  screeningResult?: string | null;
}) {
  if (!hasActorHrAddon(params.actor)) return { ok: false as const, error: "NO_ACCESS" };
  const applicationId = cleanText(params.applicationId);
  if (!applicationId) return { ok: false as const, error: "APPLICATION_NOT_FOUND" };

  const application = await prisma.hrProcessCandidate.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      status: true,
      processId: true,
      candidate: { select: { fullName: true } },
      process: { select: { managerId: true, positionTitle: true, openedById: true } }
    }
  });
  if (!application) return { ok: false as const, error: "APPLICATION_NOT_FOUND" };

  const nextStatus: HrCandidateStatus = params.decision === "REJECT" ? "REJECTED_BY_HR" : "WAITING_MANAGER_REVIEW";
  await prisma.$transaction(async (tx) => {
    await tx.hrProcessCandidate.update({
      where: { id: applicationId },
      data: {
        status: nextStatus,
        hrComment: cleanText(params.hrComment) || null,
        firstRoundComment: cleanText(params.firstRoundComment) || null,
        screeningResult: cleanText(params.screeningResult) || null,
        archivedAt: params.decision === "REJECT" ? new Date() : null,
        closedReason: params.decision === "REJECT" ? cleanText(params.screeningResult) || cleanText(params.hrComment) || null : null
      }
    });
    await addCommentTx(tx, {
      processCandidateId: applicationId,
      actorId: params.actor.id,
      stage: "HR_SCREENING",
      body: cleanText(params.firstRoundComment) || cleanText(params.hrComment) || cleanText(params.screeningResult)
    });
    await logAuditTx(tx, {
      actorId: params.actor.id,
      processId: application.processId,
      processCandidateId: applicationId,
      action: "HR_SCREEN_DECISION",
      field: "status",
      oldValue: application.status,
      newValue: nextStatus,
      comment: application.candidate.fullName
    });

    if (params.decision === "SEND_TO_MANAGER" && application.process.managerId) {
      await createNotificationsTx(tx, {
        userIds: [application.process.managerId],
        type: "HR_CANDIDATE_REVIEW",
        title: `Candidate waiting review: ${application.candidate.fullName}`,
        body: application.process.positionTitle,
        href: `/hr/${application.processId}`,
        processId: application.processId,
        processCandidateId: applicationId
      });
    }
  });

  logInfo("hr.screening.saved", {
    actorId: params.actor.id,
    processId: application.processId,
    applicationId,
    decision: params.decision,
    nextStatus
  });

  return { ok: true as const };
}

export async function managerReviewHrCandidate(params: {
  actor: HrActor;
  applicationId: string;
  decision: "REJECT" | "ADVANCE";
  managerComment?: string | null;
  proposedSlots?: string[];
}) {
  const applicationId = cleanText(params.applicationId);
  if (!applicationId) return { ok: false as const, error: "APPLICATION_NOT_FOUND" };

  const application = await prisma.hrProcessCandidate.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      status: true,
      processId: true,
      candidate: { select: { fullName: true } },
      process: {
        select: {
          id: true,
          positionTitle: true,
          managerId: true,
          openedById: true
        }
      }
    }
  });
  if (!application) return { ok: false as const, error: "APPLICATION_NOT_FOUND" };
  if (params.actor.id !== application.process.managerId) {
    return { ok: false as const, error: "NO_ACCESS" };
  }

  const managerComment = cleanText(params.managerComment);
  const proposedSlots = dedupe((params.proposedSlots || []).map((slot) => cleanText(slot)).filter(Boolean));
  const nextStatus: HrCandidateStatus = params.decision === "REJECT" ? "REJECTED_BY_MANAGER" : "SENT_TO_MANAGER";
  if (params.decision === "ADVANCE" && proposedSlots.length === 0) return { ok: false as const, error: "SLOTS_REQUIRED" };

  await prisma.$transaction(async (tx) => {
    const updateData: Prisma.HrProcessCandidateUpdateInput = {
      status: nextStatus,
      managerComment: managerComment || null,
      managerProposedSlots: proposedSlots.length ? (proposedSlots as Prisma.InputJsonValue) : Prisma.DbNull,
      closedReason: params.decision === "REJECT" ? managerComment || null : null,
      archivedAt: params.decision === "REJECT" ? new Date() : null
    };

    await tx.hrProcessCandidate.update({
      where: { id: applicationId },
      data: updateData
    });
    await addCommentTx(tx, {
      processCandidateId: applicationId,
      actorId: params.actor.id,
      stage: "MANAGER_REVIEW",
      body: managerComment
    });
    await logAuditTx(tx, {
      actorId: params.actor.id,
      processId: application.processId,
      processCandidateId: applicationId,
      action: "MANAGER_REVIEW",
      field: "status",
      oldValue: application.status,
      newValue: nextStatus,
      comment: managerComment
    });
    await createNotificationsTx(tx, {
      userIds: [application.process.openedById],
      type: params.decision === "REJECT" ? "HR_CANDIDATE_RETURNED" : "HR_INTERVIEW_SLOTS_READY",
      title:
        params.decision === "REJECT"
          ? `Candidate rejected by manager: ${application.candidate.fullName}`
          : `Interview slots proposed: ${application.candidate.fullName}`,
      body: managerComment || application.process.positionTitle,
      href: `/hr/${application.processId}`,
      processId: application.processId,
      processCandidateId: applicationId
    });
  });

  logInfo("hr.manager.review.saved", {
    actorId: params.actor.id,
    processId: application.processId,
    applicationId,
    decision: params.decision,
    nextStatus,
    proposedSlots: proposedSlots.length
  });

  return { ok: true as const };
}

export async function scheduleHrInterview(params: {
  actor: HrActor;
  applicationId: string;
  interviewAt: Date | string;
  hrComment?: string | null;
}) {
  if (!hasActorHrAddon(params.actor)) return { ok: false as const, error: "NO_ACCESS" };
  const applicationId = cleanText(params.applicationId);
  const interviewAt = toDateOrNull(params.interviewAt);
  if (!applicationId) return { ok: false as const, error: "APPLICATION_NOT_FOUND" };
  if (!interviewAt) return { ok: false as const, error: "INTERVIEW_DATE_REQUIRED" };

  const application = await prisma.hrProcessCandidate.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      status: true,
      processId: true,
      candidate: { select: { fullName: true } },
      process: { select: { managerId: true, positionTitle: true } }
    }
  });
  if (!application) return { ok: false as const, error: "APPLICATION_NOT_FOUND" };

  await prisma.$transaction(async (tx) => {
    await tx.hrProcessCandidate.update({
      where: { id: applicationId },
      data: {
        status: "INTERVIEW_SCHEDULED",
        interviewScheduledAt: interviewAt,
        hrComment: cleanText(params.hrComment) || null
      }
    });
    await addCommentTx(tx, {
      processCandidateId: applicationId,
      actorId: params.actor.id,
      stage: "INTERVIEW_SCHEDULED",
      body: cleanText(params.hrComment)
    });
    await logAuditTx(tx, {
      actorId: params.actor.id,
      processId: application.processId,
      processCandidateId: applicationId,
      action: "INTERVIEW_SCHEDULED",
      field: "status",
      oldValue: application.status,
      newValue: "INTERVIEW_SCHEDULED",
      comment: interviewAt.toISOString()
    });
    if (application.process.managerId) {
      await createNotificationsTx(tx, {
        userIds: [application.process.managerId],
        type: "HR_INTERVIEW_SCHEDULED",
        title: `Interview scheduled: ${application.candidate.fullName}`,
        body: interviewAt.toLocaleString(),
        href: `/hr/${application.processId}`,
        processId: application.processId,
        processCandidateId: applicationId
      });
    }
  });

  logInfo("hr.interview.scheduled", {
    actorId: params.actor.id,
    processId: application.processId,
    applicationId,
    interviewAt: interviewAt.toISOString()
  });

  return { ok: true as const };
}

export async function secondRoundHrDecision(params: {
  actor: HrActor;
  applicationId: string;
  decision: "REJECT" | "FINAL_APPROVAL";
  managerComment?: string | null;
}) {
  const applicationId = cleanText(params.applicationId);
  if (!applicationId) return { ok: false as const, error: "APPLICATION_NOT_FOUND" };

  const application = await prisma.hrProcessCandidate.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      status: true,
      processId: true,
      candidate: { select: { fullName: true } },
      process: {
        select: { id: true, managerId: true, finalApproverId: true, openedById: true, positionTitle: true }
      }
    }
  });
  if (!application) return { ok: false as const, error: "APPLICATION_NOT_FOUND" };
  if (params.actor.id !== application.process.managerId) {
    return { ok: false as const, error: "NO_ACCESS" };
  }

  const nextStatus: HrCandidateStatus = params.decision === "REJECT" ? "REJECTED_BY_MANAGER" : "WAITING_FINAL_APPROVAL";
  const managerComment = cleanText(params.managerComment);

  await prisma.$transaction(async (tx) => {
    await tx.hrProcessCandidate.update({
      where: { id: applicationId },
      data: {
        status: nextStatus,
        managerComment: managerComment || null,
        secondRoundCompletedAt: new Date(),
        finalDecisionAt: params.decision === "REJECT" ? new Date() : null,
        closedReason: params.decision === "REJECT" ? managerComment || null : null,
        archivedAt: params.decision === "REJECT" ? new Date() : null
      }
    });
    await addCommentTx(tx, {
      processCandidateId: applicationId,
      actorId: params.actor.id,
      stage: "SECOND_ROUND",
      body: managerComment
    });
    await logAuditTx(tx, {
      actorId: params.actor.id,
      processId: application.processId,
      processCandidateId: applicationId,
      action: "SECOND_ROUND_DECISION",
      field: "status",
      oldValue: application.status,
      newValue: nextStatus,
      comment: managerComment
    });
    if (params.decision === "FINAL_APPROVAL" && application.process.finalApproverId) {
      await createNotificationsTx(tx, {
        userIds: [application.process.finalApproverId],
        type: "HR_FINAL_APPROVAL_REQUEST",
        title: `Final approval needed: ${application.candidate.fullName}`,
        body: application.process.positionTitle,
        href: `/hr/${application.processId}`,
        processId: application.processId,
        processCandidateId: applicationId
      });
    } else {
      await createNotificationsTx(tx, {
        userIds: [application.process.openedById],
        type: "HR_CANDIDATE_RETURNED",
        title: `Candidate rejected after interview: ${application.candidate.fullName}`,
        body: managerComment || application.process.positionTitle,
        href: `/hr/${application.processId}`,
        processId: application.processId,
        processCandidateId: applicationId
      });
    }
  });

  logInfo("hr.second-round.saved", {
    actorId: params.actor.id,
    processId: application.processId,
    applicationId,
    decision: params.decision,
    nextStatus
  });

  return { ok: true as const };
}

export async function finalApproveHrCandidate(params: {
  actor: HrActor;
  applicationId: string;
  decision: "APPROVE" | "REJECT";
  finalComment?: string | null;
}) {
  const applicationId = cleanText(params.applicationId);
  if (!applicationId) return { ok: false as const, error: "APPLICATION_NOT_FOUND" };

  const application = await prisma.hrProcessCandidate.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      status: true,
      processId: true,
      candidate: { select: { id: true, fullName: true } },
      process: {
        select: {
          id: true,
          status: true,
          teamId: true,
          requestedHeadcount: true,
          finalApproverId: true,
          openedById: true,
          managerId: true,
          positionTitle: true
        }
      }
    }
  });
  if (!application) return { ok: false as const, error: "APPLICATION_NOT_FOUND" };
  if (params.actor.id !== application.process.finalApproverId) {
    return { ok: false as const, error: "NO_ACCESS" };
  }

  const finalComment = cleanText(params.finalComment);
  const nextStatus: HrCandidateStatus = params.decision === "APPROVE" ? "APPROVED_FOR_EMPLOYMENT" : "REJECTED_FINAL";

  await prisma.$transaction(async (tx) => {
    await tx.hrProcessCandidate.update({
      where: { id: applicationId },
      data: {
        status: nextStatus,
        finalComment: finalComment || null,
        finalDecisionAt: new Date(),
        archivedAt: params.decision === "REJECT" ? new Date() : null,
        closedReason: params.decision === "REJECT" ? finalComment || null : null
      }
    });

    if (params.decision === "APPROVE") {
      const approvedCount = await tx.hrProcessCandidate.count({
        where: {
          processId: application.processId,
          status: "APPROVED_FOR_EMPLOYMENT"
        }
      });
      if (approvedCount + 1 >= application.process.requestedHeadcount) {
        await tx.hrProcess.update({
          where: { id: application.processId },
          data: {
            status: "APPROVED",
            closedAt: new Date()
          }
        });
      }
    }

    await addCommentTx(tx, {
      processCandidateId: applicationId,
      actorId: params.actor.id,
      stage: "FINAL_APPROVAL",
      body: finalComment
    });
    await logAuditTx(tx, {
      actorId: params.actor.id,
      processId: application.processId,
      processCandidateId: applicationId,
      candidateId: application.candidate.id,
      action: "FINAL_APPROVAL_DECISION",
      field: "status",
      oldValue: application.status,
      newValue: nextStatus,
      comment: finalComment
    });
    await createNotificationsTx(tx, {
      userIds: [application.process.openedById, application.process.managerId].filter(Boolean) as string[],
      type: "HR_FINAL_DECISION",
      title:
        params.decision === "APPROVE"
          ? `Candidate approved: ${application.candidate.fullName}`
          : `Candidate rejected in final approval: ${application.candidate.fullName}`,
      body: finalComment || application.process.positionTitle,
      href: `/hr/${application.processId}`,
      processId: application.processId,
      processCandidateId: applicationId
    });
  });

  if (params.decision === "APPROVE") {
    const hrOwner = await prisma.user.findFirst({
      where: { status: "ACTIVE", OR: [{ hrAddon: true }, { role: "HR" }] },
      orderBy: [{ updatedAt: "desc" }],
      select: { id: true }
    });

    await ensureOnboardingForApprovedCandidate({
      processId: application.processId,
      candidateId: application.candidate.id,
      managerId: application.process.managerId || null,
      teamId: application.process.teamId || null,
      hrOwnerId: hrOwner?.id || null
    });
  }

  logInfo("hr.final-approval.saved", {
    actorId: params.actor.id,
    processId: application.processId,
    applicationId,
    decision: params.decision,
    nextStatus
  });

  return { ok: true as const };
}

export async function archiveHrCandidate(params: {
  actor: HrActor;
  applicationId: string;
  status: "ARCHIVED" | "CANCELED";
  reason?: string | null;
}) {
  if (!hasActorHrAddon(params.actor)) return { ok: false as const, error: "NO_ACCESS" };
  const applicationId = cleanText(params.applicationId);
  if (!applicationId) return { ok: false as const, error: "APPLICATION_NOT_FOUND" };
  const reason = cleanText(params.reason);
  if (!reason) return { ok: false as const, error: "REASON_REQUIRED" };

  const application = await prisma.hrProcessCandidate.findUnique({
    where: { id: applicationId },
    select: { id: true, status: true, processId: true, candidateId: true }
  });
  if (!application) return { ok: false as const, error: "APPLICATION_NOT_FOUND" };

  await prisma.$transaction(async (tx) => {
    await tx.hrProcessCandidate.update({
      where: { id: applicationId },
      data: {
        status: params.status,
        archivedAt: params.status === "ARCHIVED" ? new Date() : null,
        cancelledAt: params.status === "CANCELED" ? new Date() : null,
        closedReason: reason
      }
    });
    await logAuditTx(tx, {
      actorId: params.actor.id,
      processId: application.processId,
      processCandidateId: applicationId,
      candidateId: application.candidateId,
      action: params.status === "ARCHIVED" ? "APPLICATION_ARCHIVED" : "APPLICATION_CANCELED",
      field: "status",
      oldValue: application.status,
      newValue: params.status,
      comment: reason
    });
  });

  logInfo("hr.candidate.archived", {
    actorId: params.actor.id,
    processId: application.processId,
    applicationId,
    status: params.status
  });

  return { ok: true as const };
}

export async function cancelHrProcess(params: {
  actor: HrActor;
  processId: string;
  reason?: string | null;
}) {
  if (!hasActorHrAddon(params.actor)) return { ok: false as const, error: "NO_ACCESS" };
  const processId = cleanText(params.processId);
  const reason = cleanText(params.reason);
  if (!processId) return { ok: false as const, error: "PROCESS_NOT_FOUND" };
  if (!reason) return { ok: false as const, error: "REASON_REQUIRED" };

  const process = await prisma.hrProcess.findUnique({
    where: { id: processId },
    select: { id: true, status: true, managerId: true, finalApproverId: true, openedById: true }
  });
  if (!process) return { ok: false as const, error: "PROCESS_NOT_FOUND" };

  await prisma.$transaction(async (tx) => {
    await tx.hrProcess.update({
      where: { id: processId },
      data: {
        status: "CANCELED",
        cancelledAt: new Date()
      }
    });
    await tx.hrProcessCandidate.updateMany({
      where: { processId, status: { in: ACTIVE_CANDIDATE_STATUSES } },
      data: {
        status: "CANCELED",
        cancelledAt: new Date(),
        closedReason: reason
      }
    });
    await logAuditTx(tx, {
      actorId: params.actor.id,
      processId,
      action: "PROCESS_CANCELED",
      field: "status",
      oldValue: process.status,
      newValue: "CANCELED",
      comment: reason
    });
    await createNotificationsTx(tx, {
      userIds: [process.openedById, process.managerId, process.finalApproverId].filter(Boolean) as string[],
      type: "HR_PROCESS_CANCELED",
      title: "Hiring process canceled",
      body: reason,
      href: `/hr/${processId}`,
      processId
    });
  });

  logInfo("hr.process.canceled", {
    actorId: params.actor.id,
    processId
  });

  return { ok: true as const };
}

export async function closeHrProcess(params: {
  actor: HrActor;
  processId: string;
  note?: string | null;
}) {
  if (!hasActorHrAddon(params.actor)) return { ok: false as const, error: "NO_ACCESS" };
  const processId = cleanText(params.processId);
  if (!processId) return { ok: false as const, error: "PROCESS_NOT_FOUND" };

  const process = await prisma.hrProcess.findUnique({ where: { id: processId }, select: { id: true, status: true } });
  if (!process) return { ok: false as const, error: "PROCESS_NOT_FOUND" };

  await prisma.$transaction(async (tx) => {
    await tx.hrProcess.update({
      where: { id: processId },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
        note: cleanText(params.note) || null
      }
    });
    await logAuditTx(tx, {
      actorId: params.actor.id,
      processId,
      action: "PROCESS_CLOSED",
      field: "status",
      oldValue: process.status,
      newValue: "CLOSED",
      comment: cleanText(params.note)
    });
  });

  logInfo("hr.process.closed", {
    actorId: params.actor.id,
    processId
  });

  return { ok: true as const };
}

export async function markHrNotificationRead(actor: HrActor, notificationId: string) {
  const id = cleanText(notificationId);
  if (!id) return { ok: false as const, error: "NOTIFICATION_NOT_FOUND" };
  const notification = await prisma.hrNotification.findUnique({
    where: { id },
    select: { id: true, userId: true, isRead: true }
  });
  if (!notification || notification.userId !== actor.id) return { ok: false as const, error: "NO_ACCESS" };
  if (notification.isRead) return { ok: true as const };
  await prisma.hrNotification.update({
    where: { id },
    data: {
      isRead: true,
      readAt: new Date()
    }
  });
  return { ok: true as const };
}

export async function getManagementPanel(actor: HrActor) {
  if (!hasManagementPanel(actor)) return { ok: false as const, error: "NO_ACCESS" };

  const orgUsers = await loadOrgUsers();
  const { managerOf } = buildOrgIndex(orgUsers);
  const allowedEmployees = getScopedEmployeeIds({ id: actor.id, role: actor.role }, orgUsers);
  const allowedTeams = new Set(orgUsers.filter((user) => allowedEmployees.has(user.id)).map((user) => user.teamId).filter(Boolean));

  const [pendingSuperiorApprovals, processes, pendingReview, finalApprovals, notifications, openTasks, overdueTasks, pendingEvaluations, activeAbsences, teams] =
    await Promise.all([
      prisma.hrProcess.findMany({
        where: { status: "DRAFT", finalApproverId: actor.id },
        orderBy: [{ updatedAt: "desc" }],
        select: {
          id: true,
          positionTitle: true,
          priority: true,
          reason: true,
          desiredStartDate: true,
          team: { select: { id: true, name: true } },
          openedBy: { select: { id: true, name: true, email: true } }
        }
      }),
      prisma.hrProcess.findMany({
        where: {
          status: { in: OPEN_PROCESS_STATUSES }
        },
        orderBy: [{ updatedAt: "desc" }],
        select: {
          id: true,
          positionTitle: true,
          status: true,
          priority: true,
          requestedHeadcount: true,
          team: { select: { id: true, name: true } },
          manager: { select: { id: true, name: true } },
          finalApprover: { select: { id: true, name: true } },
          candidates: { select: { id: true, status: true } }
        }
      }),
      prisma.hrProcessCandidate.findMany({
        where: { status: "WAITING_MANAGER_REVIEW" },
        orderBy: [{ updatedAt: "desc" }],
        select: {
          id: true,
          status: true,
          candidate: { select: { fullName: true, email: true } },
          process: {
            select: { id: true, positionTitle: true, managerId: true, team: { select: { name: true } } }
          }
        }
      }),
      prisma.hrProcessCandidate.findMany({
        where: { status: "WAITING_FINAL_APPROVAL" },
        orderBy: [{ updatedAt: "desc" }],
        select: {
          id: true,
          status: true,
          candidate: { select: { fullName: true, email: true } },
          process: {
            select: { id: true, positionTitle: true, finalApproverId: true, team: { select: { name: true } } }
          }
        }
      }),
      prisma.hrNotification.findMany({
        where: { userId: actor.id },
        orderBy: [{ createdAt: "desc" }],
        take: 10,
        select: { id: true, title: true, body: true, href: true, isRead: true, createdAt: true, type: true }
      }),
      prisma.task.count({
        where: {
          assigneeId: { in: [...allowedEmployees] },
          status: { in: ["OPEN", "IN_PROGRESS", "FOR_APPROVAL", "RETURNED"] }
        }
      }),
      prisma.task.count({
        where: {
          assigneeId: { in: [...allowedEmployees] },
          status: { in: ["OPEN", "IN_PROGRESS", "FOR_APPROVAL", "RETURNED"] },
          dueDate: { lt: new Date() }
        }
      }),
      prisma.performanceEvaluation.count({
        where: {
          employeeId: { in: [...allowedEmployees] },
          status: { in: ["OPEN", "SELF_SUBMITTED"] }
        }
      }),
      prisma.absence.count({
        where: {
          employeeId: { in: [...allowedEmployees] },
          status: "APPROVED",
          dateFrom: { lte: new Date() },
          dateTo: { gte: new Date() }
        }
      }),
      prisma.team.findMany({
        where: { id: { in: [...new Set([actor.teamId, ...allowedTeams].filter(Boolean) as string[])] } },
        orderBy: [{ name: "asc" }],
        select: { id: true, name: true }
      })
    ]);

  const visibleProcesses = processes.filter((process) => {
    if (process.manager?.id === actor.id || process.finalApprover?.id === actor.id) return true;
    if (process.team?.id && allowedTeams.has(process.team.id)) return true;
    return isVisibleThroughManagerChain(actor.id, process.manager?.id, managerOf);
  });

  return {
    ok: true as const,
    metrics: {
      pendingSuperiorApprovals: pendingSuperiorApprovals.length,
      openPositions: visibleProcesses.length,
      pendingManagerReviews: pendingReview.filter((item) => item.process.managerId === actor.id).length,
      pendingFinalApprovals: finalApprovals.filter((item) => item.process.finalApproverId === actor.id).length,
      openTasks,
      overdueTasks,
      pendingEvaluations,
      activeAbsences
    },
    pendingSuperiorApprovals,
    teams,
    processes: visibleProcesses,
    pendingReview: pendingReview.filter((item) => item.process.managerId === actor.id),
    finalApprovals: finalApprovals.filter((item) => item.process.finalApproverId === actor.id),
    notifications
  };
}
