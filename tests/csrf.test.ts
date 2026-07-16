import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { isCsrfSafe } from "@/lib/csrf";

const make = (method: string, headers: Record<string, string> = {}) =>
  new NextRequest(new URL("http://localhost/api/medicines"), {
    method,
    headers: { host: "localhost", ...headers },
  });

describe("isCsrfSafe", () => {
  afterEach(() => {
    delete process.env.ALLOWED_ORIGINS;
  });

  it("allows safe methods regardless of origin", () => {
    expect(isCsrfSafe(make("GET", { origin: "https://evil.example" }))).toBe(true);
    expect(isCsrfSafe(make("HEAD"))).toBe(true);
    expect(isCsrfSafe(make("OPTIONS"))).toBe(true);
  });

  it("allows same-origin mutating requests", () => {
    expect(isCsrfSafe(make("POST", { origin: "http://localhost" }))).toBe(true);
  });

  it("rejects cross-origin mutating requests", () => {
    expect(isCsrfSafe(make("POST", { origin: "https://evil.example" }))).toBe(false);
    expect(isCsrfSafe(make("DELETE", { origin: "https://evil.example" }))).toBe(false);
  });

  it("exempts Bearer-token requests (not cookie-driven)", () => {
    expect(
      isCsrfSafe(make("POST", { origin: "https://evil.example", authorization: "Bearer abc" }))
    ).toBe(true);
  });

  it("rejects a cookie mutation with neither Origin nor Referer", () => {
    expect(isCsrfSafe(make("POST"))).toBe(false);
  });

  it("falls back to Referer origin when Origin is absent", () => {
    expect(isCsrfSafe(make("POST", { referer: "http://localhost/dashboard" }))).toBe(true);
    expect(isCsrfSafe(make("POST", { referer: "https://evil.example/x" }))).toBe(false);
  });

  it("honors the ALLOWED_ORIGINS allowlist", () => {
    process.env.ALLOWED_ORIGINS = "https://app.medreminder.com";
    expect(isCsrfSafe(make("POST", { origin: "https://app.medreminder.com" }))).toBe(true);
  });
});
