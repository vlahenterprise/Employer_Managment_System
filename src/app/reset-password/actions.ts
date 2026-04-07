"use server";

import { resetPasswordWithToken } from "@/server/password-reset";

export async function resetPasswordAction(params: {
  token: string;
  newPassword: string;
  confirmPassword: string;
}) {
  return resetPasswordWithToken(params);
}
