import crypto from "crypto";
import { NextRequest } from "next/server";

import { getEnv } from "@/lib/env";
import { ApiError, json, readJson, withErrorHandling } from "@/lib/http";

export const runtime = "nodejs";

type AuthPayload = {
  email?: string;
  userId?: string;
};

export const POST = withErrorHandling(async (request: NextRequest) => {
  const body = await readJson<AuthPayload>(request);

  if (!body.email && !body.userId) {
    throw new ApiError(400, "email or userId is required");
  }

  const env = getEnv({ requireAuthSecret: true });
  const secret = env.JWT_SECRET ?? env.AUTH_SECRET ?? "";

  const issuedAt = Date.now();
  const expiresInSeconds = 60 * 60; // 1 hour for development tokens
  const expiresAt = new Date(issuedAt + expiresInSeconds * 1000).toISOString();

  const token = crypto
    .createHmac("sha256", secret)
    .update(`${body.email ?? body.userId}:${issuedAt}`)
    .digest("hex");

  return json({
    token,
    issuedAt: new Date(issuedAt).toISOString(),
    expiresAt,
    expiresInSeconds,
    provider: env.JWT_SECRET ? "jwt" : "nextauth",
  });
});
