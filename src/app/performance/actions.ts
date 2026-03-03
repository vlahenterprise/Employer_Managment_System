"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireActiveUser } from "@/server/current-user";
import {
  cancelPerformanceEvaluation,
  closePerformanceEvaluation,
  createPerformanceEvaluation,
  deletePerformanceEvaluation,
  lockPerformanceEvaluation,
  savePerformanceGoals,
  savePerformanceManagerReview,
  savePerformancePersonalReview,
  savePerformanceSelfReview,
  submitPerformanceSelfReview,
  unlockPerformanceEvaluation
} from "@/server/performance";

function redirectError(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function redirectSuccess(path: string, message: string): never {
  redirect(`${path}?success=${encodeURIComponent(message)}`);
}

export async function createEvaluationAction(formData: FormData) {
  const user = await requireActiveUser();
  const employeeId = String(formData.get("employeeId") ?? "").trim();
  if (!employeeId) redirectError("/performance", "MISSING_EMPLOYEE");

  const res = await createPerformanceEvaluation({
    actor: { id: user.id, email: user.email, name: user.name, role: user.role },
    employeeId
  });
  if (!res.ok) redirectError("/performance", res.error);

  revalidatePath("/performance");
  redirectSuccess(`/performance/${res.evalId}`, `CREATED:${res.periodLabel}`);
}

export async function saveGoalsAction(formData: FormData) {
  const user = await requireActiveUser();
  const evalId = String(formData.get("evalId") ?? "").trim();
  if (!evalId) redirectError("/performance", "MISSING_EVAL");

  const goals = [];
  for (let i = 1; i <= 5; i += 1) {
    const title = String(formData.get(`goalTitle${i}`) ?? "").trim();
    const description = String(formData.get(`goalDesc${i}`) ?? "").trim();
    const weightRaw = String(formData.get(`goalWeight${i}`) ?? "").trim();
    if (!title) continue;
    const weight = Number(weightRaw || 0);
    goals.push({ title, description, weight });
  }

  const res = await savePerformanceGoals({
    actor: { id: user.id, email: user.email, role: user.role },
    evalId,
    goals
  });
  if (!res.ok) redirectError(`/performance/${evalId}`, res.error);

  revalidatePath(`/performance/${evalId}`);
  redirectSuccess(`/performance/${evalId}`, "GOALS_SAVED");
}

export async function saveSelfReviewAction(formData: FormData) {
  const user = await requireActiveUser();
  const evalId = String(formData.get("evalId") ?? "").trim();
  if (!evalId) redirectError("/performance", "MISSING_EVAL");

  const ids = String(formData.get("goalIds") ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  const items = ids.map((goalId) => ({
    goalId,
    percent: Number(String(formData.get(`selfPct:${goalId}`) ?? "0")),
    comment: String(formData.get(`selfCmt:${goalId}`) ?? "")
  }));

  const res = await savePerformanceSelfReview({
    actor: { id: user.id, email: user.email, role: user.role },
    evalId,
    items
  });
  if (!res.ok) redirectError(`/performance/${evalId}`, res.error);

  revalidatePath(`/performance/${evalId}`);
  redirectSuccess(`/performance/${evalId}`, "SELF_SAVED");
}

export async function submitSelfReviewAction(formData: FormData) {
  const user = await requireActiveUser();
  const evalId = String(formData.get("evalId") ?? "").trim();
  if (!evalId) redirectError("/performance", "MISSING_EVAL");

  const res = await submitPerformanceSelfReview({
    actor: { id: user.id, email: user.email, role: user.role },
    evalId
  });
  if (!res.ok) redirectError(`/performance/${evalId}`, res.error);

  revalidatePath(`/performance/${evalId}`);
  redirectSuccess(`/performance/${evalId}`, "SELF_SUBMITTED");
}

export async function saveManagerReviewAction(formData: FormData) {
  const user = await requireActiveUser();
  const evalId = String(formData.get("evalId") ?? "").trim();
  if (!evalId) redirectError("/performance", "MISSING_EVAL");

  const ids = String(formData.get("goalIds") ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  const items = ids.map((goalId) => ({
    goalId,
    percent: Number(String(formData.get(`mgrPct:${goalId}`) ?? "0")),
    comment: String(formData.get(`mgrCmt:${goalId}`) ?? "")
  }));

  const res = await savePerformanceManagerReview({
    actor: { id: user.id, email: user.email, role: user.role },
    evalId,
    items
  });
  if (!res.ok) redirectError(`/performance/${evalId}`, res.error);

  revalidatePath(`/performance/${evalId}`);
  redirectSuccess(`/performance/${evalId}`, "MANAGER_SAVED");
}

export async function savePersonalReviewAction(formData: FormData) {
  const user = await requireActiveUser();
  const evalId = String(formData.get("evalId") ?? "").trim();
  if (!evalId) redirectError("/performance", "MISSING_EVAL");

  const ids = String(formData.get("personalIds") ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  const items = ids.map((itemId) => ({
    itemId,
    rating: Number(String(formData.get(`persRating:${itemId}`) ?? "0")),
    comment: String(formData.get(`persCmt:${itemId}`) ?? "")
  }));

  const res = await savePerformancePersonalReview({
    actor: { id: user.id, email: user.email, role: user.role },
    evalId,
    items
  });
  if (!res.ok) redirectError(`/performance/${evalId}`, res.error);

  revalidatePath(`/performance/${evalId}`);
  redirectSuccess(`/performance/${evalId}`, "PERSONAL_SAVED");
}

export async function lockEvalAction(formData: FormData) {
  const user = await requireActiveUser();
  const evalId = String(formData.get("evalId") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!evalId) redirectError("/performance", "MISSING_EVAL");

  const res = await lockPerformanceEvaluation({
    actor: { id: user.id, email: user.email, role: user.role },
    evalId,
    password
  });
  if (!res.ok) redirectError(`/performance/${evalId}`, res.error);

  revalidatePath(`/performance/${evalId}`);
  redirectSuccess(`/performance/${evalId}`, "LOCKED");
}

export async function unlockEvalAction(formData: FormData) {
  const user = await requireActiveUser();
  const evalId = String(formData.get("evalId") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!evalId) redirectError("/performance", "MISSING_EVAL");

  const res = await unlockPerformanceEvaluation({
    actor: { id: user.id, email: user.email, role: user.role },
    evalId,
    password
  });
  if (!res.ok) redirectError(`/performance/${evalId}`, res.error);

  revalidatePath(`/performance/${evalId}`);
  redirectSuccess(`/performance/${evalId}`, "UNLOCKED");
}

export async function closeEvalAction(formData: FormData) {
  const user = await requireActiveUser();
  const evalId = String(formData.get("evalId") ?? "").trim();
  const finalComment = String(formData.get("finalComment") ?? "");
  if (!evalId) redirectError("/performance", "MISSING_EVAL");

  const res = await closePerformanceEvaluation({
    actor: { id: user.id, email: user.email, role: user.role },
    evalId,
    finalComment
  });
  if (!res.ok) redirectError(`/performance/${evalId}`, res.error);

  revalidatePath(`/performance/${evalId}`);
  redirectSuccess(`/performance/${evalId}`, `CLOSED:${Math.round(res.finalScore * 10) / 10}`);
}

export async function cancelEvalAction(formData: FormData) {
  const user = await requireActiveUser();
  const evalId = String(formData.get("evalId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "");
  if (!evalId) redirectError("/performance", "MISSING_EVAL");

  const res = await cancelPerformanceEvaluation({
    actor: { id: user.id, email: user.email, role: user.role },
    evalId,
    reason
  });
  if (!res.ok) redirectError(`/performance/${evalId}`, res.error);

  revalidatePath(`/performance/${evalId}`);
  redirectSuccess(`/performance/${evalId}`, "CANCELLED");
}

export async function deleteEvalAction(formData: FormData) {
  const user = await requireActiveUser();
  const evalId = String(formData.get("evalId") ?? "").trim();
  if (!evalId) redirectError("/performance", "MISSING_EVAL");

  const res = await deletePerformanceEvaluation({
    actor: { id: user.id, email: user.email, role: user.role },
    evalId
  });
  if (!res.ok) redirectError(`/performance/${evalId}`, res.error);

  revalidatePath("/performance");
  redirectSuccess("/performance", "DELETED");
}
