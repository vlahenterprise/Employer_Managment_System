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
