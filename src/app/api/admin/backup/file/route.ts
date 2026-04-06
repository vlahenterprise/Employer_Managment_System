import { getServerSession } from "next-auth/next";
import { authOptions } from "@/server/auth";
import { config } from "@/server/config";
import { prisma } from "@/server/db";
import { readBackupFile } from "@/server/backup";
import { logError, logWarn } from "@/server/log";
import { hasAdminAddon } from "@/server/rbac";
import { checkRouteRateLimit } from "@/server/route-rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
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

  const rateLimit = await checkRouteRateLimit({
    request: req,
    scope: "backup-file",
    actorId: userId,
    limit: config.backup.routeLimitPerMinute
  });
  if (!rateLimit.ok) {
    logWarn("backup.file.rate_limited", { requestId: rateLimit.requestId, actorId: userId });
    return new Response("Too Many Requests", {
      status: 429,
      headers: {
        "Retry-After": String(rateLimit.retryAfterSeconds),
        "x-request-id": rateLimit.requestId
      }
    });
  }

  const url = new URL(req.url);
  const name = url.searchParams.get("name") ?? "";
  if (!name.trim()) return new Response("Missing name", { status: 400 });

  const folderRow = await prisma.setting.findUnique({
    where: { key: "BackupFolder" },
    select: { value: true }
  });
  const folder = folderRow?.value?.trim() || "backups";

  try {
    const { filename, bytes } = await readBackupFile({ folder, name });
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
        "x-request-id": rateLimit.requestId
      }
    });
  } catch (error) {
    logError("backup.file.failed", error, { requestId: rateLimit.requestId, actorId: userId, name });
    return new Response(`Cannot read backup: ${String((error as any)?.message || error)}`, {
      status: 404,
      headers: { "x-request-id": rateLimit.requestId }
    });
  }
}
