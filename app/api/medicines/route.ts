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

const normalizeBody = (body: MedicineBody) => {
  const name = body.name?.trim();
  const time = body.time?.trim();
  const dose = body.dose?.trim();
  const notes = body.notes?.trim();

  if (!name) {
    throw new ApiError(400, "name is required");
  }

  if (!time) {
    throw new ApiError(400, "time is required");
  }

  return {
    name,
    time,
    dose: dose || null,
    notes: notes || null,
  };
};

export const POST = withErrorHandling(async (request: NextRequest) => {
  await getEnv({ requireAuthSecret: true });
  const session = await requireSession(request);
  const body = await readJson<MedicineBody>(request);
  const parsed = normalizeBody(body);

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

  const medicines = await prisma.medicine.findMany({
    where: { userId: session.sub },
    orderBy: { createdAt: "desc" },
  });

  return json({ medicines });
});
