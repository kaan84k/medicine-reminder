import { NextRequest } from "next/server";

import { getEnv } from "@/lib/env";
import { ApiError, json, readJson, withErrorHandling } from "@/lib/http";
import { issueSessionToken, setSessionCookie, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type LoginBody = {
  email?: string;
  password?: string;
};

export const POST = withErrorHandling(async (request: NextRequest) => {
  await getEnv({ requireAuthSecret: true });
  const body = await readJson<LoginBody>(request);

  const email = body.email?.trim().toLowerCase();
  const password = body.password?.trim();

  if (!email || !password) {
    throw new ApiError(400, "email and password are required");
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, passwordHash: true, createdAt: true },
  });

  if (!user) {
    throw new ApiError(401, "Invalid credentials");
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    throw new ApiError(401, "Invalid credentials");
  }

  const token = await issueSessionToken({ sub: user.id, email: user.email });
  const response = json(
    { user: { id: user.id, email: user.email, createdAt: user.createdAt } },
    { status: 200 }
  );
  setSessionCookie(response, token);
  return response;
});
