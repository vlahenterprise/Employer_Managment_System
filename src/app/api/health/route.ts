import { NextResponse } from "next/server";
import { config } from "@/server/config";
import { prisma } from "@/server/db";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hasPrivilegedAccess(request: Request) {
  if (process.env.NODE_ENV !== "production") return true;
  const secret = config.backup.cronSecret;
  if (!secret) return false;
  const authorization = request.headers.get("authorization") || "";
  return authorization === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  const basic = {
    ok: true,
    ts: new Date().toISOString()
  };

  if (!hasPrivilegedAccess(request)) {
    return NextResponse.json(basic);
  }

  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbLatencyMs = Date.now() - start;
    const lastBackup = await prisma.backupSnapshot.findFirst({
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, source: true, completedAt: true, failedAt: true }
    });

    return NextResponse.json({
      ...basic,
      db: { ok: true, latencyMs: dbLatencyMs },
      lastBackup: lastBackup
        ? {
            at: lastBackup.createdAt,
            source: lastBackup.source,
            completed: !!lastBackup.completedAt,
            failed: !!lastBackup.failedAt
          }
        : null
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 503 });
  }
}
