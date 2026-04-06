import test from "node:test";
import assert from "node:assert/strict";
import type { ScopedOrgUser } from "../src/server/rbac";

function withEnv(hrEnabled: boolean) {
  process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://test:test@localhost:5432/test";
  process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || "test-secret";
  process.env.ENABLE_HR_MODULE = hrEnabled ? "true" : "false";
}

function loadRbac(hrEnabled: boolean) {
  withEnv(hrEnabled);
  for (const mod of ["../src/server/rbac", "../src/server/features", "../src/server/config"]) {
    delete require.cache[require.resolve(mod)];
  }
  return require("../src/server/rbac") as typeof import("../src/server/rbac");
}

const orgUsers: ScopedOrgUser[] = [
  { id: "admin", managerId: null },
  { id: "hr", managerId: null },
  { id: "manager", managerId: "admin" },
  { id: "lead", managerId: "manager" },
  { id: "userA", managerId: "lead" },
  { id: "userB", managerId: "manager" }
];

test("profile-wide visibility stays with explicit add-ons", () => {
  const { canViewAllProfiles, getScopedEmployeeIds } = loadRbac(true);
  assert.equal(canViewAllProfiles({ role: "USER", adminAddon: true, hrAddon: false }), true);
  assert.equal(canViewAllProfiles({ role: "USER", adminAddon: false, hrAddon: true }), true);
  assert.equal(canViewAllProfiles({ role: "USER", adminAddon: false, hrAddon: false }), false);
  assert.equal(getScopedEmployeeIds({ id: "hr", role: "HR" }, orgUsers).size, 1);
});

test("manager scope includes descendants and self", () => {
  const { getScopedEmployeeIds } = loadRbac(true);
  const scoped = getScopedEmployeeIds({ id: "manager", role: "MANAGER" }, orgUsers);
  assert.deepEqual([...scoped].sort(), ["lead", "manager", "userA", "userB"].sort());
});

test("hr addon access and management panel access stay explicit", () => {
  const { hasHrSystemAccess, hasManagementPanelAccess } = loadRbac(true);
  assert.equal(hasHrSystemAccess({ role: "USER", hrAddon: true }), true);
  assert.equal(hasHrSystemAccess({ role: "USER", hrAddon: false }), false);
  assert.equal(hasManagementPanelAccess({ role: "MANAGER" }), true);
  assert.equal(hasManagementPanelAccess({ role: "HR" }), false);
});

test("HR-specific access closes when the feature flag is disabled", () => {
  const { hasHrSystemAccess, hasManagementPanelAccess, hasHiringAccess } = loadRbac(false);
  assert.equal(hasHrSystemAccess({ role: "USER", hrAddon: true }), false);
  assert.equal(hasHiringAccess({ role: "MANAGER", hrAddon: true }), false);
  assert.equal(hasManagementPanelAccess({ role: "MANAGER" }), false);
});
