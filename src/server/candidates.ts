import "server-only";

import { prisma } from "./db";
import { hasHrAddon } from "./rbac";

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
  filters: { query?: string | null; stage?: string | null; owner?: string | null } = {}
) {
  if (!hasHrAddon(actor)) return { ok: false as const, error: "NO_ACCESS" };

  const query = cleanText(filters.query).toLowerCase();
  const stage = cleanText(filters.stage).toUpperCase();
  const owner = cleanText(filters.owner);

  const rows = await prisma.hrCandidate.findMany({
    orderBy: [{ updatedAt: "desc" }],
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
    const haystack = [
      candidate.fullName,
      candidate.email,
      candidate.phone,
      candidate.source,
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

  return { ok: true as const, items: filtered };
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

export async function getTalentPool(actor: CandidateActor, tag?: string | null) {
  if (!hasHrAddon(actor)) return { ok: false as const, error: "NO_ACCESS" };
  const cleanTag = cleanText(tag);
  const items = await prisma.hrCandidate.findMany({
    where: {
      OR: [
        { talentPoolTag: cleanTag || undefined },
        {
          applications: {
            some: {
              status: "ARCHIVED"
            }
          }
        }
      ]
    },
    orderBy: [{ updatedAt: "desc" }],
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      source: true,
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

  return { ok: true as const, items };
}
