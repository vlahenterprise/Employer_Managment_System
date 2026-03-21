import type { UserRole } from "@prisma/client";

export type ScopedActor = {
  id: string;
  role: UserRole;
  hrAddon?: boolean;
};

export type ScopedOrgUser = {
  id: string;
  managerId: string | null;
};

export function isAdminRole(role: UserRole) {
  return role === "ADMIN";
}

export function isHrRole(role: UserRole) {
  return role === "HR";
}

export function isManagerRole(role: UserRole) {
  return role === "MANAGER";
}

export function hasHrSystemAccess(actor: Pick<ScopedActor, "role" | "hrAddon">) {
  return isAdminRole(actor.role) || isHrRole(actor.role) || Boolean(actor.hrAddon);
}

export function hasManagementPanelAccess(actor: Pick<ScopedActor, "role">) {
  return isAdminRole(actor.role) || isManagerRole(actor.role);
}

export function canViewAllEmployeeData(actor: Pick<ScopedActor, "role">) {
  return isAdminRole(actor.role) || isHrRole(actor.role);
}

function getDescendants(managerId: string, users: ScopedOrgUser[]) {
  const children = new Map<string, string[]>();
  for (const user of users) {
    const directManagerId = user.managerId ?? null;
    if (!directManagerId || directManagerId === user.id) continue;
    const existing = children.get(directManagerId) ?? [];
    existing.push(user.id);
    children.set(directManagerId, existing);
  }

  const scoped = new Set<string>();
  const queue = [...(children.get(managerId) ?? [])];
  while (queue.length > 0) {
    const nextId = queue.shift();
    if (!nextId || scoped.has(nextId)) continue;
    scoped.add(nextId);
    for (const childId of children.get(nextId) ?? []) {
      if (!scoped.has(childId)) queue.push(childId);
    }
  }
  return scoped;
}

export function getScopedEmployeeIds(actor: Pick<ScopedActor, "id" | "role">, users: ScopedOrgUser[]) {
  if (canViewAllEmployeeData(actor)) return new Set(users.map((user) => user.id));
  if (isManagerRole(actor.role)) {
    const scoped = getDescendants(actor.id, users);
    scoped.add(actor.id);
    return scoped;
  }
  return new Set([actor.id]);
}
