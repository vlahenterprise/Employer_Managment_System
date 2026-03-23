type LogLevel = "info" | "warn" | "error";

const SENSITIVE_KEY_PATTERN = /(token|secret|password|authorization|cookie|zipdata|latestcvdata)/i;

function sanitizeContext(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[TRUNCATED]";
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((entry) => sanitizeContext(entry, depth + 1));
  if (typeof value === "string") {
    return value.length > 1200 ? `${value.slice(0, 1197)}...` : value;
  }
  if (typeof value !== "object") return value;

  const entries = Object.entries(value as Record<string, unknown>).map(([key, entry]) => {
    if (SENSITIVE_KEY_PATTERN.test(key)) return [key, "[REDACTED]"];
    return [key, sanitizeContext(entry, depth + 1)];
  });
  return Object.fromEntries(entries);
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }
  return error;
}

function emit(level: LogLevel, event: string, context?: Record<string, unknown>) {
  const payload = {
    app: "employer-management-system",
    ts: new Date().toISOString(),
    level,
    event,
    ...(context ? { context: sanitizeContext(context) } : {})
  };

  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
    return;
  }
  if (level === "warn") {
    console.warn(line);
    return;
  }
  console.log(line);
}

export function logInfo(event: string, context?: Record<string, unknown>) {
  emit("info", event, context);
}

export function logWarn(event: string, context?: Record<string, unknown>) {
  emit("warn", event, context);
}

export function logError(event: string, error: unknown, context?: Record<string, unknown>) {
  emit("error", event, {
    ...(context ?? {}),
    error: serializeError(error)
  });
}
