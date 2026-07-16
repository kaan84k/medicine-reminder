import { beforeEach, afterAll, describe, expect, it } from "vitest";

import { GET as listUsers, POST as createUserRoute } from "@/app/api/users/route";
import { prisma } from "@/lib/prisma";
import {
  createAuthHeader,
  createUser,
  disconnectDatabase,
  jsonRequest,
  resetDatabase,
} from "@/tests/test-helpers";

describe("users endpoint", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  it("GET returns only the caller, never other users' emails", async () => {
    const { user: me } = await createUser({ email: "me@example.com" });
    await createUser({ email: "other@example.com" });

    const headers = await createAuthHeader(me);
    const request = jsonRequest("/api/users", "GET", undefined, headers);

    const response = await listUsers(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.currentUser.email).toBe("me@example.com");
    expect(body.users).toBeUndefined();
    // Response must not leak the other user's email anywhere.
    expect(JSON.stringify(body)).not.toContain("other@example.com");
  });

  it("POST returns 403 for a non-admin user", async () => {
    const { user: normal } = await createUser({ role: "User" });
    const headers = await createAuthHeader(normal);

    const request = jsonRequest("/api/users", "POST", {
      email: "victim@example.com",
      password: "password123",
    }, headers);

    const response = await createUserRoute(request);
    expect(response.status).toBe(403);

    // No account was created.
    const created = await prisma.user.findUnique({ where: { email: "victim@example.com" } });
    expect(created).toBeNull();
  });

  it("POST allows an admin to create an account", async () => {
    const { user: admin } = await createUser({ role: "Admin" });
    const headers = await createAuthHeader(admin);

    const request = jsonRequest("/api/users", "POST", {
      email: "new@example.com",
      password: "password123",
    }, headers);

    const response = await createUserRoute(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.email).toBe("new@example.com");

    const created = await prisma.user.findUnique({ where: { email: "new@example.com" } });
    expect(created).not.toBeNull();
  });

  it("POST returns 401 when unauthenticated", async () => {
    const request = jsonRequest("/api/users", "POST", {
      email: "x@example.com",
      password: "password123",
    });

    const response = await createUserRoute(request);
    expect(response.status).toBe(401);
  });
});
