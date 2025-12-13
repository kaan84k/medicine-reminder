import { ReminderState } from "@prisma/client";
import { NextRequest } from "next/server";

import { ApiError, json, readJson, withErrorHandling } from "@/lib/http";
import { getEnv } from "@/lib/env";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type StatusBody = {
  status?: ReminderState;
};

const assertStatus = (status: unknown): ReminderState => {
  if (status === ReminderState.Pending || status === ReminderState.Taken) {
    return status;
  }
  throw new ApiError(400, "status must be Pending or Taken");
};

const resolveParams = async (context: unknown) => {
  const maybeParams = (context as { params?: unknown })?.params;
  if (maybeParams && typeof (maybeParams as Promise<unknown>).then === "function") {
    return await (maybeParams as Promise<Record<string, string>>);
  }
  return maybeParams as Record<string, string> | undefined;
};

export const POST = withErrorHandling(async (request: NextRequest, context) => {
  await getEnv({ requireAuthSecret: true });
  const session = await requireSession(request);
  const params = await resolveParams(context);
  const medicineId = params?.id as string | undefined;

  if (!medicineId) {
    throw new ApiError(400, "medicineId is required");
  }

  const body = await readJson<StatusBody>(request);
  const status = body.status ? assertStatus(body.status) : ReminderState.Pending;

  const todayStartUtc = () => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  };
  const start = todayStartUtc();
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  const medicine = await prisma.medicine.findFirst({
    where: { id: medicineId, userId: session.sub },
    select: { id: true },
  });
  if (!medicine) {
    throw new ApiError(404, "Medicine not found");
  }

  const existing = await prisma.reminderStatus.findFirst({
    where: { medicineId, date: { gte: start, lt: end } },
    include: {
      medicine: { select: { id: true, name: true, dose: true, time: true, notes: true } },
    },
  });

  if (existing) {
    return json(existing);
  }

  const reminder = await prisma.reminderStatus.create({
    data: {
      medicineId,
      date: start,
      status,
    },
    include: {
      medicine: { select: { id: true, name: true, dose: true, time: true, notes: true } },
    },
  });

  return json(reminder, { status: 201 });
});

export const PATCH = withErrorHandling(async (request: NextRequest, context) => {
  await getEnv({ requireAuthSecret: true });
  const session = await requireSession(request);
  const params = await resolveParams(context);
  const reminderId = params?.id as string | undefined;

  if (!reminderId) {
    throw new ApiError(400, "id is required");
  }

  const body = await readJson<StatusBody>(request);
  if (!body.status) {
    throw new ApiError(400, "status is required");
  }
  const status = assertStatus(body.status);

  const reminder = await prisma.reminderStatus.findFirst({
    where: {
      id: reminderId,
      medicine: { userId: session.sub },
    },
  });

  if (!reminder) {
    throw new ApiError(404, "Reminder not found");
  }

  const updated = await prisma.reminderStatus.update({
    where: { id: reminderId },
    data: { status },
    include: {
      medicine: { select: { id: true, name: true, dose: true, time: true, notes: true } },
    },
  });

  return json(updated);
});
