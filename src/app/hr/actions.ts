"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActiveUser } from "@/server/current-user";
import {
  addCandidateToHrProcess,
  archiveHrCandidate,
  cancelHrProcess,
  closeHrProcess,
  createHrProcess,
  finalApproveHrCandidate,
  hrScreenCandidate,
  managerReviewHrCandidate,
  markHrNotificationRead,
  scheduleHrInterview,
  secondRoundHrDecision,
  updateHrProcessMeta
} from "@/server/hr";

const HR_PRIORITIES = new Set(["LOW", "MED", "HIGH", "CRITICAL"]);
const HR_PROCESS_STATUSES = new Set(["DRAFT", "OPEN", "IN_PROGRESS", "ON_HOLD", "APPROVED", "CLOSED", "CANCELED"]);

function redirectError(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function redirectSuccess(path: string, message: string): never {
  redirect(`${path}?success=${encodeURIComponent(message)}`);
}

function actorPayload(user: Awaited<ReturnType<typeof requireActiveUser>>) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    hrAddon: user.hrAddon,
    teamId: user.teamId,
    managerId: user.managerId
  } as const;
}

function revalidateHrViews(processId?: string | null) {
  revalidatePath("/dashboard");
  revalidatePath("/hr");
  revalidatePath("/management");
  if (processId) revalidatePath(`/hr/${processId}`);
}

export async function createHrProcessAction(formData: FormData) {
  const user = await requireActiveUser();
  const priorityRaw = String(formData.get("priority") ?? "MED").trim().toUpperCase();
  const res = await createHrProcess({
    actor: actorPayload(user),
    teamId: String(formData.get("teamId") ?? "").trim() || null,
    positionTitle: String(formData.get("positionTitle") ?? "").trim(),
    requestedHeadcount: Number(String(formData.get("requestedHeadcount") ?? "1")),
    priority: (HR_PRIORITIES.has(priorityRaw) ? priorityRaw : "MED") as any,
    reason: String(formData.get("reason") ?? "").trim(),
    note: String(formData.get("note") ?? "").trim() || null,
    managerId: String(formData.get("managerId") ?? "").trim() || null
  });
  if (!res.ok) redirectError("/hr", res.error);
  revalidateHrViews(res.processId);
  redirectSuccess(`/hr/${res.processId}`, "PROCESS_CREATED");
}

export async function updateHrProcessMetaAction(formData: FormData) {
  const user = await requireActiveUser();
  const processId = String(formData.get("processId") ?? "").trim();
  const statusRaw = String(formData.get("status") ?? "").trim().toUpperCase();
  const adPublishedAtRaw = String(formData.get("adPublishedAt") ?? "").trim();
  const res = await updateHrProcessMeta({
    actor: actorPayload(user),
    processId,
    status: (HR_PROCESS_STATUSES.has(statusRaw) ? statusRaw : undefined) as any,
    adChannel: String(formData.get("adChannel") ?? "").trim() || null,
    adPublishedAt: adPublishedAtRaw || null,
    note: String(formData.get("note") ?? "").trim() || null
  });
  if (!res.ok) redirectError(`/hr/${processId}`, res.error);
  revalidateHrViews(processId);
  redirectSuccess(`/hr/${processId}`, "PROCESS_UPDATED");
}

