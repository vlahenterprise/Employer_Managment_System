import test from "node:test";
import assert from "node:assert/strict";
import {
  buildOnboardingDueDate,
  isOnboardingPhaseReadyForClose,
  normalizeOnboardingLinks,
  parseOnboardingLinksInput,
  serializeOnboardingLinksInput
} from "../src/lib/onboarding";

test("onboarding link helpers normalize multiline Drive resources", () => {
  const parsed = parseOnboardingLinksInput(
    "Job description | https://drive.google.com/file/d/123/view\nhttps://docs.google.com/document/d/456/edit"
  );

  assert.equal(parsed.length, 2);
  assert.equal(parsed[0]?.label, "Job description");
  assert.match(parsed[1]?.url || "", /docs\.google\.com/);

  const serialized = serializeOnboardingLinksInput(parsed);
  assert.match(serialized, /Job description \| https:\/\/drive\.google\.com/);
  assert.match(serialized, /docs\.google\.com/);
});

test("onboarding phase close requires completion and required confirmations", () => {
  assert.equal(
    isOnboardingPhaseReadyForClose({
      isCompleted: false,
      hrConfirmationRequired: true,
      managerConfirmationRequired: true,
      hrConfirmedAt: new Date(),
      managerConfirmedAt: new Date()
    }),
    false
  );

  assert.equal(
    isOnboardingPhaseReadyForClose({
      isCompleted: true,
      hrConfirmationRequired: true,
      managerConfirmationRequired: true,
      hrConfirmedAt: new Date(),
      managerConfirmedAt: new Date()
    }),
    true
  );

  assert.equal(
    isOnboardingPhaseReadyForClose({
      isCompleted: true,
      hrConfirmationRequired: true,
      managerConfirmationRequired: false,
      hrConfirmedAt: null,
      managerConfirmedAt: null
    }),
    false
  );
});

test("onboarding due date helper stays deterministic for repeated assignments", () => {
  const base = new Date("2026-04-01T00:00:00.000Z");
  const dates = Array.from({ length: 100 }, (_, index) => buildOnboardingDueDate(base, index));

  assert.equal(dates[0]?.toISOString(), "2026-04-01T00:00:00.000Z");
  assert.equal(dates[29]?.toISOString(), "2026-04-30T00:00:00.000Z");
  assert.equal(dates[99]?.toISOString(), "2026-07-09T00:00:00.000Z");
  assert.deepEqual(
    normalizeOnboardingLinks([{ label: "Docs", url: "https://drive.google.com/file/d/789/view" }]),
    [{ label: "Docs", url: "https://drive.google.com/file/d/789/view" }]
  );
});
