import test from "node:test";
import assert from "node:assert/strict";
import {
  canViewAllProfiles,
  getScopedEmployeeIds,
  hasHrSystemAccess,
  hasManagementPanelAccess,
  type ScopedOrgUser
} from "../src/server/rbac";

const orgUsers: ScopedOrgUser[] = [
  { id: "admin", managerId: null },
  { id: "hr", managerId: null },
  { id: "manager", managerId: "admin" },
  { id: "lead", managerId: "manager" },
  { id: "userA", managerId: "lead" },
  { id: "userB", managerId: "manager" }
];

test("profile-wide visibility stays with explicit add-ons", () => {
  assert.equal(canViewAllProfiles({ role: "USER", adminAddon: true, hrAddon: false }), true);
  assert.equal(canViewAllProfiles({ role: "USER", adminAddon: false, hrAddon: true }), true);
  assert.equal(canViewAllProfiles({ role: "USER", adminAddon: false, hrAddon: false }), false);
  assert.equal(getScopedEmployeeIds({ id: "hr", role: "HR" }, orgUsers).size, 1);
});

test("manager scope includes descendants and self", () => {
  const scoped = getScopedEmployeeIds({ id: "manager", role: "MANAGER" }, orgUsers);
  assert.deepEqual([...scoped].sort(), ["lead", "manager", "userA", "userB"].sort());
});

test("hr addon access and management panel access stay explicit", () => {
  assert.equal(hasHrSystemAccess({ role: "USER", hrAddon: true }), true);
  assert.equal(hasHrSystemAccess({ role: "USER", hrAddon: false }), false);
  assert.equal(hasManagementPanelAccess({ role: "MANAGER" }), true);
  assert.equal(hasManagementPanelAccess({ role: "HR" }), false);
});
