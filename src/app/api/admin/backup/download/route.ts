import { getServerSession } from "next-auth/next";
import { authOptions } from "@/server/auth";
import { config } from "@/server/config";
import { prisma } from "@/server/db";
import { createBackupZip } from "@/server/backup";
import { logError, logWarn } from "@/server/log";
import { hasAdminAddon } from "@/server/rbac";
import { checkRouteRateLimit } from "@/server/route-rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, status: true, adminAddon: true }
  });
  if (!user || user.status !== "ACTIVE" || !hasAdminAddon(user)) {
    return new Response("Forbidden", { status: 403 });
  }

  const rateLimit = checkRouteRateLimit({
    request,
    scope: "backup-download",
    actorId: userId,
    limit: config.backup.routeLimitPerMinute
  });
  if (!rateLimit.ok) {
    logWarn("backup.download.rate_limited", { requestId: rateLimit.requestId, actorId: userId });
    return new Response("Too Many Requests", {
      status: 429,
      headers: {
        "Retry-After": String(rateLimit.retryAfterSeconds),
        "x-request-id": rateLimit.requestId
      }
    });
  }

  try {
    const { filename, bytes } = await createBackupZip();
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
        "x-request-id": rateLimit.requestId
      }
    });
  } catch (error) {
    logError("backup.download.failed", error, { requestId: rateLimit.requestId, actorId: userId });
    return new Response("Cannot create backup", {
      status: 500,
      headers: { "x-request-id": rateLimit.requestId }
    });
  }
}
