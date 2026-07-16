import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { rateLimit } from "@/lib/rate-limit";
import { ApiError } from "@/lib/http";

const req = (ip = "1.2.3.4") =>
  new NextRequest(new URL("http://localhost/api/auth/login"), {
    method: "POST",
    headers: { "x-forwarded-for": ip },
  });

describe("rateLimit — in-memory fallback (no Upstash configured)", () => {
  beforeEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  it("allows up to the limit then returns 429 on the next call", async () => {
    const ip = `mem-${Math.random()}`;
    // 5 allowed within the window...
    for (let i = 0; i < 5; i++) {
      await expect(rateLimit(req(ip), "auth:login", 5, 60_000)).resolves.toBeUndefined();
    }
    // ...6th is blocked.
    await expect(rateLimit(req(ip), "auth:login", 5, 60_000)).rejects.toMatchObject({
      status: 429,
    });
  });

  it("keys by IP + scope — separate IPs do not share a bucket", async () => {
    const scope = `iso-${Math.random()}`;
    for (let i = 0; i < 5; i++) await rateLimit(req("10.0.0.1"), scope, 5, 60_000);
    // A different IP still gets its full allowance.
    await expect(rateLimit(req("10.0.0.2"), scope, 5, 60_000)).resolves.toBeUndefined();
  });
});

describe("rateLimit — Upstash Redis store", () => {
  beforeEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  it("throws 429 when the shared counter exceeds the limit", async () => {
    // INCR=6 (>limit 5), PEXPIRE, PTTL=30000ms remaining.
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify([{ result: 6 }, { result: 0 }, { result: 30_000 }]), {
        status: 200,
      })
    );

    await expect(rateLimit(req(), "auth:login", 5, 60_000)).rejects.toBeInstanceOf(ApiError);
  });

  it("allows when the shared counter is within the limit", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify([{ result: 1 }, { result: 1 }, { result: 60_000 }]), {
        status: 200,
      })
    );

    await expect(rateLimit(req(), "auth:login", 5, 60_000)).resolves.toBeUndefined();
  });

  it("fails open (allows) when the store is unreachable", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("network down"));

    await expect(rateLimit(req(), "auth:login", 5, 60_000)).resolves.toBeUndefined();
  });
});
