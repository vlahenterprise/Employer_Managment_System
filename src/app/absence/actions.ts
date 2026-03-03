"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireActiveUser } from "@/server/current-user";
import { approveAbsence, cancelAbsence, submitAbsenceRequest } from "@/server/absence";
import { z } from "zod";
import { normalizeIsoDate } from "@/server/iso-date";

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

  const res = await submitAbsenceRequest({
    actor: { id: user.id, email: user.email, name: user.name, role: user.role, teamId: user.teamId },
    payload: { type: typeParsed.data as any, fromIso, toIso, comment }
  });

  if (!res.ok) redirectError("/absence", res.error);

  revalidatePath("/absence");
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

  const res = await approveAbsence({
    actor: { id: user.id, email: user.email, name: user.name, role: user.role },
    absenceId,
    comment,
    status: status as any
  });
  if (!res.ok) redirectError("/absence", res.error);

  revalidatePath("/absence");
  redirectSuccess("/absence", status);
}

export async function cancelAbsenceAction(formData: FormData) {
  const user = await requireActiveUser();
  const absenceId = String(formData.get("absenceId") ?? "").trim();
  const comment = String(formData.get("comment") ?? "");
  if (!absenceId) redirectError("/absence", "ABSENCE_NOT_FOUND");

  const res = await cancelAbsence({
    actor: { id: user.id, email: user.email, name: user.name, role: user.role },
    absenceId,
    comment
  });
  if (!res.ok) redirectError("/absence", res.error);

  revalidatePath("/absence");
  redirectSuccess("/absence", "CANCELLED");
}