export async function addCandidateToProcessAction(formData: FormData) {
  const user = await requireActiveUser();
  const processId = String(formData.get("processId") ?? "").trim();
  const cvFile = formData.get("cvFile");
  let cvFileName: string | null = null;
  let cvMimeType: string | null = null;
  let cvData: Buffer | null = null;

  if (cvFile instanceof File && cvFile.size > 0) {
    const fileType = String(cvFile.type || "").trim().toLowerCase();
    const fileName = String(cvFile.name || "").trim();
    if (fileType && fileType !== "application/pdf" && !fileName.toLowerCase().endsWith(".pdf")) {
      redirectError(`/hr/${processId}`, "CV_MUST_BE_PDF");
    }
    cvFileName = fileName || "candidate-cv.pdf";
    cvMimeType = fileType || "application/pdf";
    cvData = Buffer.from(await cvFile.arrayBuffer());
  }

  const res = await addCandidateToHrProcess({
    actor: actorPayload(user),
    processId,
    candidateId: String(formData.get("candidateId") ?? "").trim() || null,
    fullName: String(formData.get("fullName") ?? "").trim() || null,
    email: String(formData.get("email") ?? "").trim() || null,
    phone: String(formData.get("phone") ?? "").trim() || null,
    linkedIn: String(formData.get("linkedIn") ?? "").trim() || null,
    source: String(formData.get("source") ?? "").trim() || null,
    appliedAt: String(formData.get("appliedAt") ?? "").trim() || null,
    hrComment: String(formData.get("hrComment") ?? "").trim() || null,
    firstRoundComment: String(formData.get("firstRoundComment") ?? "").trim() || null,
    screeningResult: String(formData.get("screeningResult") ?? "").trim() || null,
    cvFileName,
    cvMimeType,
    cvData
  });
  if (!res.ok) redirectError(`/hr/${processId}`, res.error);
  revalidateHrViews(processId);
  redirectSuccess(`/hr/${processId}`, "CANDIDATE_ADDED");
}

export async function hrScreenCandidateAction(formData: FormData) {
  const user = await requireActiveUser();
  const processId = String(formData.get("processId") ?? "").trim();
  const applicationId = String(formData.get("applicationId") ?? "").trim();
  const decision = String(formData.get("decision") ?? "SEND_TO_MANAGER").trim().toUpperCase();
  const res = await hrScreenCandidate({
    actor: actorPayload(user),
    applicationId,
    decision: decision === "REJECT" ? "REJECT" : "SEND_TO_MANAGER",
    hrComment: String(formData.get("hrComment") ?? "").trim() || null,
    firstRoundComment: String(formData.get("firstRoundComment") ?? "").trim() || null,
    screeningResult: String(formData.get("screeningResult") ?? "").trim() || null
  });
  if (!res.ok) redirectError(`/hr/${processId}`, res.error);
  revalidateHrViews(processId);
  redirectSuccess(`/hr/${processId}`, "SCREENING_UPDATED");
}

export async function managerReviewCandidateAction(formData: FormData) {
  const user = await requireActiveUser();
  const processId = String(formData.get("processId") ?? "").trim();
  const applicationId = String(formData.get("applicationId") ?? "").trim();
  const decision = String(formData.get("decision") ?? "ADVANCE").trim().toUpperCase();
  const proposedSlots = String(formData.get("proposedSlots") ?? "")
    .split(/\r?\n/)
    .map((slot) => slot.trim())
    .filter(Boolean);

  const res = await managerReviewHrCandidate({
    actor: actorPayload(user),
    applicationId,
    decision: decision === "REJECT" ? "REJECT" : "ADVANCE",
    managerComment: String(formData.get("managerComment") ?? "").trim() || null,
    proposedSlots
  });
  if (!res.ok) redirectError(`/hr/${processId}`, res.error);
  revalidateHrViews(processId);
  redirectSuccess(`/hr/${processId}`, "MANAGER_REVIEW_SAVED");
}

export async function scheduleInterviewAction(formData: FormData) {
  const user = await requireActiveUser();
  const processId = String(formData.get("processId") ?? "").trim();
  const applicationId = String(formData.get("applicationId") ?? "").trim();
  const res = await scheduleHrInterview({
    actor: actorPayload(user),
    applicationId,
    interviewAt: String(formData.get("interviewAt") ?? "").trim(),
    hrComment: String(formData.get("hrComment") ?? "").trim() || null
  });
  if (!res.ok) redirectError(`/hr/${processId}`, res.error);
  revalidateHrViews(processId);
  redirectSuccess(`/hr/${processId}`, "INTERVIEW_SCHEDULED");
}

