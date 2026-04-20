import "server-only";

import { prisma } from "./db";
import { buildPaginationMeta, normalizePagination, type PaginationInput } from "./pagination";
import { hasHrAddon } from "./rbac";
import { isActiveCandidateStatus, isTalentPoolCandidateStatus } from "./recruiting-presentation";

export type CandidateActor = {
  id: string;
  role: "ADMIN" | "HR" | "MANAGER" | "USER";
  hrAddon?: boolean;
};

function cleanText(value: string | null | undefined) {
  return String(value || "").trim();
}

export async function getCandidatesWorkspace(
  actor: CandidateActor,
  filters: { query?: string | null; stage?: string | null; owner?: string | null; pagination?: PaginationInput } = {}
) {
  if (!hasHrAddon(actor)) return { ok: false as const, error: "NO_ACCESS" };

  const query = cleanText(filters.query).toLowerCase();
  const stage = cleanText(filters.stage).toUpperCase();
  const owner = cleanText(filters.owner);
  const pagination = normalizePagination({
    ...filters.pagination,
    defaultPageSize: 24,
    maxPageSize: 60
  });

  const rows = await prisma.hrCandidate.findMany({
    orderBy: [{ updatedAt: "desc" }],
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      source: true,
      seniority: true,
      language: true,
      location: true,
      tags: true,
      skillMarkers: true,
      cvDriveUrl: true,
      talentPoolTag: true,
      lastContactAt: true,
      latestCvFileName: true,
      applications: {
        orderBy: [{ updatedAt: "desc" }],
        take: 5,
        select: {
          id: true,
          status: true,
          updatedAt: true,
          nextAction: true,
          process: {
            select: {
              id: true,
              positionTitle: true,
              team: { select: { name: true } },
              manager: { select: { id: true, name: true } }
            }
          }
        }
      }
    }
  });

  const filtered = rows.filter((candidate) => {
    const latest = candidate.applications[0] || null;
    if (!latest || !isActiveCandidateStatus(latest.status)) return false;
    const haystack = [
      candidate.fullName,
      candidate.email,
      candidate.phone,
      candidate.source,
      candidate.seniority,
      candidate.language,
      candidate.location,
      Array.isArray(candidate.tags) ? candidate.tags.join(" ") : "",
      Array.isArray(candidate.skillMarkers) ? candidate.skillMarkers.join(" ") : "",
      latest?.process.positionTitle,
      latest?.process.team?.name
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (query && !haystack.includes(query)) return false;
    if (stage && stage !== "ALL") {
      const candidateStage = String(latest?.status || "").toUpperCase();
      if (candidateStage !== stage) return false;
    }
    if (owner) {
      const ownerName = cleanText(latest?.process.manager?.name);
      if (!ownerName || ownerName !== owner) return false;
    }
    return true;
  });

  const total = filtered.length;
  const metrics = {
    total,
    screening: filtered.filter((candidate) => {
      const status = String(candidate.applications[0]?.status || "").toUpperCase();
      return status === "NEW_APPLICANT" || status === "HR_SCREENING" || status === "ON_HOLD";
    }).length,
    managerReview: filtered.filter((candidate) => {
      const status = String(candidate.applications[0]?.status || "").toUpperCase();
      return status === "SENT_TO_MANAGER" || status === "WAITING_MANAGER_REVIEW";
    }).length,
    finalApproval: filtered.filter(
      (candidate) => String(candidate.applications[0]?.status || "").toUpperCase() === "WAITING_FINAL_APPROVAL"
    ).length,
    approved: filtered.filter(
      (candidate) => String(candidate.applications[0]?.status || "").toUpperCase() === "APPROVED_FOR_EMPLOYMENT"
    ).length
  };
  const pageItems = filtered.slice(pagination.skip, pagination.skip + pagination.take);

  return {
    ok: true as const,
    items: pageItems,
    meta: buildPaginationMeta(total, pagination),
    metrics
  };
}

