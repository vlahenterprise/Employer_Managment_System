import { config } from "@/server/config";
import { runDailyReportReminderEmails } from "@/server/google-workspace";
import { logError, logInfo, logWarn } from "@/server/log";
import { getRequestId } from "@/server/request-meta";

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
    logWarn("report_reminder.cron.unauthorized", { requestId });
    return Response.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const result = await runDailyReportReminderEmails();
    logInfo("report_reminder.cron.completed", { requestId, ...result });
    return Response.json(result, {
      status: 200,
      headers: { "Cache-Control": "no-store", "x-request-id": requestId }
    });
  } catch (error) {
    logError("report_reminder.cron.failed", error, { requestId });
    return Response.json(
      { ok: false, error: "REPORT_REMINDER_CRON_FAILED" },
      { status: 500, headers: { "x-request-id": requestId } }
    );
  }
}
