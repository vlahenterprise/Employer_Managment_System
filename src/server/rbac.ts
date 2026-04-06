import type { UserRole } from "@prisma/client";
import { isHrModuleEnabled } from "./features";

export type ScopedActor = {
  id: string;
  role: UserRole;
  hrAddon?: boolean;
  adminAddon?: boolean;
};

export type ScopedOrgUser = {
  id: string;
  managerId: string | null;
};

export function getBaseRole(role: UserRole) {
  return role === "MANAGER" || role === "ADMIN" ? "MANAGER" : "USER";
}

export function isLegacyAdminRole(role: UserRole) {
  return role === "ADMIN";
}

export function isAdminRole(role: UserRole) {
  return isLegacyAdminRole(role);
}

export function isManagerRole(role: UserRole) {
  return getBaseRole(role) === "MANAGER";
}

export function isUserRole(role: UserRole) {
  return getBaseRole(role) === "USER";
}

export function hasHrAddon(actor: Pick<ScopedActor, "role" | "hrAddon">) {
  if (!isHrModuleEnabled()) return false;
  return Boolean(actor.hrAddon) || actor.role === "HR";
}

export function hasAdminAddon(actor: Pick<ScopedActor, "role" | "adminAddon">) {
  return Boolean(actor.adminAddon) || actor.role === "ADMIN";
}

export function hasHrSystemAccess(actor: Pick<ScopedActor, "role" | "hrAddon">) {
  return hasHrAddon(actor);
}

export function hasAccessAdmin(actor: Pick<ScopedActor, "role" | "adminAddon">) {
  return hasAdminAddon(actor);
}

export function hasManagementPanelAccess(actor: Pick<ScopedActor, "role">) {
  if (!isHrModuleEnabled()) return false;
  return isManagerRole(actor.role);
}

export function canManageTeamScope(actor: Pick<ScopedActor, "role">) {
  return isManagerRole(actor.role);
}

export function hasHiringAccess(actor: Pick<ScopedActor, "role" | "hrAddon">) {
  if (!isHrModuleEnabled()) return false;
  return isManagerRole(actor.role) || hasHrAddon(actor);
}

export function canViewAllProfiles(actor: Pick<ScopedActor, "role" | "hrAddon" | "adminAddon">) {
  return hasHrAddon(actor) || hasAdminAddon(actor);
}

export function getAccessSummary(actor: Pick<ScopedActor, "role" | "hrAddon" | "adminAddon">) {
  const parts = [getBaseRole(actor.role)];
  if (hasHrAddon(actor)) parts.push("HR_ADDON");
  if (hasAdminAddon(actor)) parts.push("ADMIN_ADDON");
  return parts;
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
  if (isManagerRole(actor.role)) {
    const scoped = getDescendants(actor.id, users);
    scoped.add(actor.id);
    return scoped;
  }
  return new Set([actor.id]);
}

export function canViewEmployeeProfile(
  actor: Pick<ScopedActor, "id" | "role" | "hrAddon" | "adminAddon">,
  targetUserId: string,
  users: ScopedOrgUser[]
) {
  if (!targetUserId) return false;
  if (actor.id === targetUserId) return true;
  if (canViewAllProfiles(actor)) return true;
  return getScopedEmployeeIds(actor, users).has(targetUserId);
}
