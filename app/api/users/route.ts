import { NextRequest } from "next/server";

import { ApiError, json, readJson, withErrorHandling } from "@/lib/http";
import { getEnv } from "@/lib/env";
import { hashPassword, requireSession } from "@/lib/auth";
import { assertStrongPassword } from "@/lib/password-policy";
import { parseEmail } from "@/lib/validation";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type CreateUserPayload = {
  email?: string;
  password?: string;
};

export const GET = withErrorHandling(async (request: NextRequest) => {
  await getEnv({ requireAuthSecret: true });
  const session = await requireSession(request);

  // Only ever return the caller's own record — never other users' PII.
  const currentUser = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { id: true, email: true, role: true, createdAt: true },
  });

  if (!currentUser) {
    throw new ApiError(404, "User not found");
  }

  return json({ currentUser });
});

export const POST = withErrorHandling(async (request: NextRequest) => {
  await getEnv({ requireAuthSecret: true });
  const session = await requireSession(request);

  // Admin-only: self-registration is handled by /api/auth/signup.
  const actor = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { role: true },
  });

  if (!actor || actor.role !== "Admin") {
    throw new ApiError(403, "Forbidden");
  }

  const body = await readJson<CreateUserPayload>(request);

  const email = parseEmail(body.email);
  const password = body.password;

  if (!password) {
    throw new ApiError(400, "password is required");
  }

  assertStrongPassword(password, email);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new ApiError(409, "User already exists");
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email, passwordHash },
    select: { id: true, email: true, role: true, createdAt: true },
  });

  return json(user, { status: 201 });
});
