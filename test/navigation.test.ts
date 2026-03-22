import test from "node:test";
import assert from "node:assert/strict";
import { getPrimaryNavigation } from "../src/server/navigation-core";

test("navigation stays unique across supported access combinations", () => {
  const actors = [
    { role: "USER", hrAddon: false, adminAddon: false },
    { role: "MANAGER", hrAddon: false, adminAddon: false },
    { role: "USER", hrAddon: true, adminAddon: false },
    { role: "MANAGER", hrAddon: true, adminAddon: false },
    { role: "USER", hrAddon: false, adminAddon: true },
    { role: "MANAGER", hrAddon: false, adminAddon: true },
    { role: "USER", hrAddon: true, adminAddon: true },
    { role: "MANAGER", hrAddon: true, adminAddon: true }
  ] as const;

  for (const actor of actors) {
    const items = getPrimaryNavigation(actor, "en");
    const hrefs = items.map((item) => item.href);
    assert.equal(new Set(hrefs).size, hrefs.length, `duplicate hrefs for ${JSON.stringify(actor)}`);
    assert.equal(hrefs[0], "/dashboard");
    assert.ok(hrefs.includes("/organization"));
    assert.ok(hrefs.includes("/profile"));
    assert.ok(hrefs.includes("/inbox"));

    if (actor.role === "MANAGER") {
      assert.ok(hrefs.includes("/management"));
      assert.ok(hrefs.includes("/team"));
    } else {
      assert.ok(!hrefs.includes("/management"));
      assert.ok(!hrefs.includes("/team"));
    }

    if (actor.hrAddon) {
      assert.ok(hrefs.includes("/hr"));
      assert.ok(hrefs.includes("/candidates"));
      assert.ok(hrefs.includes("/talent-pool"));
      assert.ok(hrefs.includes("/onboarding"));
    } else {
      assert.ok(!hrefs.includes("/hr"));
    }

    if (actor.adminAddon) {
      assert.ok(hrefs.includes("/access"));
      assert.ok(hrefs.includes("/admin/settings"));
    } else {
      assert.ok(!hrefs.includes("/access"));
    }
  }
});

test("navigation remains deterministic under 100 repeated access builds", async () => {
  const actors = Array.from({ length: 100 }, (_, index) => ({
    role: index % 2 === 0 ? "MANAGER" : "USER",
    hrAddon: index % 3 === 0,
    adminAddon: index % 5 === 0
  })) as Array<{ role: "USER" | "MANAGER"; hrAddon: boolean; adminAddon: boolean }>;

  const outputs = await Promise.all(
    actors.map(async (actor) => getPrimaryNavigation(actor, indexLang(actor)))
  );

  for (const items of outputs) {
    const hrefs = items.map((item) => item.href);
    assert.equal(new Set(hrefs).size, hrefs.length);
    assert.ok(hrefs.includes("/dashboard"));
    assert.ok(hrefs.includes("/organization"));
  }
});

function indexLang(actor: { role: "USER" | "MANAGER"; hrAddon: boolean; adminAddon: boolean }) {
  return actor.hrAddon || actor.adminAddon ? "en" : "sr";
}
