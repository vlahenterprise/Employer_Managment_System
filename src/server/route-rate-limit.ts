import { config } from "./config";
import { getRequestId, getRequestIp } from "./request-meta";

type RouteBucket = {
  count: number;
  resetAt: number;
};

const globalForRateLimit = globalThis as typeof globalThis & {
  __routeRateLimitBuckets?: Map<string, RouteBucket>;
  __upstashRatelimit?: any;
};

function getBuckets() {
  if (!globalForRateLimit.__routeRateLimitBuckets) {
    globalForRateLimit.__routeRateLimitBuckets = new Map<string, RouteBucket>();
  }
  return globalForRateLimit.__routeRateLimitBuckets;
}

async function getUpstashRatelimit() {
  if (!config.rateLimit.upstashRedisUrl || !config.rateLimit.upstashRedisToken) {
    return null;
  }
  if (!globalForRateLimit.__upstashRatelimit) {
    const { Ratelimit } = await import("@upstash/ratelimit");
    const { Redis } = await import("@upstash/redis");
    globalForRateLimit.__upstashRatelimit = new Ratelimit({
      redis: new Redis({
        url: config.rateLimit.upstashRedisUrl,
        token: config.rateLimit.upstashRedisToken
      }),
      limiter: Ratelimit.slidingWindow(10, "1 m"),
      analytics: false
    });
  }
  return globalForRateLimit.__upstashRatelimit;
}

export async function checkRouteRateLimit(params: {
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
    return { ok: true as const, requestId, remaining: Infinity, retryAfterSeconds: Math.ceil(windowMs / 1000) };
  }

  try {
    const rl = await getUpstashRatelimit();
    if (rl) {
      const key = `${params.scope}:${subject}`;
      const result = await rl.limit(key);
      return {
        ok: result.success as boolean,
        requestId,
        remaining: Math.max(0, result.remaining),
        retryAfterSeconds: Math.ceil(windowMs / 1000)
      };
    }
  } catch {
    // Fallback na in-memory ako Upstash nije dostupan
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
