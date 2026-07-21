import { NextRequest } from "next/server";

import { json, readJson, withErrorHandling } from "@/lib/http";
import { getEnv } from "@/lib/env";
import { requireSession } from "@/lib/auth";
import { parseMedicineCreate } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export const POST = withErrorHandling(async (request: NextRequest) => {
  await getEnv({ requireAuthSecret: true });
  const session = await requireSession(request);
  await rateLimit(request, "medicines:create", 30, 60_000);
  const body = await readJson<unknown>(request);
  const parsed = parseMedicineCreate(body);

  const medicine = await prisma.medicine.create({
    data: {
      ...parsed,
      userId: session.sub,
    },
  });

  return json(medicine, { status: 201 });
});

export const GET = withErrorHandling(async (request: NextRequest) => {
  await getEnv({ requireAuthSecret: true });
  const session = await requireSession(request);
  await rateLimit(request, "medicines:list", 60, 60_000);

  const medicines = await prisma.medicine.findMany({
    where: { userId: session.sub },
    orderBy: { createdAt: "desc" },
  });

  return json({ medicines });
});
