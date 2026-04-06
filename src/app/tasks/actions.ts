"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireActiveUser } from "@/server/current-user";
import { approveTaskAction, cancelTaskAction, createTask, returnTaskAction, submitTaskForApproval } from "@/server/tasks";
import { z } from "zod";
import { normalizeIsoDate } from "@/server/iso-date";
import { isManagerRole } from "@/server/rbac";
import { withAction } from "@/server/action-utils";

function redirectError(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function redirectSuccess(path: string, message: string): never {
  redirect(`${path}?success=${encodeURIComponent(message)}`);
}

const prioritySchema = z.enum(["LOW", "MED", "HIGH", "CRIT"]);

export async function createTaskAction(formData: FormData) {
  const user = await requireActiveUser();
  if (!isManagerRole(user.role)) redirectError("/tasks", "NO_ACCESS");

  const title = String(formData.get("title") ?? "");
  const description = String(formData.get("description") ?? "");
  const dueIsoRaw = String(formData.get("dueIso") ?? "");
  const priorityRaw = String(formData.get("priority") ?? "MED");
  const teamIdRaw = String(formData.get("teamId") ?? "");
  const assigneeId = String(formData.get("assigneeId") ?? "");

  const dueIso = normalizeIsoDate(dueIsoRaw);
  if (!dueIso) redirectError("/tasks", "MISSING_DUE_DATE");

  const priorityParsed = prioritySchema.safeParse(priorityRaw);
  if (!priorityParsed.success) redirectError("/tasks", "INVALID_PRIORITY");

  const action = await withAction(
    () =>
      createTask({
        actor: { id: user.id, role: user.role, email: user.email, name: user.name },
        payload: {
          title,
          description,
          priority: priorityParsed.data,
          teamId: teamIdRaw.trim() || null,
          assigneeId,
          dueIso
        }
      }),
    "tasks.create"
  );
  if (!action.ok) redirectError("/tasks", action.error);
  const res = action.data;

  if (!res.ok) redirectError("/tasks", res.error);

  revalidatePath("/tasks");
  redirectSuccess("/tasks", `CREATED:${res.taskId}`);
}

export async function submitForApprovalAction(formData: FormData) {
  const user = await requireActiveUser();
  const taskId = String(formData.get("taskId") ?? "").trim();
  const comment = String(formData.get("comment") ?? "");

  const action = await withAction(
    () =>
      submitTaskForApproval({
        actor: { id: user.id, role: user.role, email: user.email, name: user.name },
        taskId,
        comment
      }),
    "tasks.submit_for_approval"
  );
  if (!action.ok) redirectError("/tasks", action.error);
  const res = action.data;

  if (!res.ok) redirectError("/tasks", res.error);

  revalidatePath("/tasks");
  redirectSuccess("/tasks", "SUBMITTED");
}

export async function approveTaskFormAction(formData: FormData) {
  const user = await requireActiveUser();
  const taskId = String(formData.get("taskId") ?? "").trim();
  const comment = String(formData.get("comment") ?? "");

  const action = await withAction(
    () =>
      approveTaskAction({
        actor: { id: user.id, role: user.role, email: user.email, name: user.name },
        taskId,
        comment
      }),
    "tasks.approve"
  );
  if (!action.ok) redirectError("/tasks", action.error);
  const res = action.data;

  if (!res.ok) redirectError("/tasks", res.error);

  revalidatePath("/tasks");
  redirectSuccess("/tasks", "APPROVED");
}

export async function returnTaskFormAction(formData: FormData) {
  const user = await requireActiveUser();
  const taskId = String(formData.get("taskId") ?? "").trim();
  const comment = String(formData.get("comment") ?? "");

  const action = await withAction(
    () =>
      returnTaskAction({
        actor: { id: user.id, role: user.role, email: user.email, name: user.name },
        taskId,
        comment
      }),
    "tasks.return"
  );
  if (!action.ok) redirectError("/tasks", action.error);
  const res = action.data;

  if (!res.ok) redirectError("/tasks", res.error);

  revalidatePath("/tasks");
  redirectSuccess("/tasks", "RETURNED");
}

export async function cancelTaskFormAction(formData: FormData) {
  const user = await requireActiveUser();
  const taskId = String(formData.get("taskId") ?? "").trim();
  const comment = String(formData.get("comment") ?? "");

  const action = await withAction(
    () =>
      cancelTaskAction({
        actor: { id: user.id, role: user.role, email: user.email, name: user.name },
        taskId,
        comment
      }),
    "tasks.cancel"
  );
  if (!action.ok) redirectError("/tasks", action.error);
  const res = action.data;

  if (!res.ok) redirectError("/tasks", res.error);

  revalidatePath("/tasks");
  redirectSuccess("/tasks", "CANCELLED");
}
