import { NextRequest } from "next/server";

import { ApiError, json, readJson, withErrorHandling } from "@/lib/http";
import { getEnv } from "@/lib/env";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type MedicineBody = {
  name?: string;
  dose?: string | null;
  time?: string;
  notes?: string | null;
};

const normalizePartialBody = (body: MedicineBody) => {
  const updates: Record<string, string | null> = {};

  if (body.name !== undefined) {
    const name = body.name.trim();
    if (!name) {
      throw new ApiError(400, "name cannot be empty");
    }
    updates.name = name;
  }

  if (body.time !== undefined) {
    const time = body.time.trim();
    if (!time) {
      throw new ApiError(400, "time cannot be empty");
    }
    updates.time = time;
  }

  if (body.dose !== undefined) {
    updates.dose = body.dose?.trim() || null;
  }

  if (body.notes !== undefined) {
    updates.notes = body.notes?.trim() || null;
  }

  if (Object.keys(updates).length === 0) {
    throw new ApiError(400, "no fields provided to update");
  }

  return updates;
};

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
  const params = await resolveParams(context);
  const id = params?.id as string | undefined;

  if (!id) {
    throw new ApiError(400, "id is required");
  }

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
  const params = await resolveParams(context);
  const id = params?.id as string | undefined;

  if (!id) {
    throw new ApiError(400, "id is required");
  }

  const body = await readJson<MedicineBody>(request);
  const updates = normalizePartialBody(body);

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
  const params = await resolveParams(context);
  const id = params?.id as string | undefined;

  if (!id) {
    throw new ApiError(400, "id is required");
  }

  await ensureOwnedMedicine(id, session.sub);
  await prisma.medicine.delete({ where: { id } });

  return json({ success: true });
});
