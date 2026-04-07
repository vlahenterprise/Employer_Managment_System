"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireActiveUser } from "@/server/current-user";
import { revalidatePath } from "next/cache";
import { passwordSchema } from "@/server/validation";
import { logInfo, logWarn } from "@/server/log";

const changePasswordInputSchema = z.object({
  currentPassword: z.string().min(1, "REQUIRED"),
  newPassword: passwordSchema,
  confirmPassword: z.string().min(1, "REQUIRED")
});

export async function changePasswordAction(formData: FormData) {
  const actor = await requireActiveUser();

  const input = changePasswordInputSchema.safeParse({
    currentPassword: String(formData.get("currentPassword") ?? ""),
    newPassword: String(formData.get("newPassword") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? "")
  });

  if (!input.success) {
    const firstError = input.error.errors[0]?.message ?? "VALIDATION_ERROR";
    return { ok: false as const, error: firstError };
  }

  const { currentPassword, newPassword, confirmPassword } = input.data;

  if (newPassword !== confirmPassword) {
    return { ok: false as const, error: "PASSWORDS_DO_NOT_MATCH" };
  }

  // Učitaj trenutni hash
  const user = await prisma.user.findUnique({
    where: { id: actor.id },
    select: { passwordHash: true }
  });

  if (!user?.passwordHash) {
    // Korisnici koji se prijavljuju samo Google-om nemaju lozinku
    return { ok: false as const, error: "NO_PASSWORD_SET" };
  }

  const currentPasswordOk = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!currentPasswordOk) {
    logWarn("profile.change_password.wrong_current", { userId: actor.id });
    return { ok: false as const, error: "WRONG_CURRENT_PASSWORD" };
  }

  const newHash = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { id: actor.id },
    data: { passwordHash: newHash, updatedAt: new Date() }
  });

  logInfo("profile.change_password.success", { userId: actor.id });
  revalidatePath("/profile");
  return { ok: true as const };
}

const updateLinksSchema = z.object({
  jobDescriptionUrl: z.string().trim().max(2000).optional().nullable()
    .transform(v => (!v || v.trim() === "") ? null : v.trim()),
  workInstructionsUrl: z.string().trim().max(2000).optional().nullable()
    .transform(v => (!v || v.trim() === "") ? null : v.trim())
});

export async function updateProfileLinksAction(formData: FormData) {
  const actor = await requireActiveUser();

  const input = updateLinksSchema.safeParse({
    jobDescriptionUrl: String(formData.get("jobDescriptionUrl") ?? ""),
    workInstructionsUrl: String(formData.get("workInstructionsUrl") ?? "")
  });

  if (!input.success) {
    return { ok: false as const, error: "VALIDATION_ERROR" };
  }

  await prisma.user.update({
    where: { id: actor.id },
    data: {
      jobDescriptionUrl: input.data.jobDescriptionUrl,
      workInstructionsUrl: input.data.workInstructionsUrl
    }
  });

  logInfo("profile.update_links.success", { userId: actor.id });
  revalidatePath("/profile");
  return { ok: true as const };
}
