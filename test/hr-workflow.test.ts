import test from "node:test";
import assert from "node:assert/strict";
import {
  getCandidateSemanticMeta,
  getProcessSemanticMeta,
  getSourceGroup,
  parseLines,
  scoreAverage
} from "../src/server/hr-workflow";

test("HR workflow semantics expose owner and next action without changing raw statuses", () => {
  const process = getProcessSemanticMeta({ status: "DRAFT", openedAt: new Date(Date.now() - 2 * 86400000) }, "sr");
  assert.equal(process.key, "PENDING_APPROVAL");
  assert.equal(process.owner, "SUPERIOR");
  assert.ok(process.waitingDays >= 1);

  const candidate = getCandidateSemanticMeta({ status: "ON_HOLD", updatedAt: new Date() }, "en");
  assert.equal(candidate.key, "ON_HOLD");
  assert.equal(candidate.owner, "HR");
});

test("HR workflow helpers normalize structured candidate inputs", () => {
  assert.equal(getSourceGroup("linkedin"), "SOCIAL");
  assert.deepEqual(parseLines("CRM, English\nSales"), ["CRM", "English", "Sales"]);
  assert.equal(scoreAverage({ communication: 5, cultureFit: 4, empty: "" }), 4.5);
  assert.equal(scoreAverage({ empty: "" }), null);
});
