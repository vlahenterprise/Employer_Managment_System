import { getRequestId, getRequestIp } from "./request-meta";

type RouteBucket = {
  count: number;
  resetAt: number;
};

const globalForRateLimit = globalThis as typeof globalThis & {
  __routeRateLimitBuckets?: Map<string, RouteBucket>;
};

function getBuckets() {
  if (!globalForRateLimit.__routeRateLimitBuckets) {
    globalForRateLimit.__routeRateLimitBuckets = new Map<string, RouteBucket>();
  }
  return globalForRateLimit.__routeRateLimitBuckets;
}

export function checkRouteRateLimit(params: {
  request: Request;
  scope: string;
  actorId?: string | null;
  limit: number;
  windowMs?: number;
  now?: number;
}) {
  const requestId = getRequestId(params.request);
  const subject = params.actorId || getRequestIp(params.request);
  const windowMs = Math.max(1000, params.windowMs ?? 60_000);
  const now = params.now ?? Date.now();
  if (!Number.isFinite(params.limit) || params.limit < 1) {
    return {
      ok: true as const,
      requestId,
      remaining: Number.POSITIVE_INFINITY,
      retryAfterSeconds: Math.ceil(windowMs / 1000)
    };
  }
  const key = `${params.scope}:${subject}`;
  const buckets = getBuckets();
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return {
      ok: true as const,
      requestId,
      remaining: Math.max(0, params.limit - 1),
      retryAfterSeconds: Math.ceil(windowMs / 1000)
    };
  }

  if (current.count >= params.limit) {
    return {
      ok: false as const,
      requestId,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000))
    };
  }

  current.count += 1;
  buckets.set(key, current);
  return {
    ok: true as const,
    requestId,
    remaining: Math.max(0, params.limit - current.count),
    retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000))
  };
}
