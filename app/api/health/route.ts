import { NextRequest } from "next/server";

import { getEnv } from "@/lib/env";
import { json, withErrorHandling } from "@/lib/http";

export const runtime = "nodejs";

export const GET = withErrorHandling((request: NextRequest) => {
  const env = getEnv({ requireAuthSecret: false });
  const requestId = request.headers.get("x-request-id") ?? undefined;

  return json({
    status: "ok",
    environment: env.NODE_ENV,
    databaseConfigured: Boolean(env.DATABASE_URL),
    authConfigured: Boolean(env.JWT_SECRET || env.AUTH_SECRET),
    timestamp: new Date().toISOString(),
    requestId,
  });
});
