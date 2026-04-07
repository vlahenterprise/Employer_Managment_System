"use server";

import { z } from "zod";
import { requestPasswordReset } from "@/server/password-reset";

const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("INVALID_EMAIL")
});

export async function requestPasswordResetAction(params: { email: string }) {
  const parsed = forgotPasswordSchema.safeParse(params);
  if (!parsed.success) return { ok: false as const, error: "INVALID_EMAIL" };

  await requestPasswordReset(parsed.data.email);
  return { ok: true as const };
}
