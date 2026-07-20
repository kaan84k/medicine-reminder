import { NextRequest } from "next/server";

import { getEnv } from "@/lib/env";
import { ApiError, json, readJson, withErrorHandling } from "@/lib/http";
import { hashPassword, issueSessionToken, setSessionCookie } from "@/lib/auth";
import { assertStrongPassword } from "@/lib/password-policy";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

type SignupBody = {
  email?: string;
  password?: string;
};

export const POST = withErrorHandling(async (request: NextRequest) => {
  await getEnv({ requireAuthSecret: true });
  await rateLimit(request, "auth:signup", 5, 60_000);
  const body = await readJson<SignupBody>(request);

  const email = body.email?.trim().toLowerCase();
  // Do NOT trim the password — every character the user typed is part of the
  // secret. Validation reads it as-is and rejects on policy, never mutates it.
  const password = body.password;

  if (!email || !password) {
    throw new ApiError(400, "email and password are required");
  }

  assertStrongPassword(password, email);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new ApiError(409, "User already exists");
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email, passwordHash },
    select: { id: true, email: true, tokenVersion: true, createdAt: true },
  });

  const token = await issueSessionToken({
    sub: user.id,
    email: user.email,
    ver: user.tokenVersion,
  });
  const response = json({ user }, { status: 201 });
  setSessionCookie(response, token);
  return response;
});
