import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbLatencyMs = Date.now() - start;
    const lastBackup = await prisma.backupSnapshot.findFirst({
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, source: true, completedAt: true, failedAt: true }
    });

    return NextResponse.json({
      ok: true,
      ts: new Date().toISOString(),
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
