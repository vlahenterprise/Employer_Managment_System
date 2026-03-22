import test from "node:test";
import assert from "node:assert/strict";
import {
  buildOrgPathMap,
  buildOrgDepthMap,
  getOrgNodeLevel,
  groupOrgDocuments,
  groupOrgNodeIdsByLevel,
  inferOrgPositionTier,
  mapOrgTierToNodeLevel,
  normalizeOrgSearchText
} from "../src/lib/org-system";

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
  assert.equal(getOrgNodeLevel(depthMap.get("ceo") ?? 0), "director");
  assert.equal(getOrgNodeLevel(depthMap.get("manager") ?? 0), "manager");
  assert.equal(getOrgNodeLevel(depthMap.get("lead") ?? 0), "lead");
  assert.equal(getOrgNodeLevel(depthMap.get("employee") ?? 0), "supervisor");
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

test("org path mapping returns stable breadcrumbs", () => {
  const pathMap = buildOrgPathMap([
    { id: "director", title: "Generalni direktor", parentId: null },
    { id: "manager", title: "Menadžer operacija", parentId: "director" },
    { id: "lead", title: "Lider tima", parentId: "manager" },
    { id: "staff", title: "Specijalista", parentId: "lead" }
  ]);

  assert.deepEqual(pathMap.get("director"), ["Generalni direktor"]);
  assert.deepEqual(pathMap.get("manager"), ["Generalni direktor", "Menadžer operacija"]);
  assert.deepEqual(pathMap.get("staff"), ["Generalni direktor", "Menadžer operacija", "Lider tima", "Specijalista"]);
});

test("org level grouping keeps ids grouped by role tier", () => {
  const grouped = groupOrgNodeIdsByLevel([
    { id: "ceo", level: "director" as const },
    { id: "mgr-1", level: "manager" as const },
    { id: "mgr-2", level: "manager" as const },
    { id: "lead-1", level: "lead" as const },
    { id: "sup-1", level: "supervisor" as const },
    { id: "emp-1", level: "staff" as const }
  ]);

  assert.deepEqual(grouped.director, ["ceo"]);
  assert.deepEqual(grouped.manager, ["mgr-1", "mgr-2"]);
  assert.deepEqual(grouped.lead, ["lead-1"]);
  assert.deepEqual(grouped.supervisor, ["sup-1"]);
  assert.deepEqual(grouped.staff, ["emp-1"]);
});

test("org tier inference matches current company hierarchy semantics", () => {
  assert.equal(inferOrgPositionTier("Generalni direktor"), "DIRECTOR");
  assert.equal(inferOrgPositionTier("Direktor operacija"), "MANAGER");
  assert.equal(inferOrgPositionTier("Menadžer organizacije i sistema"), "MANAGER");
  assert.equal(inferOrgPositionTier("Rukovodilac marketinga"), "LEAD");
  assert.equal(inferOrgPositionTier("Supervizor sadržaja"), "SUPERVISOR");
  assert.equal(inferOrgPositionTier("Specijalista za profitabilnost"), "STAFF");
  assert.equal(mapOrgTierToNodeLevel("SUPERVISOR"), "supervisor");
});
