import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { GET as health } from "@/app/api/health/route";
import { prisma } from "@/lib/prisma";
import { disconnectDatabase, jsonRequest } from "@/tests/test-helpers";

describe("health endpoint", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  it("returns 200 and status ok when the database is reachable", async () => {
    const response = await health(jsonRequest("/api/health", "GET"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.database).toBe("up");
  });

  it("returns 503 and status degraded when the database is unreachable", async () => {
    vi.spyOn(prisma, "$queryRaw").mockRejectedValueOnce(new Error("connection refused"));

    const response = await health(jsonRequest("/api/health", "GET"));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe("degraded");
    expect(body.database).toBe("down");
  });
});
