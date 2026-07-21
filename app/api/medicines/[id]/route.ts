import { NextRequest } from "next/server";

import { ApiError, json, readJson, withErrorHandling } from "@/lib/http";
import { getEnv } from "@/lib/env";
import { requireSession } from "@/lib/auth";
import { parseMedicineUpdate, parseUuidParam } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const ensureOwnedMedicine = async (id: string, userId: string) => {
  const medicine = await prisma.medicine.findUnique({ where: { id } });
  if (!medicine || medicine.userId !== userId) {
    throw new ApiError(404, "Medicine not found");
  }
  return medicine;
};

const resolveParams = async (context: unknown) => {
  const maybeParams = (context as { params?: unknown })?.params;
  if (maybeParams && typeof (maybeParams as Promise<unknown>).then === "function") {
    return await (maybeParams as Promise<Record<string, string>>);
  }
  return maybeParams as Record<string, string> | undefined;
};

export const GET = withErrorHandling(async (_request: NextRequest, context) => {
  await getEnv({ requireAuthSecret: true });
  const session = await requireSession(_request);
  await rateLimit(_request, "medicines:get", 60, 60_000);
  const params = await resolveParams(context);
  const id = parseUuidParam(params?.id, "id");

  const medicine = await prisma.medicine.findFirst({
    where: { id, userId: session.sub },
  });

  if (!medicine) {
    throw new ApiError(404, "Medicine not found");
  }

  return json(medicine);
});

export const PUT = withErrorHandling(async (request: NextRequest, context) => {
  await getEnv({ requireAuthSecret: true });
  const session = await requireSession(request);
  await rateLimit(request, "medicines:update", 30, 60_000);
  const params = await resolveParams(context);
  const id = parseUuidParam(params?.id, "id");

  const body = await readJson<unknown>(request);
  const updates = parseMedicineUpdate(body);

  await ensureOwnedMedicine(id, session.sub);

  const medicine = await prisma.medicine.update({
    where: { id },
    data: updates,
  });

  return json(medicine);
});

export const DELETE = withErrorHandling(async (request: NextRequest, context) => {
  await getEnv({ requireAuthSecret: true });
  const session = await requireSession(request);
  await rateLimit(request, "medicines:delete", 20, 60_000);
  const params = await resolveParams(context);
  const id = parseUuidParam(params?.id, "id");

  await ensureOwnedMedicine(id, session.sub);
  await prisma.medicine.delete({ where: { id } });

  return json({ success: true });
});
