import { z } from "zod";
import { normalizeIsoDate } from "./iso-date";

export const idSchema = z.string().trim().min(1, "ID_REQUIRED").max(191, "ID_INVALID");
export const emailSchema = z.string().trim().toLowerCase().email("INVALID_EMAIL");

export function requiredTextSchema(maxLength = 5000, message = "VALUE_REQUIRED") {
  return z.string().trim().min(1, message).max(maxLength, "VALUE_TOO_LONG");
}

export function optionalTextSchema(maxLength = 5000) {
  return z
    .string()
    .transform((value) => String(value ?? "").trim())
    .refine((value) => value.length <= maxLength, "VALUE_TOO_LONG")
    .transform((value) => value || null);
}

export const isoDateSchema = z
  .string()
  .transform((value) => normalizeIsoDate(value) || "")
  .refine(Boolean, "INVALID_DATE");

export function booleanish(value: unknown) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  return ["1", "true", "yes", "y", "on"].includes(normalized);
}

// Minimum 8 karaktera, bar 1 veliko slovo, bar 1 broj
export const passwordSchema = z
  .string()
  .min(8, "PASSWORD_TOO_SHORT")
  .max(128, "PASSWORD_TOO_LONG")
  .refine((pw) => /[A-Z]/.test(pw), "PASSWORD_NEEDS_UPPERCASE")
  .refine((pw) => /[0-9]/.test(pw), "PASSWORD_NEEDS_NUMBER");
