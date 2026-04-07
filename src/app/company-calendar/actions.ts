"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActiveUser } from "@/server/current-user";
import { createCompanyEvent, deleteCompanyEvent, parseCompanyCalendarForm, updateCompanyEvent } from "@/server/company-calendar";
import { withAction } from "@/server/action-utils";

const BASE_PATH = "/company-calendar";

function redirectError(message: string): never {
  redirect(`${BASE_PATH}?error=${encodeURIComponent(message)}`);
}

function redirectSuccess(message: string): never {
  redirect(`${BASE_PATH}?success=${encodeURIComponent(message)}`);
}

function actorFromUser(user: Awaited<ReturnType<typeof requireActiveUser>>) {
  return { id: user.id, role: user.role, companyCalendarAddon: user.companyCalendarAddon };
}

export async function createCompanyEventAction(formData: FormData) {
  const user = await requireActiveUser();
  const parsed = parseCompanyCalendarForm(formData);
  if (!parsed.success) redirectError("Proveri naziv, datum i vreme događaja.");

  const action = await withAction(
    () => createCompanyEvent({ actor: actorFromUser(user), payload: parsed.data }),
    "company-calendar.create"
  );
  if (!action.ok) redirectError(action.error);
  if (!action.data.ok) redirectError(action.data.error);

  revalidatePath(BASE_PATH);
  redirectSuccess("Događaj je dodat u kompanijski kalendar.");
}

export async function updateCompanyEventAction(formData: FormData) {
  const user = await requireActiveUser();
  const parsed = parseCompanyCalendarForm(formData);
  if (!parsed.success || !parsed.data.eventId) redirectError("Proveri događaj, datum i vreme.");

  const action = await withAction(
    () => updateCompanyEvent({ actor: actorFromUser(user), payload: { ...parsed.data, eventId: parsed.data.eventId! } }),
    "company-calendar.update"
  );
  if (!action.ok) redirectError(action.error);
  if (!action.data.ok) redirectError(action.data.error);

  revalidatePath(BASE_PATH);
  redirectSuccess("Događaj je sačuvan.");
}

export async function deleteCompanyEventAction(formData: FormData) {
  const user = await requireActiveUser();
  const eventId = String(formData.get("eventId") ?? "").trim();
  if (!eventId) redirectError("Događaj nije pronađen.");

  const action = await withAction(
    () => deleteCompanyEvent({ actor: actorFromUser(user), eventId }),
    "company-calendar.delete"
  );
  if (!action.ok) redirectError(action.error);
  if (!action.data.ok) redirectError(action.data.error);

  revalidatePath(BASE_PATH);
  redirectSuccess("Događaj je uklonjen iz aktivnog kalendara.");
}
