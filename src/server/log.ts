type LogLevel = "info" | "warn" | "error";

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
    ...(context ? { context } : {})
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
