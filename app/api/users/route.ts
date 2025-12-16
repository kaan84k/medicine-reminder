import { NextRequest } from "next/server";

import { ApiError, json, readJson, withErrorHandling } from "@/lib/http";
import { getEnv } from "@/lib/env";
import { hashPassword, requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type CreateUserPayload = {
  email?: string;
  password?: string;
};

export const GET = withErrorHandling(async (request: NextRequest) => {
  await getEnv({ requireAuthSecret: true });
  const session = await requireSession(request);

  const currentUser = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { id: true, email: true, createdAt: true },
  });

  if (!currentUser) {
    throw new ApiError(404, "User not found");
  }

  const users = await prisma.user.findMany({
    select: { id: true, email: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return json({ currentUser, users });
});

export const POST = withErrorHandling(async (request: NextRequest) => {
  await getEnv({ requireAuthSecret: true });
  await requireSession(request);
  const body = await readJson<CreateUserPayload>(request);

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

  return json(user, { status: 201 });
});
