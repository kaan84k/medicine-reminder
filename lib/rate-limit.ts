import { ApiError } from "@/lib/http";
import { NextRequest } from "next/server";

/**
 * Durable, shared rate limiting (P0-3).
 *
 * Production: a shared Upstash Redis store (set UPSTASH_REDIS_REST_URL +
 * UPSTASH_REDIS_REST_TOKEN). Because the counter lives in Redis it is shared
 * across every serverless / multi-instance deploy and survives process restart.
 * We talk to Upstash over its REST API with plain `fetch` — no SDK dependency,
 * works in both the node and edge runtimes.
 *
 * Fallback: when Upstash is not configured (local dev, tests, CI) we use an
 * in-process Map. This is per-instance and non-durable — it exists only so the
 * app runs without external infra. It prunes expired buckets so it cannot grow
 * unbounded (the old implementation's memory leak).
 *
 * Failure policy: FAIL OPEN. If the shared store is unreachable we log the
 * incident and allow the request, favoring availability over strict enforcement.
 */

type Bucket = {
  expiresAt: number;
  count: number;
};

const buckets = new Map<string, Bucket>();
// Cap the fallback map so a burst of unique keys cannot grow it without bound
// even between prunes.
const MAX_FALLBACK_KEYS = 10_000;

const getClientIp = (request: NextRequest) => {
  // `NextRequest.ip` was removed in Next 15+, so derive the IP from the proxy
  // headers the deploy platform sets (Vercel/most reverse proxies).
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
};

const getKey = (request: NextRequest, scope: string) => {
  return `ratelimit:${scope}:${getClientIp(request)}`;
};

const getUpstashConfig = () => {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url, token };
};

/**
 * Fixed-window counter in Redis via a single Upstash REST pipeline:
 *   INCR key                -> current count in this window
 *   PEXPIRE key windowMs NX  -> start the window on the first hit only
 *   PTTL key                 -> ms remaining, for the Retry-After hint
 * Returns null on any store error so the caller can fail open.
 */
const checkRedis = async (
  config: { url: string; token: string },
  key: string,
  windowMs: number
): Promise<{ count: number; ttlMs: number } | null> => {
  try {
    const response = await fetch(`${config.url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", key],
        ["PEXPIRE", key, windowMs, "NX"],
        ["PTTL", key],
      ]),
      // Never let a slow store hang the request path.
      signal: AbortSignal.timeout(1000),
    });

    if (!response.ok) {
      console.error("Rate limit store returned non-OK", response.status);
      return null;
    }

    const results = (await response.json()) as Array<{ result?: number; error?: string }>;
    const count = results[0]?.result;
    const ttlMs = results[2]?.result;

    if (typeof count !== "number") {
      console.error("Rate limit store returned unexpected payload", results);
      return null;
    }

    return { count, ttlMs: typeof ttlMs === "number" && ttlMs > 0 ? ttlMs : windowMs };
  } catch (error) {
    console.error("Rate limit store unreachable — failing open", error);
    return null;
  }
};

const pruneExpired = (now: number) => {
  for (const [key, bucket] of buckets) {
    if (bucket.expiresAt < now) {
      buckets.delete(key);
    }
  }
};

const checkMemory = (key: string, windowMs: number): { count: number; ttlMs: number } => {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.expiresAt < now) {
    // Bound growth: prune on the way in, and hard-cap total keys.
    if (buckets.size >= MAX_FALLBACK_KEYS) {
      pruneExpired(now);
    }
    buckets.set(key, { count: 1, expiresAt: now + windowMs });
    return { count: 1, ttlMs: windowMs };
  }

  existing.count += 1;
  return { count: existing.count, ttlMs: existing.expiresAt - now };
};

export const rateLimit = async (
  request: NextRequest,
  scope: string,
  limit: number,
  windowMs: number
) => {
  const key = getKey(request, scope);
  const config = getUpstashConfig();

  let result: { count: number; ttlMs: number } | null;
  if (config) {
    result = await checkRedis(config, key, windowMs);
    // Store unreachable → fail open (allow the request).
    if (result === null) return;
  } else {
    result = checkMemory(key, windowMs);
  }

  if (result.count > limit) {
    const seconds = Math.max(1, Math.ceil(result.ttlMs / 1000));
    throw new ApiError(429, `Rate limit exceeded. Try again in ${seconds}s.`);
  }
};
