import { loginWithCredentials } from "./http-session";

const baseUrl = String(process.env.BASE_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");
const route = String(process.env.LOAD_ROUTE || "/api/health").trim();
const concurrency = Math.max(1, Number.parseInt(String(process.env.LOAD_CONCURRENCY || "100"), 10) || 100);
const requests = Math.max(concurrency, Number.parseInt(String(process.env.LOAD_REQUESTS || String(concurrency * 3)), 10) || concurrency * 3);
const email = String(process.env.TEST_USER_EMAIL || "").trim();
const password = String(process.env.TEST_USER_PASSWORD || "").trim();

const authProtectedPrefixes = [
  "/dashboard",
  "/tasks",
  "/reports",
  "/absence",
  "/performance",
  "/hr",
  "/onboarding",
  "/organization",
  "/admin",
  "/management",
  "/inbox",
  "/team",
  "/profile",
  "/api/admin",
  "/api/reports",
  "/api/tasks",
  "/api/absence",
  "/api/performance",
  "/api/hr",
  "/api/management"
];

function percentile(values: number[], pct: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((pct / 100) * sorted.length) - 1));
  return sorted[index];
}

async function main() {
  const needsAuth = authProtectedPrefixes.some((prefix) => route.startsWith(prefix));
  const cookieHeader =
    needsAuth && email && password ? (await loginWithCredentials({ baseUrl, email, password })).cookieHeader : "";

  if (needsAuth && !cookieHeader) {
    throw new Error("This route requires auth. Set TEST_USER_EMAIL and TEST_USER_PASSWORD.");
  }

  const latencies: number[] = [];
  let completed = 0;
  let failures = 0;
  let nextIndex = 0;
  const startedAt = Date.now();

  async function worker() {
    while (true) {
      if (nextIndex >= requests) return;
      nextIndex += 1;
      const requestStartedAt = Date.now();
      try {
        const response = await fetch(`${baseUrl}${route}`, {
          headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
          redirect: "manual"
        });
        const durationMs = Date.now() - requestStartedAt;
        latencies.push(durationMs);
        completed += 1;
        if (!response.ok && response.status !== 302 && response.status !== 307) {
          failures += 1;
        }
      } catch {
        completed += 1;
        failures += 1;
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  const durationMs = Date.now() - startedAt;
  const successCount = Math.max(0, completed - failures);
  const max = latencies.length ? Math.max(...latencies) : 0;
  const avg = latencies.length ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length) : 0;

  console.log(`Load route: ${route}`);
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Concurrency: ${concurrency}`);
  console.log(`Requests: ${requests}`);
  console.log(`Success: ${Math.max(successCount, 0)}`);
  console.log(`Failures: ${failures}`);
  console.log(`Duration: ${durationMs}ms`);
  console.log(`Latency avg: ${avg}ms`);
  console.log(`Latency p50: ${percentile(latencies, 50)}ms`);
  console.log(`Latency p95: ${percentile(latencies, 95)}ms`);
  console.log(`Latency max: ${max}ms`);

  if (failures > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
