"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireActiveUser } from "@/server/current-user";
import { approveAbsence, cancelAbsence, submitAbsenceRequest } from "@/server/absence";
import { z } from "zod";
import { normalizeIsoDate } from "@/server/iso-date";
import { withAction } from "@/server/action-utils";
import { notifyAbsenceSubmitted } from "@/server/google-workspace";
import { logError } from "@/server/log";

function redirectError(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function redirectSuccess(path: string, message: string): never {
  redirect(`${path}?success=${encodeURIComponent(message)}`);
}

const typeSchema = z.enum(["ANNUAL_LEAVE", "HOME_OFFICE", "SLAVA", "OTHER", "SICK"]);

export async function submitAbsenceAction(formData: FormData) {
  const user = await requireActiveUser();
  const typeRaw = String(formData.get("type") ?? "");
  const fromIsoRaw = String(formData.get("fromIso") ?? "");
  const toIsoRaw = String(formData.get("toIso") ?? "");
  const comment = String(formData.get("comment") ?? "");

  const typeParsed = typeSchema.safeParse(typeRaw.trim().toUpperCase());
  if (!typeParsed.success) redirectError("/absence", "INVALID_TYPE");

  const fromIso = normalizeIsoDate(fromIsoRaw);
  const toIso = normalizeIsoDate(toIsoRaw);
  if (!fromIso || !toIso) redirectError("/absence", "INVALID_DATE");

  const action = await withAction(
    () =>
      submitAbsenceRequest({
        actor: { id: user.id, email: user.email, name: user.name, role: user.role, teamId: user.teamId },
        payload: { type: typeParsed.data as any, fromIso, toIso, comment }
      }),
    "absence.submit"
  );
  if (!action.ok) redirectError("/absence", action.error);
  const res = action.data;

  if (!res.ok) redirectError("/absence", res.error);

  revalidatePath("/absence");
  notifyAbsenceSubmitted(res.absenceId).catch((err) => logError("email.absence_notify_failed", err, { absenceId: res.absenceId }));
  const overlapMsg = res.overlap.count > 0 ? `OVERLAP:${res.overlap.count}` : "SUBMITTED";
  redirectSuccess("/absence", overlapMsg);
}

export async function approveAbsenceAction(formData: FormData) {
  const user = await requireActiveUser();
  const absenceId = String(formData.get("absenceId") ?? "").trim();
  const comment = String(formData.get("comment") ?? "");
  const status = String(formData.get("status") ?? "").trim().toUpperCase();
  if (!absenceId) redirectError("/absence", "ABSENCE_NOT_FOUND");
  if (status !== "APPROVED" && status !== "REJECTED") redirectError("/absence", "INVALID_STATUS");

  const action = await withAction(
    () =>
      approveAbsence({
        actor: { id: user.id, email: user.email, name: user.name, role: user.role },
        absenceId,
        comment,
        status: status as any
      }),
    "absence.approve"
  );
  if (!action.ok) redirectError("/absence", action.error);
  const res = action.data;
  if (!res.ok) redirectError("/absence", res.error);

  revalidatePath("/absence");
  redirectSuccess("/absence", status);
}

export async function cancelAbsenceAction(formData: FormData) {
  const user = await requireActiveUser();
  const absenceId = String(formData.get("absenceId") ?? "").trim();
  const comment = String(formData.get("comment") ?? "");
  if (!absenceId) redirectError("/absence", "ABSENCE_NOT_FOUND");

  const action = await withAction(
    () =>
      cancelAbsence({
        actor: { id: user.id, email: user.email, name: user.name, role: user.role },
        absenceId,
        comment
      }),
    "absence.cancel"
  );
  if (!action.ok) redirectError("/absence", action.error);
  const res = action.data;
  if (!res.ok) redirectError("/absence", res.error);

  revalidatePath("/absence");
  redirectSuccess("/absence", "CANCELLED");
}
