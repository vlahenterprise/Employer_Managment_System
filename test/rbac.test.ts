import test from "node:test";
import assert from "node:assert/strict";
import type { ScopedOrgUser } from "../src/server/rbac";

function withEnv(hrEnabled: boolean) {
  process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://test:test@localhost:5432/test";
  process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || "test-secret";
  process.env.ENABLE_HR_MODULE = hrEnabled ? "true" : "false";
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
  withEnv(true);
  const { canViewAllProfiles, getScopedEmployeeIds } = require("../src/server/rbac") as typeof import("../src/server/rbac");
  assert.equal(canViewAllProfiles({ role: "USER", adminAddon: true, hrAddon: false }), true);
  assert.equal(canViewAllProfiles({ role: "USER", adminAddon: false, hrAddon: true }), true);
  assert.equal(canViewAllProfiles({ role: "USER", adminAddon: false, hrAddon: false }), false);
  assert.equal(getScopedEmployeeIds({ id: "hr", role: "HR" }, orgUsers).size, 1);
});

test("manager scope includes descendants and self", () => {
  withEnv(true);
  const { getScopedEmployeeIds } = require("../src/server/rbac") as typeof import("../src/server/rbac");
  const scoped = getScopedEmployeeIds({ id: "manager", role: "MANAGER" }, orgUsers);
  assert.deepEqual([...scoped].sort(), ["lead", "manager", "userA", "userB"].sort());
});

test("hr addon access and management panel access stay explicit", () => {
  withEnv(true);
  const { hasHrSystemAccess, hasManagementPanelAccess } = require("../src/server/rbac") as typeof import("../src/server/rbac");
  assert.equal(hasHrSystemAccess({ role: "USER", hrAddon: true }), true);
  assert.equal(hasHrSystemAccess({ role: "USER", hrAddon: false }), false);
  assert.equal(hasManagementPanelAccess({ role: "MANAGER" }), true);
  assert.equal(hasManagementPanelAccess({ role: "HR" }), false);
});
