"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireActiveUser } from "@/server/current-user";
import { checkDailyReportExists, deleteDailyReport, saveDailyReport } from "@/server/reports";
import { getRequestLang } from "@/i18n/server";
import { getI18n } from "@/i18n";
import { isManagerRole } from "@/server/rbac";

export async function checkDailyReportAction(dateIso: string) {
  const user = await requireActiveUser();
  return checkDailyReportExists(user.id, dateIso);
}

export async function saveDailyReportAction(params: { dateIso: string; activities: Array<{ type: string; desc: string; minutes: number }> }) {
  const user = await requireActiveUser();
  const res = await saveDailyReport({
    user,
    dateIso: params.dateIso,
    activities: params.activities
  });

  if (res.ok) {
    revalidatePath("/reports");
    revalidatePath("/reports/manager");
  }

  return res;
}

export async function deleteDailyReportAction(params: { dateIso: string; targetEmail?: string | null }) {
  const user = await requireActiveUser();
  const res = await deleteDailyReport({
    actor: { id: user.id, email: user.email, role: user.role },
    dateIso: params.dateIso,
    targetEmail: params.targetEmail
  });

  if (res.ok) {
    revalidatePath("/reports");
    revalidatePath("/reports/manager");
  }

  return res;
}

function redirectError(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function redirectSuccess(path: string, message: string): never {
  redirect(`${path}?success=${encodeURIComponent(message)}`);
}

export async function deleteDailyReportRedirectAction(formData: FormData) {
  const user = await requireActiveUser();
  const t = getI18n(getRequestLang());
  const dateIso = String(formData.get("dateIso") ?? "").trim();
  const targetEmail = String(formData.get("targetEmail") ?? "").trim();

  const res = await deleteDailyReport({
    actor: { id: user.id, email: user.email, role: user.role },
    dateIso,
    targetEmail: isManagerRole(user.role) ? (targetEmail || null) : null
  });

  if (!res.ok) redirectError("/reports/manager", t.reports.msgCannotDelete);

  revalidatePath("/reports/manager");
  redirectSuccess("/reports/manager", t.reports.msgDeleted);
}
