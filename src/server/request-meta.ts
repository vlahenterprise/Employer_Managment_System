export function getRequestId(request: Request) {
  return (
    request.headers.get("x-request-id") ||
    request.headers.get("x-vercel-id") ||
    request.headers.get("x-correlation-id") ||
    crypto.randomUUID()
  );
}

export function getRequestIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for") || "";
  const firstForwarded = forwardedFor
    .split(",")
    .map((value) => value.trim())
    .find(Boolean);
  return firstForwarded || request.headers.get("x-real-ip") || "unknown";
}
