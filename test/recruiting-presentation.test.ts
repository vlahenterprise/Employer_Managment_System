import test from "node:test";
import assert from "node:assert/strict";
import {
  getCandidateStageOptions,
  isActiveCandidateStatus,
  isTalentPoolCandidateStatus
} from "../src/server/recruiting-presentation";

test("candidate status helpers keep active vs talent pool semantics distinct", () => {
  assert.equal(isActiveCandidateStatus("HR_SCREENING"), true);
  assert.equal(isActiveCandidateStatus("WAITING_FINAL_APPROVAL"), true);
  assert.equal(isActiveCandidateStatus("ARCHIVED"), false);

  assert.equal(isTalentPoolCandidateStatus("ARCHIVED"), true);
  assert.equal(isTalentPoolCandidateStatus("REJECTED_FINAL"), true);
  assert.equal(isTalentPoolCandidateStatus("NEW_APPLICANT"), false);
});

test("candidate stage options remain localized and deterministic under repeated generation", () => {
  const sr = getCandidateStageOptions("sr");
  const en = getCandidateStageOptions("en");

  assert.equal(sr[0]?.value, "ALL");
  assert.equal(en[0]?.value, "ALL");
  assert.ok(sr.some((option) => option.value === "WAITING_FINAL_APPROVAL"));
  assert.ok(en.some((option) => option.value === "APPROVED_FOR_EMPLOYMENT"));

  const repeated = Array.from({ length: 100 }, (_, index) => getCandidateStageOptions(index % 2 === 0 ? "sr" : "en"));
  for (const items of repeated) {
    assert.equal(new Set(items.map((item) => item.value)).size, items.length);
  }
});
