import { loginWithCredentials } from "./http-session";

type RouteCheck = {
  path: string;
  label: string;
  requiresAuth?: boolean;
};

const baseUrl = String(process.env.BASE_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");
const email = String(process.env.TEST_USER_EMAIL || "").trim();
const password = String(process.env.TEST_USER_PASSWORD || "").trim();

const routes: RouteCheck[] = [
  { path: "/api/health", label: "health" },
  { path: "/api/health?db=1", label: "health-db" },
  { path: "/login", label: "login" },
  { path: "/dashboard", label: "dashboard", requiresAuth: true },
  { path: "/tasks", label: "tasks", requiresAuth: true },
  { path: "/reports/manager", label: "reports-manager", requiresAuth: true },
  { path: "/absence", label: "absence", requiresAuth: true },
  { path: "/performance", label: "performance", requiresAuth: true },
  { path: "/hr", label: "hr", requiresAuth: true },
  { path: "/onboarding", label: "onboarding", requiresAuth: true },
  { path: "/organization", label: "organization", requiresAuth: true },
  { path: "/admin/users", label: "admin-users", requiresAuth: true }
];

async function checkRoute(route: RouteCheck, cookieHeader?: string) {
  const startedAt = Date.now();
  const response = await fetch(`${baseUrl}${route.path}`, {
    headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
    redirect: "manual"
  });

  const durationMs = Date.now() - startedAt;
  const ok =
    response.ok ||
    (route.requiresAuth ? response.status === 307 || response.status === 302 : response.status < 400);

  if (!ok) {
    throw new Error(`${route.label} failed with status ${response.status}`);
  }

  return {
    label: route.label,
    status: response.status,
    durationMs
  };
}

async function main() {
  const authenticated = Boolean(email && password);
  const cookieHeader = authenticated ? (await loginWithCredentials({ baseUrl, email, password })).cookieHeader : "";

  if (!authenticated) {
    console.log("Smoke check: running public routes only (set TEST_USER_EMAIL / TEST_USER_PASSWORD for full auth flow).");
  }

  const selectedRoutes = routes.filter((route) => authenticated || !route.requiresAuth);
  const results = [];
  for (const route of selectedRoutes) {
    const result = await checkRoute(route, cookieHeader || undefined);
    results.push(result);
    console.log(`${result.label.padEnd(18)} ${String(result.status).padEnd(4)} ${result.durationMs}ms`);
  }

  const totalMs = results.reduce((sum, result) => sum + result.durationMs, 0);
  console.log(`Smoke check complete: ${results.length} route(s) passed in ${totalMs}ms.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
