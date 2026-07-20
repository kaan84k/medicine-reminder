import { NextRequest } from "next/server";

import { getEnv } from "@/lib/env";
import { ApiError, json, readJson, withErrorHandling } from "@/lib/http";
import {
  hashPassword,
  issueSessionToken,
  requireSession,
  setSessionCookie,
  verifyPassword,
} from "@/lib/auth";
import { assertStrongPassword } from "@/lib/password-policy";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

type ChangePasswordBody = {
  currentPassword?: string;
  newPassword?: string;
};

export const POST = withErrorHandling(async (request: NextRequest) => {
  await getEnv({ requireAuthSecret: true });
  const session = await requireSession(request);
  await rateLimit(request, "auth:change-password", 5, 60_000);

  const body = await readJson<ChangePasswordBody>(request);
  const currentPassword = body.currentPassword;
  const newPassword = body.newPassword;

  if (!currentPassword || !newPassword) {
    throw new ApiError(400, "currentPassword and newPassword are required");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { id: true, email: true, passwordHash: true },
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) {
    throw new ApiError(401, "Current password is incorrect");
  }

  assertStrongPassword(newPassword, user.email);

  const passwordHash = await hashPassword(newPassword);
  // Bump tokenVersion in the same write: every session issued before this
  // change (including any on other devices) is invalidated.
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, tokenVersion: { increment: 1 } },
    select: { id: true, email: true, tokenVersion: true },
  });

  // Re-issue a token for the current session at the new version so the caller
  // who changed the password stays authenticated.
  const token = await issueSessionToken({
    sub: updated.id,
    email: updated.email,
    ver: updated.tokenVersion,
  });
  const response = json({ success: true });
  setSessionCookie(response, token);
  return response;
});