export async function getCandidateDetail(actor: CandidateActor, candidateId: string) {
  if (!hasHrAddon(actor)) return { ok: false as const, error: "NO_ACCESS" };
  const id = cleanText(candidateId);
  if (!id) return { ok: false as const, error: "NOT_FOUND" };

  const candidate = await prisma.hrCandidate.findUnique({
    where: { id },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      linkedIn: true,
      source: true,
      seniority: true,
      language: true,
      location: true,
      tags: true,
      skillMarkers: true,
      cvDriveUrl: true,
      talentPoolTag: true,
      lastContactAt: true,
      latestCvFileName: true,
      latestCvMimeType: true,
      createdAt: true,
      updatedAt: true,
      applications: {
        orderBy: [{ updatedAt: "desc" }],
        select: {
          id: true,
          status: true,
          source: true,
          appliedAt: true,
          hrComment: true,
          firstRoundComment: true,
          screeningResult: true,
          expectedSalary: true,
          hrRecommendation: true,
          managerRecommendation: true,
          interviewRecommendation: true,
          finalReasonCode: true,
          managerComment: true,
          finalComment: true,
          interviewScheduledAt: true,
          secondRoundCompletedAt: true,
          finalDecisionAt: true,
          archivedAt: true,
          cancelledAt: true,
          closedReason: true,
          nextAction: true,
          process: {
            select: {
              id: true,
              positionTitle: true,
              status: true,
              team: { select: { name: true } },
              manager: { select: { id: true, name: true, email: true } },
              finalApprover: { select: { id: true, name: true, email: true } }
            }
          },
          comments: {
            orderBy: [{ createdAt: "asc" }],
            select: {
              id: true,
              stage: true,
              body: true,
              createdAt: true,
              actor: { select: { id: true, name: true, email: true } }
            }
          }
        }
      }
    }
  });

  if (!candidate) return { ok: false as const, error: "NOT_FOUND" };
  return { ok: true as const, candidate };
}

export async function getTalentPool(
  actor: CandidateActor,
  filters: { tag?: string | null; query?: string | null; pagination?: PaginationInput } = {}
) {
  if (!hasHrAddon(actor)) return { ok: false as const, error: "NO_ACCESS" };
  const cleanTag = cleanText(filters.tag);
  const query = cleanText(filters.query).toLowerCase();
  const pagination = normalizePagination({
    ...filters.pagination,
    defaultPageSize: 24,
    maxPageSize: 60
  });

  const items = await prisma.hrCandidate.findMany({
    orderBy: [{ updatedAt: "desc" }],
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      source: true,
      seniority: true,
      language: true,
      location: true,
      tags: true,
      skillMarkers: true,
      cvDriveUrl: true,
      talentPoolTag: true,
      lastContactAt: true,
      applications: {
        orderBy: [{ updatedAt: "desc" }],
        take: 1,
        select: {
          id: true,
          status: true,
          closedReason: true,
          process: { select: { positionTitle: true, team: { select: { name: true } } } }
        }
      }
    }
  });

  const filtered = items.filter((candidate) => {
    const latest = candidate.applications[0] || null;
    const inPool = Boolean(candidate.talentPoolTag) || isTalentPoolCandidateStatus(latest?.status);
    if (!inPool) return false;
    if (cleanTag && cleanText(candidate.talentPoolTag).toLowerCase() !== cleanTag.toLowerCase()) return false;

    if (query) {
      const haystack = [
        candidate.fullName,
        candidate.email,
        candidate.phone,
        candidate.source,
        candidate.seniority,
        candidate.language,
        candidate.location,
        Array.isArray(candidate.tags) ? candidate.tags.join(" ") : "",
        Array.isArray(candidate.skillMarkers) ? candidate.skillMarkers.join(" ") : "",
        candidate.talentPoolTag,
        latest?.process?.positionTitle,
        latest?.process?.team?.name,
        latest?.closedReason
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }

    return true;
  });

  const total = filtered.length;
  const metrics = {
    total,
    tagged: filtered.filter((candidate) => Boolean(candidate.talentPoolTag)).length,
    reusable: filtered.filter((candidate) => Boolean(candidate.cvDriveUrl)).length
  };
  const pageItems = filtered.slice(pagination.skip, pagination.skip + pagination.take);

  return {
    ok: true as const,
    items: pageItems,
    meta: buildPaginationMeta(total, pagination),
    metrics
  };
}
