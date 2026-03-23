import { config } from "@/server/config";
import { logError, logInfo, logWarn } from "@/server/log";
import { getRequestId } from "@/server/request-meta";
import { runBackupIfDue } from "@/server/backup-scheduler";

export const runtime = "nodejs";
export const maxDuration = 60;

function isAuthorized(request: Request) {
  const expected = config.backup.cronSecret;
  if (!expected) return process.env.NODE_ENV !== "production";
  const authorization = request.headers.get("authorization") || "";
  return authorization === `Bearer ${expected}`;
}

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  if (!isAuthorized(request)) {
    logWarn("backup.cron.route.unauthorized", { requestId });
    return Response.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const result = await runBackupIfDue();
    logInfo("backup.cron.route.completed", {
      requestId,
      ran: result.ran,
      ok: result.ok,
      duplicate: "duplicate" in result ? result.duplicate : false
    });
    return Response.json(result, {
      status: result.ok ? 200 : 500,
      headers: {
        "Cache-Control": "no-store",
        "x-request-id": requestId
      }
    });
  } catch (error) {
    logError("backup.cron.route.failed", error, { requestId });
    return Response.json(
      { ok: false, error: "BACKUP_FAILED" },
      {
        status: 500,
        headers: { "x-request-id": requestId }
      }
    );
  }
}
