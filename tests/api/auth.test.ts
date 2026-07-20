import { beforeEach, afterAll, describe, expect, it } from "vitest";

import { POST as login } from "@/app/api/auth/login/route";
import { GET as session } from "@/app/api/auth/route";
import { POST as signup } from "@/app/api/auth/signup/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { POST as changePassword } from "@/app/api/auth/change-password/route";
import { prisma } from "@/lib/prisma";
import { hashPassword, issueSessionToken } from "@/lib/auth";
import {
  createAuthHeader,
  createUser,
  disconnectDatabase,
  jsonRequest,
  resetDatabase,
} from "@/tests/test-helpers";

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
      password: "Sup3r-Secret-Pw",
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
    const token = await issueSessionToken({
      sub: user.id,
      email: user.email,
      ver: user.tokenVersion,
    });

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

  it("rejects signup with a weak/common password", async () => {
    const request = jsonRequest("/api/auth/signup", "POST", {
      email: "weak@example.com",
      password: "password123",
    });

    const response = await signup(request);
    expect(response.status).toBe(400);

    const created = await prisma.user.findUnique({ where: { email: "weak@example.com" } });
    expect(created).toBeNull();
  });

  it("invalidates previously issued tokens after logout", async () => {
    const { user } = await createUser({ email: "logout@example.com" });
    const header = await createAuthHeader(user); // token at tokenVersion 0

    // Token authenticates before logout.
    const before = await session(
      jsonRequest("/api/auth", "GET", undefined, new Headers(header))
    );
    expect(before.status).toBe(200);

    // Logout bumps tokenVersion server-side.
    const loggedOut = await logout(
      jsonRequest("/api/auth/logout", "POST", undefined, new Headers(header))
    );
    expect(loggedOut.status).toBe(200);

    // The same token no longer authenticates.
    const after = await session(
      jsonRequest("/api/auth", "GET", undefined, new Headers(header))
    );
    expect(after.status).toBe(401);
  });

  it("invalidates previously issued tokens after a password change", async () => {
    const { user, password } = await createUser({ email: "change@example.com" });
    const header = await createAuthHeader(user); // token at tokenVersion 0

    const response = await changePassword(
      jsonRequest(
        "/api/auth/change-password",
        "POST",
        { currentPassword: password, newPassword: "Br4nd-New-Secret" },
        new Headers(header)
      )
    );
    expect(response.status).toBe(200);
    // The response re-issues a valid cookie for the current session.
    expect(response.cookies.get("session-token")?.value).toBeTruthy();

    // The old token (previous tokenVersion) is now rejected.
    const after = await session(
      jsonRequest("/api/auth", "GET", undefined, new Headers(header))
    );
    expect(after.status).toBe(401);
  });

  it("rejects a password change with the wrong current password", async () => {
    const { user } = await createUser({ email: "wrongpw@example.com" });
    const header = await createAuthHeader(user);

    const response = await changePassword(
      jsonRequest(
        "/api/auth/change-password",
        "POST",
        { currentPassword: "not-my-password", newPassword: "Br4nd-New-Secret" },
        new Headers(header)
      )
    );
    expect(response.status).toBe(401);
  });
});
