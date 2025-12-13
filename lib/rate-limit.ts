import { ApiError } from "@/lib/http";
import { NextRequest } from "next/server";

type Bucket = {
  expiresAt: number;
  count: number;
};

const buckets = new Map<string, Bucket>();

const getKey = (request: NextRequest, scope: string) => {
  const ip =
    request.ip ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  return `${scope}:${ip}`;
};

export const rateLimit = (
  request: NextRequest,
  scope: string,
  limit: number,
  windowMs: number
) => {
  const key = getKey(request, scope);
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.expiresAt < now) {
    buckets.set(key, { count: 1, expiresAt: now + windowMs });
    return;
  }

  existing.count += 1;
  if (existing.count > limit) {
    const seconds = Math.ceil((existing.expiresAt - now) / 1000);
    throw new ApiError(429, `Rate limit exceeded. Try again in ${seconds}s.`);
  }
};
