"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActiveUser } from "@/server/current-user";
import { createCompanyEvent, deleteCompanyEvent, parseCompanyCalendarForm, updateCompanyEvent } from "@/server/company-calendar";
import { withAction } from "@/server/action-utils";
import { notifyCompanyEventParticipants, syncCompanyEventWithGoogleCalendar, deleteCompanyEventFromCalendar } from "@/server/google-workspace";
import { logError } from "@/server/log";

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
  notifyCompanyEventParticipants(action.data.eventId).catch((err) => logError("email.company_event_notify_failed", err, { eventId: action.data.eventId }));
  syncCompanyEventWithGoogleCalendar(action.data.eventId).catch((err) => logError("calendar.company_event_sync_failed", err, { eventId: action.data.eventId }));
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
  notifyCompanyEventParticipants(parsed.data.eventId!, true).catch((err) => logError("email.company_event_update_notify_failed", err, { eventId: parsed.data.eventId }));
  syncCompanyEventWithGoogleCalendar(parsed.data.eventId!).catch((err) => logError("calendar.company_event_update_sync_failed", err, { eventId: parsed.data.eventId }));
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
  deleteCompanyEventFromCalendar(eventId).catch((err) => logError("calendar.company_event_delete_failed", err, { eventId }));
  redirectSuccess("Događaj je uklonjen iz aktivnog kalendara.");
}
