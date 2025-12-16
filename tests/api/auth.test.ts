import { beforeEach, afterAll, describe, expect, it } from "vitest";

import { POST as login } from "@/app/api/auth/login/route";
import { GET as session } from "@/app/api/auth/route";
import { POST as signup } from "@/app/api/auth/signup/route";
import { prisma } from "@/lib/prisma";
import { hashPassword, issueSessionToken } from "@/lib/auth";
import { disconnectDatabase, jsonRequest, resetDatabase } from "@/tests/test-helpers";

describe("auth endpoints", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  it("signs up a new user, persists to DB, and sets a session cookie", async () => {
    const request = jsonRequest("/api/auth/signup", "POST", {
      email: "test@example.com",
      password: "password123",
    });

    const response = await signup(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.user.email).toBe("test@example.com");
    expect(response.cookies.get("session-token")?.value).toBeTruthy();

    const created = await prisma.user.findUnique({ where: { email: "test@example.com" } });
    expect(created).not.toBeNull();
  });

  it("rejects invalid login attempts", async () => {
    const passwordHash = await hashPassword("correct-password");
    await prisma.user.create({
      data: { email: "login@example.com", passwordHash },
    });

    const badPasswordRequest = jsonRequest("/api/auth/login", "POST", {
      email: "login@example.com",
      password: "wrong-password",
    });

    const badResponse = await login(badPasswordRequest);
    expect(badResponse.status).toBe(401);
  });

  it("returns the current session when authorized", async () => {
    const passwordHash = await hashPassword("correct-password");
    const user = await prisma.user.create({
      data: { email: "session@example.com", passwordHash },
    });
    const token = await issueSessionToken({ sub: user.id, email: user.email });

    const request = jsonRequest(
      "/api/auth",
      "GET",
      undefined,
      new Headers({ authorization: `Bearer ${token}` })
    );

    const response = await session(request);
    const { session: sessionPayload } = await response.json();

    expect(response.status).toBe(200);
    expect(sessionPayload.email).toBe("session@example.com");
    expect(sessionPayload.sub).toBe(user.id);
  });
});
