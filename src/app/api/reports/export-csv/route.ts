import { getServerSession } from "next-auth/next";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";
import { checkRouteRateLimit } from "@/server/route-rate-limit";

export async function GET(request: Request) {
  // Rate limiting
  const rl = await checkRouteRateLimit({
    request,
    scope: "reports-csv",
    limit: 10,
    windowMs: 60_000
  });
  if (!rl.ok) {
    return new Response("Too many requests", {
      status: 429,
      headers: { "Retry-After": String(rl.retryAfterSeconds) }
    });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = (session.user as any).id as string;
  const { searchParams } = new URL(request.url);

  // Opcioni parametri: dateFrom, dateTo
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  const where: any = { userId };
  if (dateFrom) where.dateIso = { ...where.dateIso, gte: dateFrom };
  if (dateTo) where.dateIso = { ...where.dateIso, lte: dateTo };

  const reports = await prisma.dailyReport.findMany({
    where,
    orderBy: { dateIso: "desc" },
    take: 500, // max 500 izveštaja po exportu
    select: {
      dateIso: true,
      totalMinutes: true,
      activities: {
        select: { type: true, desc: true, minutes: true }
      }
    }
  });

  // Generisanje CSV
  const lines: string[] = [];
  lines.push("Datum,Ukupno minuta,Aktivnost,Opis,Minuti");

  for (const report of reports) {
    if (report.activities.length === 0) {
      lines.push(`${report.dateIso},${report.totalMinutes},,,`);
    } else {
      for (const activity of report.activities) {
        const desc = `"${(activity.desc ?? "").replace(/"/g, '""')}"`;
        lines.push(`${report.dateIso},${report.totalMinutes},${activity.type},${desc},${activity.minutes}`);
      }
    }
  }

  const csv = lines.join("\n");
  const today = new Date().toISOString().split("T")[0];

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="izvestaji-${today}.csv"`,
      "Cache-Control": "no-store"
    }
  });
}
