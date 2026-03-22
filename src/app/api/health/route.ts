import { prisma } from "@/server/db";
import { logError } from "@/server/log";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const includeDb = url.searchParams.get("db") === "1";
  const startedAt = Date.now();

  if (!includeDb) {
    return Response.json({
      ok: true,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startedAt
    });
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({
      ok: true,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      db: { ok: true }
    });
  } catch (error) {
    logError("health.db.failed", error);
    return Response.json(
      {
        ok: false,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
        db: { ok: false }
      },
      { status: 500 }
    );
  }
}
