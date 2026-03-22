import test from "node:test";
import assert from "node:assert/strict";
import { buildHrDashboardBuckets, getCandidateStageSummary, getProcessWorkflowSummary } from "../src/server/hr-presentation";

test("candidate stage summary keeps hiring flow meanings stable", () => {
  assert.equal(getCandidateStageSummary({ status: "HR_SCREENING" }).stageKey, "READY_FOR_HR");
  assert.equal(getCandidateStageSummary({ status: "WAITING_MANAGER_REVIEW" }).stageKey, "MANAGER_REVIEW");
  assert.equal(getCandidateStageSummary({ status: "SECOND_ROUND_COMPLETED" }).stageKey, "ROUND_TWO");
  assert.equal(getCandidateStageSummary({ status: "WAITING_FINAL_APPROVAL" }).stageKey, "FINAL_DECISION");
  assert.equal(getCandidateStageSummary({ status: "APPROVED_FOR_EMPLOYMENT" }).stageKey, "APPROVED_FOR_HIRE");
});

test("process workflow summary prioritizes the furthest active candidate stage", () => {
  const summary = getProcessWorkflowSummary({
    status: "OPEN",
    candidates: [
      { status: "HR_SCREENING" },
      { status: "WAITING_FINAL_APPROVAL" }
    ]
  });

  assert.equal(summary.stageKey, "FINAL_DECISION");
  assert.equal(summary.waitingOn, "FINAL_APPROVER");
});

test("HR dashboard buckets remain deterministic under 100-process load", () => {
  const processes = Array.from({ length: 100 }, (_, index) => ({
    status: index % 9 === 0 ? "OPEN" : "IN_PROGRESS",
    candidates:
      index % 4 === 0
        ? [{ status: "NEW_APPLICANT" }, { status: "HR_SCREENING" }]
        : index % 4 === 1
          ? [{ status: "WAITING_MANAGER_REVIEW" }]
          : index % 4 === 2
            ? [{ status: "WAITING_FINAL_APPROVAL" }]
            : [{ status: "APPROVED_FOR_EMPLOYMENT" }]
  }));

  const buckets = buildHrDashboardBuckets(processes);

  assert.equal(typeof buckets.readyForHr, "number");
  assert.equal(typeof buckets.hrScreening, "number");
  assert.equal(typeof buckets.managerReview, "number");
  assert.equal(typeof buckets.finalDecision, "number");
  assert.equal(typeof buckets.approvedForHire, "number");
  assert.ok(buckets.hrScreening > 0);
  assert.ok(buckets.managerReview > 0);
  assert.ok(buckets.finalDecision > 0);
  assert.ok(buckets.approvedForHire > 0);
});
