import "server-only";

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

export async function loadOrgUsers(): Promise<OrgUser[]> {
  return prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      managerId: true,
      teamId: true
    }
  }) as any;
}

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
