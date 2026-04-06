import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { fromZonedTime } from "@/server/time";
import { APP_TIMEZONE } from "./app-settings";
import { ORG_USERS_CACHE_TAG } from "./cache-tags";
import { prisma } from "./db";

export type OrgUser = {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "HR" | "MANAGER" | "USER";
  status: "ACTIVE" | "INACTIVE";
  managerId: string | null;
  teamId: string | null;
};

export type ApprovalHierarchyContext = {
  byId: Map<string, OrgUser>;
  managerOf: Map<string, string | null>;
  allowAncestor: boolean;
  unavailableManagerIds: Set<string>;
};

const loadOrgUsersCached = unstable_cache(
  async () =>
    prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        managerId: true,
        teamId: true
      }
    }),
  ["org-users:basic"],
  { tags: [ORG_USERS_CACHE_TAG] }
);

export const loadOrgUsers = cache(async (): Promise<OrgUser[]> => {
  return (await loadOrgUsersCached()) as any;
});

export function buildOrgIndex(users: OrgUser[]) {
  const byId = new Map<string, OrgUser>();
  for (const u of users) byId.set(u.id, u);

  const children = new Map<string, string[]>();
  const managerOf = new Map<string, string | null>();

  for (const u of users) {
    managerOf.set(u.id, u.managerId ?? null);
    const mgr = u.managerId;
    if (mgr && mgr !== u.id) {
      const list = children.get(mgr) ?? [];
      list.push(u.id);
      children.set(mgr, list);
    }
  }

  return { byId, children, managerOf };
}

export function isTopManager(userId: string, managerOf: Map<string, string | null>, byId: Map<string, OrgUser>) {
  const mgr: string | null = managerOf.get(userId) ?? null;
  if (!mgr) return true;
  if (mgr === userId) return true;
  return !byId.has(mgr);
}

export function isDirectManager(managerId: string, employeeId: string, managerOf: Map<string, string | null>) {
  if (!managerId || !employeeId) return false;
  if (managerId === employeeId) return false;
  return (managerOf.get(employeeId) ?? null) === managerId;
}

export function isAncestorManager(managerId: string, employeeId: string, managerOf: Map<string, string | null>) {
  if (!managerId || !employeeId) return false;
  if (managerId === employeeId) return false;
  const seen = new Set<string>();
  let cur: string | null = employeeId;
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    const mgr: string | null = managerOf.get(cur) ?? null;
    if (!mgr || mgr === cur) return false;
    if (mgr === managerId) return true;
    cur = mgr;
  }
  return false;
}

export function getDescendants(managerId: string, children: Map<string, string[]>) {
  const out = new Set<string>();
  const q = [...(children.get(managerId) ?? [])];
  while (q.length) {
    const id = q.shift();
    if (!id || out.has(id)) continue;
    out.add(id);
    const kids = children.get(id) ?? [];
    for (const k of kids) if (!out.has(k)) q.push(k);
  }
  return out;
}

export function getAllowedEmployeesForManager(managerId: string, users: OrgUser[]) {
  const { byId, children, managerOf } = buildOrgIndex(users);
  if (isTopManager(managerId, managerOf, byId)) {
    return new Set(users.map((u) => u.id));
  }
  const set = getDescendants(managerId, children);
  set.add(managerId);
  return set;
}

async function loadApprovedLeaveUserIdsToday(userIds: string[]) {
  if (userIds.length === 0) return new Set<string>();
  const today = new Intl.DateTimeFormat("sv-SE", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
  const from = fromZonedTime(`${today}T00:00:00`, APP_TIMEZONE);
  const to = fromZonedTime(`${today}T23:59:59.999`, APP_TIMEZONE);
  const rows = await prisma.absence.findMany({
    where: {
      employeeId: { in: userIds },
      status: "APPROVED",
      dateFrom: { lte: to },
      dateTo: { gte: from }
    },
    select: { employeeId: true }
  });
  return new Set(rows.map((row) => row.employeeId));
}

export async function buildApprovalHierarchyContext(params: {
  allowAncestor: boolean;
  employeeIds: Iterable<string>;
}): Promise<ApprovalHierarchyContext> {
  const orgUsers = await loadOrgUsers();
  const { byId, managerOf } = buildOrgIndex(orgUsers);
  const employeeIds = [...new Set([...params.employeeIds].filter(Boolean))];

  const directManagerIds = new Set<string>();
  if (params.allowAncestor) {
    for (const employeeId of employeeIds) {
      const directManagerId = managerOf.get(employeeId) ?? null;
      if (directManagerId && byId.has(directManagerId)) directManagerIds.add(directManagerId);
    }
  }

  return {
    byId,
    managerOf,
    allowAncestor: params.allowAncestor,
    unavailableManagerIds: params.allowAncestor ? await loadApprovedLeaveUserIdsToday([...directManagerIds]) : new Set<string>()
  };
}

export function canManagerApproveEmployee(actorId: string, employeeId: string, context: ApprovalHierarchyContext) {
  if (!actorId || !employeeId) return false;
  if (actorId === employeeId) return false;

  if (isDirectManager(actorId, employeeId, context.managerOf)) return true;
  if (!context.allowAncestor) return false;
  if (!isAncestorManager(actorId, employeeId, context.managerOf)) return false;

  const directManagerId = context.managerOf.get(employeeId) ?? null;
  if (!directManagerId) return false;
  if (!context.byId.has(directManagerId)) return false;
  return context.unavailableManagerIds.has(directManagerId);
}
