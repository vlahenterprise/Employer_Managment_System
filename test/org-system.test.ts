import test from "node:test";
import assert from "node:assert/strict";
import { buildOrgDepthMap, getOrgNodeLevel, groupOrgDocuments, normalizeOrgSearchText } from "../src/lib/org-system";

test("org depth mapping stays stable for nested position trees", () => {
  const depthMap = buildOrgDepthMap([
    { id: "ceo", parentId: null },
    { id: "manager", parentId: "ceo" },
    { id: "lead", parentId: "manager" },
    { id: "employee", parentId: "lead" }
  ]);

  assert.equal(depthMap.get("ceo"), 0);
  assert.equal(depthMap.get("manager"), 1);
  assert.equal(depthMap.get("lead"), 2);
  assert.equal(depthMap.get("employee"), 3);
  assert.equal(getOrgNodeLevel(depthMap.get("ceo") ?? 0), "executive");
  assert.equal(getOrgNodeLevel(depthMap.get("manager") ?? 0), "manager");
  assert.equal(getOrgNodeLevel(depthMap.get("lead") ?? 0), "lead");
  assert.equal(getOrgNodeLevel(depthMap.get("employee") ?? 0), "employee");
});

test("org document grouping separates role and global resources", () => {
  const grouped = groupOrgDocuments([
    { type: "JOB_DESCRIPTION" },
    { type: "WORK_INSTRUCTIONS" },
    { type: "POSITION_PROCESS" },
    { type: "POSITION_INSTRUCTION" },
    { type: "GLOBAL_PROCESS" },
    { type: "GLOBAL_INSTRUCTION" }
  ]);

  assert.equal(grouped.jobDescriptions.length, 1);
  assert.equal(grouped.workInstructions.length, 1);
  assert.equal(grouped.positionProcesses.length, 1);
  assert.equal(grouped.positionInstructions.length, 1);
  assert.equal(grouped.globalProcesses.length, 1);
  assert.equal(grouped.globalInstructions.length, 1);
});

test("org helpers stay deterministic under 100-node workloads", () => {
  const rows = Array.from({ length: 100 }, (_, index) => ({
    id: `node-${index}`,
    parentId: index === 0 ? null : `node-${Math.floor((index - 1) / 3)}`
  }));

  const depthMap = buildOrgDepthMap(rows);
  assert.equal(depthMap.size, 100);
  assert.ok([...depthMap.values()].every((depth) => depth >= 0));
  assert.equal(normalizeOrgSearchText("  Proces  "), "proces");
});
