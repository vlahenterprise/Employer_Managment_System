import "server-only";

import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "crypto";
import { config } from "./config";
import { prisma } from "./db";
import { sendPasswordResetEmail } from "./google-workspace";
import { logInfo, logWarn } from "./log";
import { passwordSchema } from "./validation";

const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
const PASSWORD_RESET_RATE_WINDOW_MS = 15 * 60 * 1000;
const PASSWORD_RESET_RATE_LIMIT = 3;

type PasswordResult =
  | { ok: true }
  | {
      ok: false;
      error:
        | "PASSWORDS_DO_NOT_MATCH"
        | "PASSWORD_TOO_SHORT"
        | "PASSWORD_TOO_LONG"
        | "PASSWORD_NEEDS_UPPERCASE"
        | "PASSWORD_NEEDS_NUMBER"
        | "WRONG_CURRENT_PASSWORD"
        | "NO_PASSWORD_SET"
        | "INVALID_OR_EXPIRED_TOKEN";
    };

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function passwordValidationError(value: string): PasswordResult | null {
  const parsed = passwordSchema.safeParse(value);
  if (parsed.success) return null;
  const error = parsed.error.errors[0]?.message;
  if (
    error === "PASSWORD_TOO_SHORT" ||
    error === "PASSWORD_TOO_LONG" ||
    error === "PASSWORD_NEEDS_UPPERCASE" ||
    error === "PASSWORD_NEEDS_NUMBER"
  ) {
    return { ok: false, error };
  }
  return { ok: false, error: "PASSWORD_TOO_SHORT" };
}

function hashPasswordResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function buildPasswordResetUrl(token: string) {
  const url = new URL("/reset-password", config.auth.url || "https://employer.dashboard.vlahenterpriseapp.com");
  url.searchParams.set("token", token);
  return url.toString();
}

export async function requestPasswordReset(emailInput: string) {
  const email = normalizeEmail(emailInput);
  if (!email) return { ok: true as const };

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, status: true }
  });

  if (!user || user.status !== "ACTIVE") {
    return { ok: true as const };
  }

  const now = new Date();
  const rateWindowStart = new Date(now.getTime() - PASSWORD_RESET_RATE_WINDOW_MS);
  const recentTokens = await prisma.passwordResetToken.count({
    where: { userId: user.id, createdAt: { gte: rateWindowStart } }
  });

  if (recentTokens >= PASSWORD_RESET_RATE_LIMIT) {
    logWarn("password_reset.rate_limited", { userId: user.id });
    return { ok: true as const };
  }

  await prisma.passwordResetToken.deleteMany({
    where: { userId: user.id, OR: [{ expiresAt: { lt: now } }, { usedAt: { not: null } }] }
  });

  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = hashPasswordResetToken(rawToken);
  const expiresAt = new Date(now.getTime() + PASSWORD_RESET_TTL_MS);

  const token = await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      token: tokenHash,
      expiresAt
    },
    select: { id: true }
  });

  try {
    await sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      resetUrl: buildPasswordResetUrl(rawToken),
      tokenId: token.id,
      expiresMinutes: Math.floor(PASSWORD_RESET_TTL_MS / 60_000)
    });
  } catch (error) {
    logWarn("password_reset.email_failed", {
      userId: user.id,
      error: error instanceof Error ? error.message : String(error)
    });
  }

  logInfo("password_reset.requested", { userId: user.id });
  return { ok: true as const };
}

export async function getPasswordResetTokenStatus(rawToken: string) {
  const trimmed = rawToken.trim();
  if (!trimmed) return "missing" as const;

  const tokenHash = hashPasswordResetToken(trimmed);
  const token = await prisma.passwordResetToken.findUnique({
    where: { token: tokenHash },
    select: {
      expiresAt: true,
      usedAt: true,
      user: { select: { status: true } }
    }
  });

  if (!token || token.usedAt || token.expiresAt <= new Date() || token.user.status !== "ACTIVE") {
    return "invalid" as const;
  }

  return "valid" as const;
}

export async function resetPasswordWithToken(params: {
  token: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<PasswordResult> {
  const rawToken = params.token.trim();
  if (!rawToken) return { ok: false, error: "INVALID_OR_EXPIRED_TOKEN" };
  if (params.newPassword !== params.confirmPassword) return { ok: false, error: "PASSWORDS_DO_NOT_MATCH" };

  const validationError = passwordValidationError(params.newPassword);
  if (validationError) return validationError;

  const tokenHash = hashPasswordResetToken(rawToken);
  const token = await prisma.passwordResetToken.findUnique({
    where: { token: tokenHash },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      usedAt: true,
      user: { select: { status: true } }
    }
  });

  if (!token || token.usedAt || token.expiresAt <= new Date() || token.user.status !== "ACTIVE") {
    return { ok: false, error: "INVALID_OR_EXPIRED_TOKEN" };
  }

  const newHash = await bcrypt.hash(params.newPassword, 12);
  const now = new Date();

  await prisma.$transaction([
    prisma.user.update({
      where: { id: token.userId },
      data: { passwordHash: newHash, updatedAt: now }
    }),
    prisma.passwordResetToken.updateMany({
      where: { userId: token.userId, usedAt: null },
      data: { usedAt: now }
    })
  ]);

  logInfo("password_reset.completed", { userId: token.userId });
  return { ok: true };
}

export async function changeOwnPassword(params: {
  userId: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<PasswordResult> {
  if (params.newPassword !== params.confirmPassword) return { ok: false, error: "PASSWORDS_DO_NOT_MATCH" };

  const validationError = passwordValidationError(params.newPassword);
  if (validationError) return validationError;

  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { passwordHash: true }
  });

  if (!user?.passwordHash) return { ok: false, error: "NO_PASSWORD_SET" };

  const currentPasswordOk = await bcrypt.compare(params.currentPassword, user.passwordHash);
  if (!currentPasswordOk) {
    logWarn("profile.change_password.wrong_current", { userId: params.userId });
    return { ok: false, error: "WRONG_CURRENT_PASSWORD" };
  }

  const newHash = await bcrypt.hash(params.newPassword, 12);
  await prisma.user.update({
    where: { id: params.userId },
    data: { passwordHash: newHash, updatedAt: new Date() }
  });

  logInfo("profile.change_password.success", { userId: params.userId });
  return { ok: true };
}
