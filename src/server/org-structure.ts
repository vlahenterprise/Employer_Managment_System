import "server-only";

import { unstable_cache } from "next/cache";
import { ORG_STRUCTURE_CACHE_TAG, ORG_USERS_CACHE_TAG } from "./cache-tags";
import { prisma } from "./db";

export type OrgStructureNode = {
  id: string;
  title: string;
  subtitle?: string | null;
  description: string | null;
  parentId: string | null;
  order: number;
  isActive: boolean;
  links: Array<{ id: string; label: string; url: string; order: number }>;
  users: Array<{ id: string; name: string; email: string; assignmentId: string }>;
};

const loadOrgPositionsCached = unstable_cache(
  async () =>
    prisma.orgPosition.findMany({
      orderBy: [{ order: "asc" }, { title: "asc" }],
      include: {
        links: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] },
        assignees: { include: { user: { select: { id: true, name: true, email: true } } } }
      }
    }),
  ["org-structure:positions"],
  { tags: [ORG_STRUCTURE_CACHE_TAG] }
);

const loadOrgChartUsersCached = unstable_cache(
  async () =>
    prisma.user.findMany({
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
    }),
  ["org-structure:chart-users"],
  { tags: [ORG_USERS_CACHE_TAG] }
);

const loadOrgPickerPositionsCached = unstable_cache(
  async () => prisma.orgPosition.findMany({ orderBy: [{ order: "asc" }, { title: "asc" }], select: { id: true, title: true } }),
  ["org-structure:picker-positions"],
  { tags: [ORG_STRUCTURE_CACHE_TAG] }
);

const loadOrgPickerUsersCached = unstable_cache(
  async () =>
    prisma.user.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, status: true }
    }),
  ["org-structure:picker-users"],
  { tags: [ORG_USERS_CACHE_TAG] }
);

export async function getOrgStructure() {
  const rows = await loadOrgPositionsCached();

  const nodes: OrgStructureNode[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description ?? null,
    parentId: row.parentId ?? null,
    order: row.order,
    isActive: row.isActive,
    links: row.links.map((l) => ({ id: l.id, label: l.label, url: l.url, order: l.order })),
    users: row.assignees.map((a) => ({ id: a.user.id, name: a.user.name, email: a.user.email, assignmentId: a.id }))
  }));

  return { ok: true as const, nodes };
}

function normalizeKey(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

export async function getUserOrgStructure() {
  const users = await loadOrgChartUsersCached();

  let positions: Array<{ id: string; title: string; description: string | null; links: Array<{ id: string; label: string; url: string; order: number }> }> = [];
  try {
    positions = (await loadOrgPositionsCached()).map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      links: row.links.map((link) => ({
        id: link.id,
        label: link.label,
        url: link.url,
        order: link.order
      }))
    }));
  } catch {
    positions = [];
  }

  const positionByTitle = new Map<string, (typeof positions)[number]>();
  for (const p of positions) {
    const key = normalizeKey(p.title);
    if (key) positionByTitle.set(key, p);
  }

  const reportsByManager = new Map<string, typeof users>();
  for (const u of users) {
    if (!u.managerId || u.managerId === u.id) continue;
    const list = reportsByManager.get(u.managerId) ?? [];
    list.push(u);
    reportsByManager.set(u.managerId, list);
  }

  const nodes: OrgStructureNode[] = users.map((u) => {
    const positionTitle = u.position?.trim() || "";
    const displayTitle = positionTitle || u.name || u.email;
    const subtitleParts: string[] = [];
    if (positionTitle) subtitleParts.push(u.name || u.email);
    if (u.team?.name) subtitleParts.push(u.team.name);
    const pos = positionByTitle.get(normalizeKey(u.position));
    const links = pos ? pos.links.map((l) => ({ id: l.id, label: l.label, url: l.url, order: l.order })) : [];
    const reports = reportsByManager.get(u.id) ?? [];
    return {
      id: u.id,
      title: displayTitle,
      subtitle: subtitleParts.length ? subtitleParts.join(" · ") : null,
      description: pos?.description ?? null,
      parentId: u.managerId ?? null,
      order: 0,
      isActive: true,
      links,
      users: reports.map((r) => ({ id: r.id, name: r.name, email: r.email, assignmentId: r.id }))
    };
  });

  return { ok: true as const, nodes };
}

export async function getOrgPickers() {
  const [positions, users] = await Promise.all([
    loadOrgPickerPositionsCached(),
    loadOrgPickerUsersCached()
  ]);

  return {
    positions,
    users: users.filter((u) => u.status === "ACTIVE")
  };
}
