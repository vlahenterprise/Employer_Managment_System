import { NextResponse } from "next/server";
import { requireActiveUser } from "@/server/current-user";
import { checkAbsenceOverlap } from "@/server/absence";

export async function GET(request: Request) {
  const user = await requireActiveUser();
  const { searchParams } = new URL(request.url);
  const fromIso = String(searchParams.get("fromIso") || "").trim();
  const toIso = String(searchParams.get("toIso") || "").trim();

  if (!fromIso || !toIso) {
    return NextResponse.json({ ok: false, error: "INVALID_DATE" }, { status: 400 });
  }

  const result = await checkAbsenceOverlap({
    actor: { id: user.id, teamId: user.teamId },
    fromIso,
    toIso
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