export async function secondRoundDecisionAction(formData: FormData) {
  const user = await requireActiveUser();
  const processId = String(formData.get("processId") ?? "").trim();
  const applicationId = String(formData.get("applicationId") ?? "").trim();
  const decision = String(formData.get("decision") ?? "FINAL_APPROVAL").trim().toUpperCase();
  const res = await secondRoundHrDecision({
    actor: actorPayload(user),
    applicationId,
    decision: decision === "REJECT" ? "REJECT" : "FINAL_APPROVAL",
    managerComment: String(formData.get("managerComment") ?? "").trim() || null
  });
  if (!res.ok) redirectError(`/hr/${processId}`, res.error);
  revalidateHrViews(processId);
  redirectSuccess(`/hr/${processId}`, "SECOND_ROUND_UPDATED");
}

export async function finalApprovalAction(formData: FormData) {
  const user = await requireActiveUser();
  const processId = String(formData.get("processId") ?? "").trim();
  const applicationId = String(formData.get("applicationId") ?? "").trim();
  const decision = String(formData.get("decision") ?? "APPROVE").trim().toUpperCase();
  const res = await finalApproveHrCandidate({
    actor: actorPayload(user),
    applicationId,
    decision: decision === "REJECT" ? "REJECT" : "APPROVE",
    finalComment: String(formData.get("finalComment") ?? "").trim() || null
  });
  if (!res.ok) redirectError(`/hr/${processId}`, res.error);
  revalidateHrViews(processId);
  redirectSuccess(`/hr/${processId}`, "FINAL_DECISION_SAVED");
}

export async function archiveCandidateAction(formData: FormData) {
  const user = await requireActiveUser();
  const processId = String(formData.get("processId") ?? "").trim();
  const applicationId = String(formData.get("applicationId") ?? "").trim();
  const mode = String(formData.get("mode") ?? "ARCHIVED").trim().toUpperCase();
  const res = await archiveHrCandidate({
    actor: actorPayload(user),
    applicationId,
    status: mode === "CANCELED" ? "CANCELED" : "ARCHIVED",
    reason: String(formData.get("reason") ?? "").trim() || null
  });
  if (!res.ok) redirectError(`/hr/${processId}`, res.error);
  revalidateHrViews(processId);
  redirectSuccess(`/hr/${processId}`, mode === "CANCELED" ? "CANDIDATE_CANCELED" : "CANDIDATE_ARCHIVED");
}

export async function cancelHrProcessAction(formData: FormData) {
  const user = await requireActiveUser();
  const processId = String(formData.get("processId") ?? "").trim();
  const res = await cancelHrProcess({
    actor: actorPayload(user),
    processId,
    reason: String(formData.get("reason") ?? "").trim() || null
  });
  if (!res.ok) redirectError(`/hr/${processId}`, res.error);
  revalidateHrViews(processId);
  redirectSuccess("/hr", "PROCESS_CANCELED");
}

export async function closeHrProcessAction(formData: FormData) {
  const user = await requireActiveUser();
  const processId = String(formData.get("processId") ?? "").trim();
  const res = await closeHrProcess({
    actor: actorPayload(user),
    processId,
    note: String(formData.get("note") ?? "").trim() || null
  });
  if (!res.ok) redirectError(`/hr/${processId}`, res.error);
  revalidateHrViews(processId);
  redirectSuccess(`/hr/${processId}`, "PROCESS_CLOSED");
}

export async function markHrNotificationReadAction(formData: FormData) {
  const user = await requireActiveUser();
  const notificationId = String(formData.get("notificationId") ?? "").trim();
  const returnTo = String(formData.get("returnTo") ?? "/hr").trim() || "/hr";
  const res = await markHrNotificationRead(actorPayload(user), notificationId);
  if (!res.ok) redirectError(returnTo, res.error);
  revalidateHrViews();
  redirect(returnTo);
}
