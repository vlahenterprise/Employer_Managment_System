import assert from "node:assert/strict";
import test from "node:test";
import { checkRouteRateLimit } from "../src/server/route-rate-limit";

test("checkRouteRateLimit limits repeated requests per actor", () => {
  const request = new Request("https://example.com/export");
  const first = checkRouteRateLimit({
    request,
    scope: "pdf",
    actorId: "user-1",
    limit: 2,
    windowMs: 60_000,
    now: 1000
  });
  const second = checkRouteRateLimit({
    request,
    scope: "pdf",
    actorId: "user-1",
    limit: 2,
    windowMs: 60_000,
    now: 1001
  });
  const third = checkRouteRateLimit({
    request,
    scope: "pdf",
    actorId: "user-1",
    limit: 2,
    windowMs: 60_000,
    now: 1002
  });

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(third.ok, false);
  assert.equal(third.retryAfterSeconds, 60);
});

test("checkRouteRateLimit resets after the window expires", () => {
  const request = new Request("https://example.com/export", {
    headers: { "x-forwarded-for": "203.0.113.7" }
  });

  checkRouteRateLimit({
    request,
    scope: "backup",
    limit: 1,
    windowMs: 10_000,
    now: 1000
  });

  const afterReset = checkRouteRateLimit({
    request,
    scope: "backup",
    limit: 1,
    windowMs: 10_000,
    now: 11_001
  });

  assert.equal(afterReset.ok, true);
  assert.equal(afterReset.remaining, 0);
});
