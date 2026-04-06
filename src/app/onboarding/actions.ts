"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActiveUser } from "@/server/current-user";
import { isHrModuleEnabled } from "@/server/features";
import { booleanish } from "@/server/validation";
import {
  addOnboardingItem,
  addOnboardingTemplateStep,
  assignOnboardingProcess,
  confirmOnboardingItem,
  createOrGetOnboardingTemplate,
  deleteOnboardingTemplateStep,
  toggleOnboardingItem,
  updateOnboarding,
  updateOnboardingItem,
  updateOnboardingTemplate,
  updateOnboardingTemplateStep,
  type OnboardingActor
} from "@/server/onboarding";

function actorPayload(user: Awaited<ReturnType<typeof requireActiveUser>>) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    hrAddon: user.hrAddon,
    adminAddon: user.adminAddon
  } satisfies OnboardingActor;
}

function redirectError(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function redirectSuccess(path: string, message: string): never {
  redirect(`${path}?success=${encodeURIComponent(message)}`);
}

function ensureHrModuleEnabled() {
  if (!isHrModuleEnabled()) {
    redirectError("/dashboard", "HR module is disabled");
  }
}

function refreshOnboardingPaths(targetPath?: string) {
  revalidatePath("/onboarding");
  revalidatePath("/profile");
  if (targetPath) revalidatePath(targetPath);
}

export async function updateOnboardingAction(formData: FormData) {
  ensureHrModuleEnabled();
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
  refreshOnboardingPaths(`/onboarding/${onboardingId}`);
  redirectSuccess(`/onboarding/${onboardingId}`, "ONBOARDING_UPDATED");
}

export async function createOnboardingTemplateAction(formData: FormData) {
  ensureHrModuleEnabled();
  const user = await requireActiveUser();
  const res = await createOrGetOnboardingTemplate({
    actor: actorPayload(user),
    positionId: String(formData.get("positionId") ?? "").trim()
  });
  if (!res.ok) redirectError("/onboarding", res.error);
  revalidatePath("/onboarding");
  redirect(`/onboarding/templates/${res.id}`);
}

export async function updateOnboardingTemplateAction(formData: FormData) {
  ensureHrModuleEnabled();
  const user = await requireActiveUser();
  const templateId = String(formData.get("templateId") ?? "").trim();
  const res = await updateOnboardingTemplate({
    actor: actorPayload(user),
    templateId,
    title: String(formData.get("title") ?? "").trim() || null,
    description: String(formData.get("description") ?? "").trim() || null,
    isActive: formData.get("isActive") != null
  });
  if (!res.ok) redirectError(`/onboarding/templates/${templateId}`, res.error);
  revalidatePath("/onboarding");
  revalidatePath(`/onboarding/templates/${templateId}`);
  redirectSuccess(`/onboarding/templates/${templateId}`, "TEMPLATE_UPDATED");
}

export async function addOnboardingTemplateStepAction(formData: FormData) {
  ensureHrModuleEnabled();
  const user = await requireActiveUser();
  const templateId = String(formData.get("templateId") ?? "").trim();
  const res = await addOnboardingTemplateStep({
    actor: actorPayload(user),
    templateId,
    title: String(formData.get("title") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim() || null,
    ownerType: String(formData.get("ownerType") ?? "SHARED").trim().toUpperCase() as any,
    dueOffsetDays: Number(formData.get("dueOffsetDays") ?? ""),
    mentorId: String(formData.get("mentorId") ?? "").trim() || null,
    linksText: String(formData.get("linksText") ?? "").trim() || null,
    hrConfirmationRequired: formData.get("hrConfirmationRequired") != null,
    managerConfirmationRequired: formData.get("managerConfirmationRequired") != null
  });
  if (!res.ok) redirectError(`/onboarding/templates/${templateId}`, res.error);
  revalidatePath("/onboarding");
  revalidatePath(`/onboarding/templates/${templateId}`);
  redirectSuccess(`/onboarding/templates/${templateId}`, "TEMPLATE_STEP_ADDED");
}

export async function updateOnboardingTemplateStepAction(formData: FormData) {
  ensureHrModuleEnabled();
  const user = await requireActiveUser();
  const templateId = String(formData.get("templateId") ?? "").trim();
  const res = await updateOnboardingTemplateStep({
    actor: actorPayload(user),
    stepId: String(formData.get("stepId") ?? "").trim(),
    title: String(formData.get("title") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim() || null,
    ownerType: String(formData.get("ownerType") ?? "SHARED").trim().toUpperCase() as any,
    dueOffsetDays: Number(formData.get("dueOffsetDays") ?? ""),
    mentorId: String(formData.get("mentorId") ?? "").trim() || null,
    linksText: String(formData.get("linksText") ?? "").trim() || null,
    hrConfirmationRequired: formData.get("hrConfirmationRequired") != null,
    managerConfirmationRequired: formData.get("managerConfirmationRequired") != null,
    order: Number(formData.get("order") ?? "")
  });
  if (!res.ok) redirectError(`/onboarding/templates/${templateId}`, res.error);
  revalidatePath("/onboarding");
  revalidatePath(`/onboarding/templates/${templateId}`);
  redirectSuccess(`/onboarding/templates/${templateId}`, "TEMPLATE_STEP_UPDATED");
}

export async function deleteOnboardingTemplateStepAction(formData: FormData) {
  ensureHrModuleEnabled();
  const user = await requireActiveUser();
  const templateId = String(formData.get("templateId") ?? "").trim();
  const res = await deleteOnboardingTemplateStep({
    actor: actorPayload(user),
    stepId: String(formData.get("stepId") ?? "").trim()
  });
  if (!res.ok) redirectError(`/onboarding/templates/${templateId}`, res.error);
  revalidatePath("/onboarding");
  revalidatePath(`/onboarding/templates/${templateId}`);
  redirectSuccess(`/onboarding/templates/${templateId}`, "TEMPLATE_STEP_DELETED");
}

export async function assignOnboardingProcessAction(formData: FormData) {
  ensureHrModuleEnabled();
  const user = await requireActiveUser();
  const onboardingId = String(formData.get("onboardingId") ?? "").trim() || null;
  const res = await assignOnboardingProcess({
    actor: actorPayload(user),
    onboardingId,
    templateId: String(formData.get("templateId") ?? "").trim(),
    employeeId: String(formData.get("employeeId") ?? "").trim(),
    startDate: String(formData.get("startDate") ?? "").trim() || null,
    status: String(formData.get("status") ?? "ACTIVE").trim().toUpperCase() as any
  });
  if (!res.ok) redirectError("/onboarding", res.error);
  refreshOnboardingPaths("/onboarding");
  redirectSuccess(`/onboarding/${res.id}`, "ONBOARDING_ASSIGNED");
}

export async function addOnboardingItemAction(formData: FormData) {
  ensureHrModuleEnabled();
  const user = await requireActiveUser();
  const onboardingId = String(formData.get("onboardingId") ?? "").trim();
  const res = await addOnboardingItem({
    actor: actorPayload(user),
    onboardingId,
    title: String(formData.get("title") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim() || null,
    ownerType: String(formData.get("ownerType") ?? "SHARED").trim().toUpperCase() as any,
    driveUrl: String(formData.get("driveUrl") ?? "").trim() || null,
    dueDate: String(formData.get("dueDate") ?? "").trim() || null,
    mentorId: String(formData.get("mentorId") ?? "").trim() || null,
    linksText: String(formData.get("linksText") ?? "").trim() || null,
    hrConfirmationRequired: formData.get("hrConfirmationRequired") != null,
    managerConfirmationRequired: formData.get("managerConfirmationRequired") != null
  });
  if (!res.ok) redirectError(`/onboarding/${onboardingId}`, res.error);
  refreshOnboardingPaths(`/onboarding/${onboardingId}`);
  redirectSuccess(`/onboarding/${onboardingId}`, "ITEM_ADDED");
}

export async function updateOnboardingItemAction(formData: FormData) {
  ensureHrModuleEnabled();
  const user = await requireActiveUser();
  const onboardingId = String(formData.get("onboardingId") ?? "").trim();
  const res = await updateOnboardingItem({
    actor: actorPayload(user),
    onboardingId,
    itemId: String(formData.get("itemId") ?? "").trim(),
    title: String(formData.get("title") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim() || null,
    ownerType: String(formData.get("ownerType") ?? "SHARED").trim().toUpperCase() as any,
    driveUrl: String(formData.get("driveUrl") ?? "").trim() || null,
    dueDate: String(formData.get("dueDate") ?? "").trim() || null,
    mentorId: String(formData.get("mentorId") ?? "").trim() || null,
    linksText: String(formData.get("linksText") ?? "").trim() || null,
    hrConfirmationRequired: formData.get("hrConfirmationRequired") != null,
    managerConfirmationRequired: formData.get("managerConfirmationRequired") != null
  });
  if (!res.ok) redirectError(`/onboarding/${onboardingId}`, res.error);
  refreshOnboardingPaths(`/onboarding/${onboardingId}`);
  redirectSuccess(`/onboarding/${onboardingId}`, "ITEM_UPDATED");
}

export async function toggleOnboardingItemAction(formData: FormData) {
  ensureHrModuleEnabled();
  const user = await requireActiveUser();
  const itemId = String(formData.get("itemId") ?? "").trim();
  const onboardingId = String(formData.get("onboardingId") ?? "").trim();
  const res = await toggleOnboardingItem({
    actor: actorPayload(user),
    itemId,
    completed: formData.get("completed") != null
  });
  if (!res.ok) redirectError(`/onboarding/${onboardingId}`, res.error);
  refreshOnboardingPaths(`/onboarding/${onboardingId}`);
  redirectSuccess(`/onboarding/${onboardingId}`, "ITEM_UPDATED");
}

export async function confirmOnboardingItemAction(formData: FormData) {
  ensureHrModuleEnabled();
  const user = await requireActiveUser();
  const onboardingId = String(formData.get("onboardingId") ?? "").trim();
  const res = await confirmOnboardingItem({
    actor: actorPayload(user),
    onboardingId,
    itemId: String(formData.get("itemId") ?? "").trim(),
    kind: String(formData.get("kind") ?? "").trim().toUpperCase() as "HR" | "MANAGER",
    confirmed: booleanish(formData.get("confirmed"))
  });
  if (!res.ok) redirectError(`/onboarding/${onboardingId}`, res.error);
  refreshOnboardingPaths(`/onboarding/${onboardingId}`);
  redirectSuccess(`/onboarding/${onboardingId}`, "ITEM_UPDATED");
}
