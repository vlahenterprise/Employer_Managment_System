"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActiveUser } from "@/server/current-user";
import { addOnboardingItem, toggleOnboardingItem, updateOnboarding } from "@/server/onboarding";

function actorPayload(user: Awaited<ReturnType<typeof requireActiveUser>>) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    hrAddon: user.hrAddon,
    adminAddon: user.adminAddon
  } as const;
}

function redirectError(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function redirectSuccess(path: string, message: string): never {
  redirect(`${path}?success=${encodeURIComponent(message)}`);
}

export async function updateOnboardingAction(formData: FormData) {
  const user = await requireActiveUser();
  const onboardingId = String(formData.get("onboardingId") ?? "").trim();
  const res = await updateOnboarding({
    actor: actorPayload(user),
    onboardingId,
    status: String(formData.get("status") ?? "").trim().toUpperCase() as any,
    startDate: String(formData.get("startDate") ?? "").trim() || null,
    note: String(formData.get("note") ?? "").trim() || null,
    employeeId: String(formData.get("employeeId") ?? "").trim() || null,
    jobDescriptionUrl: String(formData.get("jobDescriptionUrl") ?? "").trim() || null,
    workInstructionsUrl: String(formData.get("workInstructionsUrl") ?? "").trim() || null,
    onboardingDocsUrl: String(formData.get("onboardingDocsUrl") ?? "").trim() || null
  });
  if (!res.ok) redirectError(`/onboarding/${onboardingId}`, res.error);
  revalidatePath("/onboarding");
  revalidatePath(`/onboarding/${onboardingId}`);
  redirectSuccess(`/onboarding/${onboardingId}`, "ONBOARDING_UPDATED");
}

export async function addOnboardingItemAction(formData: FormData) {
  const user = await requireActiveUser();
  const onboardingId = String(formData.get("onboardingId") ?? "").trim();
  const res = await addOnboardingItem({
    actor: actorPayload(user),
    onboardingId,
    title: String(formData.get("title") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim() || null,
    ownerType: String(formData.get("ownerType") ?? "SHARED").trim().toUpperCase() as any,
    driveUrl: String(formData.get("driveUrl") ?? "").trim() || null
  });
  if (!res.ok) redirectError(`/onboarding/${onboardingId}`, res.error);
  revalidatePath("/onboarding");
  revalidatePath(`/onboarding/${onboardingId}`);
  redirectSuccess(`/onboarding/${onboardingId}`, "ITEM_ADDED");
}

export async function toggleOnboardingItemAction(formData: FormData) {
  const user = await requireActiveUser();
  const itemId = String(formData.get("itemId") ?? "").trim();
  const onboardingId = String(formData.get("onboardingId") ?? "").trim();
  const res = await toggleOnboardingItem({
    actor: actorPayload(user),
    itemId,
    completed: formData.get("completed") != null
  });
  if (!res.ok) redirectError(`/onboarding/${onboardingId}`, res.error);
  revalidatePath("/onboarding");
  revalidatePath(`/onboarding/${onboardingId}`);
  redirectSuccess(`/onboarding/${onboardingId}`, "ITEM_UPDATED");
}
