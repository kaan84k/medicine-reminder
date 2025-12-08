import { NextRequest } from "next/server";

import { getEnv } from "@/lib/env";
import { ApiError, json, readJson, withErrorHandling } from "@/lib/http";
import { hashPassword, issueSessionToken, setSessionCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type SignupBody = {
  email?: string;
  password?: string;
};

export const POST = withErrorHandling(async (request: NextRequest) => {
  await getEnv({ requireAuthSecret: true });
  const body = await readJson<SignupBody>(request);

  const email = body.email?.trim().toLowerCase();
  const password = body.password?.trim();

  if (!email || !password) {
    throw new ApiError(400, "email and password are required");
  }

  if (password.length < 8) {
    throw new ApiError(400, "password must be at least 8 characters");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new ApiError(409, "User already exists");
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email, passwordHash },
    select: { id: true, email: true, createdAt: true },
  });

  const token = await issueSessionToken({ sub: user.id, email: user.email });
  const response = json({ user }, { status: 201 });
  setSessionCookie(response, token);
  return response;
});
