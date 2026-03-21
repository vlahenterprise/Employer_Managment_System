import test from "node:test";
import assert from "node:assert/strict";
import { parseTimeHHMM, shouldRunScheduledBackup, truthy } from "../src/server/backup-scheduler-utils";

test("parseTimeHHMM validates backup schedule format", () => {
  assert.equal(parseTimeHHMM("02:30"), "02:30");
  assert.equal(parseTimeHHMM("24:00"), null);
  assert.equal(parseTimeHHMM("2:30"), null);
});

test("truthy supports settings values used across app", () => {
  assert.equal(truthy("1"), true);
  assert.equal(truthy("yes"), true);
  assert.equal(truthy("0"), false);
});

test("shouldRunScheduledBackup respects enablement, time, and last run date", () => {
  assert.equal(
    shouldRunScheduledBackup({
      enabled: true,
      backupTime: "02:00",
      lastRunIso: "",
      now: { dateIso: "2026-03-21", timeHHMM: "03:00" }
    }),
    true
  );

  assert.equal(
    shouldRunScheduledBackup({
      enabled: true,
      backupTime: "02:00",
      lastRunIso: "2026-03-21",
      now: { dateIso: "2026-03-21", timeHHMM: "03:00" }
    }),
    false
  );

  assert.equal(
    shouldRunScheduledBackup({
      enabled: false,
      backupTime: "02:00",
      lastRunIso: "",
      now: { dateIso: "2026-03-21", timeHHMM: "03:00" }
    }),
    false
  );
});
