import { logError } from "@/server/log";
import { runBackupIfDue } from "@/server/backup-scheduler";

export const runtime = "nodejs";

function isAuthorized(request: Request) {
  const expected = String(process.env.CRON_SECRET || "").trim();
  if (!expected) return process.env.NODE_ENV !== "production";
  const authorization = request.headers.get("authorization") || "";
  return authorization === `Bearer ${expected}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const result = await runBackupIfDue();
    return Response.json(result, {
      status: result.ok ? 200 : 500,
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    logError("backup.cron.route.failed", error);
    return Response.json({ ok: false, error: "BACKUP_FAILED" }, { status: 500 });
  }
}
