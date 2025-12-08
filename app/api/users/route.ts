import crypto from "crypto";
import { NextRequest } from "next/server";

import { getEnv } from "@/lib/env";
import { ApiError, json, readJson, withErrorHandling } from "@/lib/http";

export const runtime = "nodejs";

type CreateUserPayload = {
  email?: string;
  name?: string;
};

export const GET = withErrorHandling((request: NextRequest) => {
  const env = getEnv({ requireAuthSecret: false });
  const requestId = request.headers.get("x-request-id") ?? undefined;

  return json({
    users: [
      {
        id: "demo-user",
        email: "demo@example.com",
        role: "placeholder",
        source: env.DATABASE_URL ? "database" : "in-memory",
      },
    ],
    requestId,
  });
});

export const POST = withErrorHandling(async (request: NextRequest) => {
  const body = await readJson<CreateUserPayload>(request);

  if (!body.email) {
    throw new ApiError(400, "email is required");
  }

  const env = getEnv({ requireAuthSecret: false });

  const user = {
    id: crypto.randomUUID(),
    email: body.email,
    name: body.name ?? null,
    persisted: Boolean(env.DATABASE_URL),
  };

  return json(user, { status: 201 });
});
