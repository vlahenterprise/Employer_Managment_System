import "server-only";

import type { OrgLinkType, OrgPositionTier } from "@prisma/client";
import { prisma } from "./db";
import { mapOrgTierToNodeLevel, normalizeOrgSearchText } from "@/lib/org-system";

export type OrgAdminLink = {
  id: string;
  label: string;
  description: string | null;
  url: string;
  type: OrgLinkType;
  order: number;
};

export type OrgStructureNode = {
  id: string;
  title: string;
  subtitle?: string | null;
  description: string | null;
  parentId: string | null;
  tier: OrgPositionTier;
  order: number;
  isActive: boolean;
  links: OrgAdminLink[];
  users: Array<{ id: string; name: string; email: string; assignmentId: string }>;
};

export type OrgGlobalResource = {
  id: string;
  label: string;
  description: string | null;
  url: string;
  type: OrgLinkType;
  order: number;
};

export type OrgSystemPerson = {
  id: string;
  name: string;
  email: string;
  teamName: string | null;
  position: string | null;
};

export type OrgSystemNode = {
  id: string;
  title: string;
  description: string | null;
  parentId: string | null;
  order: number;
  isActive: boolean;
  level: "director" | "manager" | "lead" | "supervisor" | "staff";
  documents: OrgAdminLink[];
  people: OrgSystemPerson[];
};

async function loadOrgPositions() {
  return prisma.orgPosition.findMany({
    orderBy: [{ order: "asc" }, { title: "asc" }],
    include: {
      links: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] },
      assignees: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              position: true,
              team: { select: { name: true } }
            }
          }
        }
      }
    }
  });
}

async function loadGlobalLinks() {
  return prisma.orgGlobalLink.findMany({ orderBy: [{ order: "asc" }, { createdAt: "asc" }] });
}

async function loadOrgChartUsers() {
  return prisma.user.findMany({
    where: { status: "ACTIVE" },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      position: true,
      managerId: true,
      team: { select: { name: true } }
    }
  });
}

async function loadOrgPickerPositions() {
  return prisma.orgPosition.findMany({
    orderBy: [{ order: "asc" }, { title: "asc" }],
    select: { id: true, title: true, tier: true, order: true, parentId: true }
  });
}

async function loadOrgPickerUsers() {
  return prisma.user.findMany({
    where: { status: "ACTIVE" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, status: true }
  });
}

function normalizeKey(value: string | null | undefined) {
  return normalizeOrgSearchText(value);
}

function mapOrgLink(row: {
  id: string;
  label: string;
  description: string | null;
  url: string;
  type: OrgLinkType;
  order: number;
}) {
  return {
    id: row.id,
    label: row.label,
    description: row.description ?? null,
    url: row.url,
    type: row.type,
    order: row.order
  };
}

function sortPeople(people: OrgSystemPerson[]) {
  return [...people].sort((a, b) => a.name.localeCompare(b.name) || a.email.localeCompare(b.email));
}

function buildPositionFallbackUsers(params: {
  positions: Awaited<ReturnType<typeof loadOrgPositions>>;
  activeUsers: Awaited<ReturnType<typeof loadOrgChartUsers>>;
}) {
  const assignedUserIds = new Set<string>();
  const byPositionId = new Map<string, OrgSystemPerson[]>();

  for (const position of params.positions) {
    const list = byPositionId.get(position.id) ?? [];
    for (const assignee of position.assignees) {
      assignedUserIds.add(assignee.user.id);
      list.push({
        id: assignee.user.id,
        name: assignee.user.name,
        email: assignee.user.email,
        teamName: assignee.user.team?.name ?? null,
        position: assignee.user.position ?? null
      });
    }
    byPositionId.set(position.id, list);
  }

  const positionIdByTitle = new Map<string, string>();
  for (const position of params.positions) {
    const key = normalizeKey(position.title);
    if (key && !positionIdByTitle.has(key)) positionIdByTitle.set(key, position.id);
  }

  for (const user of params.activeUsers) {
    if (assignedUserIds.has(user.id)) continue;
    const positionId = positionIdByTitle.get(normalizeKey(user.position));
    if (!positionId) continue;
    const list = byPositionId.get(positionId) ?? [];
    list.push({
      id: user.id,
      name: user.name,
      email: user.email,
      teamName: user.team?.name ?? null,
      position: user.position ?? null
    });
    byPositionId.set(positionId, list);
  }

  return byPositionId;
}

export async function getOrgStructure() {
  const [rows, globalRows] = await Promise.all([loadOrgPositions(), loadGlobalLinks()]);

  const nodes: OrgStructureNode[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description ?? null,
    parentId: row.parentId ?? null,
      order: row.order,
      tier: row.tier,
      isActive: row.isActive,
      links: row.links.map(mapOrgLink),
      users: row.assignees.map((a) => ({ id: a.user.id, name: a.user.name, email: a.user.email, assignmentId: a.id }))
  }));

  const globalLinks = globalRows.map(mapOrgLink);

  return { ok: true as const, nodes, globalLinks };
}

export async function getUserOrgStructure() {
  const [positions, activeUsers, globalRows] = await Promise.all([
    loadOrgPositions(),
    loadOrgChartUsers(),
    loadGlobalLinks()
  ]);

  const peopleByPositionId = buildPositionFallbackUsers({ positions, activeUsers });

  const nodes: OrgSystemNode[] = positions
    .filter((position) => position.isActive)
    .map((position) => ({
      id: position.id,
      title: position.title,
      description: position.description ?? null,
      parentId: position.parentId ?? null,
      order: position.order,
      isActive: position.isActive,
      level: mapOrgTierToNodeLevel(position.tier),
      documents: position.links.map(mapOrgLink),
      people: sortPeople(peopleByPositionId.get(position.id) ?? [])
    }));

  const globalLinks = globalRows.map(mapOrgLink);

  return {
    ok: true as const,
    nodes,
    globalLinks
  };
}

export async function getOrgPickers() {
  const [positions, users] = await Promise.all([loadOrgPickerPositions(), loadOrgPickerUsers()]);

  return {
    positions,
    users: users.filter((u) => u.status === "ACTIVE")
  };
}

export async function getPositionResourceFallbackByUserId(userId: string) {
  const id = String(userId || "").trim();
  if (!id) {
    return {
      positionTitle: null,
      jobDescriptionUrl: null,
      workInstructionsUrl: null,
      positionDocuments: [] as OrgAdminLink[],
      globalLinks: [] as OrgGlobalResource[]
    };
  }

  const [positions, globalRows, user] = await Promise.all([
    loadOrgPositions(),
    loadGlobalLinks(),
    prisma.user.findUnique({
      where: { id },
      select: { id: true, position: true }
    })
  ]);

  const assigned = positions.find((position) => position.assignees.some((assignment) => assignment.user.id === id));
  const matchedByTitle =
    assigned ||
    positions.find((position) => normalizeKey(position.title) && normalizeKey(position.title) === normalizeKey(user?.position));

  const documents = matchedByTitle ? matchedByTitle.links.map(mapOrgLink) : [];

  const firstByType = (type: OrgLinkType) => documents.find((document) => document.type === type)?.url ?? null;

  return {
    positionTitle: matchedByTitle?.title ?? user?.position ?? null,
    jobDescriptionUrl: firstByType("JOB_DESCRIPTION"),
    workInstructionsUrl: firstByType("WORK_INSTRUCTIONS"),
    positionDocuments: documents,
    globalLinks: globalRows.map(mapOrgLink)
  };
}
