import { NextRequest } from "next/server";

import { getEnv } from "@/lib/env";
import { json, withErrorHandling } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// Never cache readiness — each probe must reflect the live dependency state.
export const dynamic = "force-dynamic";

export const GET = withErrorHandling(async (request: NextRequest) => {
  const env = getEnv({ requireAuthSecret: false });
  const requestId = request.headers.get("x-request-id") ?? undefined;

  // Cheap liveness round-trip. A configured DATABASE_URL says nothing about
  // whether Postgres is actually reachable — only a query does.
  let databaseReachable = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    databaseReachable = true;
  } catch (error) {
    console.error("Health check: database round-trip failed", error);
  }

  const status = databaseReachable ? "ok" : "degraded";

  return json(
    {
      status,
      environment: env.NODE_ENV,
      databaseConfigured: Boolean(env.DATABASE_URL),
      database: databaseReachable ? "up" : "down",
      authConfigured: Boolean(env.JWT_SECRET || env.AUTH_SECRET),
      timestamp: new Date().toISOString(),
      requestId,
    },
    // 503 so deploy platforms and load balancers gate traffic on real readiness.
    { status: databaseReachable ? 200 : 503 }
  );
});
