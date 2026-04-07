import "server-only";

import { logInfo } from "./log";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string };

export function sanitizeText(input: string, maxLength: number): string {
  return String(input ?? "")
    .trim()
    .slice(0, maxLength)
    .replace(/[\u0000-\u001F\u007F]/g, "");
}

/**
 * Validates and returns a safe URL (http/https only).
 * Returns null if empty, undefined if invalid protocol.
 */
export function sanitizeUrl(input: string, maxLength = 2048): string | null {
  const raw = String(input ?? "").trim().slice(0, maxLength);
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return raw;
  } catch {
    return null;
  }
}

function isFrameworkControlFlowError(err: unknown) {
  if (!err || typeof err !== "object") return false;
  const digest = "digest" in err ? (err as { digest?: unknown }).digest : undefined;
  return typeof digest === "string" && (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND"));
}

export async function withAction<T>(fn: () => Promise<T>, context?: string): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (err) {
    if (isFrameworkControlFlowError(err)) {
      throw err;
    }
    const message = err instanceof Error ? err.message : String(err);
    logInfo(`action_error${context ? `:${context}` : ""}`, { error: message });
    return { ok: false, error: "Došlo je do greške. Pokušajte ponovo.", code: context };
  }
}
