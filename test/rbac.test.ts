import test from "node:test";
import assert from "node:assert/strict";
import { getScopedEmployeeIds, hasHrSystemAccess, hasManagementPanelAccess, type ScopedOrgUser } from "../src/server/rbac";

const orgUsers: ScopedOrgUser[] = [
  { id: "admin", managerId: null },
  { id: "hr", managerId: null },
  { id: "manager", managerId: "admin" },
  { id: "lead", managerId: "manager" },
  { id: "userA", managerId: "lead" },
  { id: "userB", managerId: "manager" }
];

test("admin and hr can see all scoped employees", () => {
  assert.equal(getScopedEmployeeIds({ id: "admin", role: "ADMIN" }, orgUsers).size, orgUsers.length);
  assert.equal(getScopedEmployeeIds({ id: "hr", role: "HR" }, orgUsers).size, orgUsers.length);
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
