import { ReminderState } from "@prisma/client";
import { NextRequest } from "next/server";

import { json, withErrorHandling } from "@/lib/http";
import { getEnv } from "@/lib/env";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const todayStartUtc = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};

export const GET = withErrorHandling(async (request: NextRequest) => {
  await getEnv({ requireAuthSecret: true });
  const session = await requireSession(request);

  const start = todayStartUtc();
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  const medicines = await prisma.medicine.findMany({
    where: { userId: session.sub },
    select: { id: true, name: true, dose: true, time: true, notes: true },
  });

  // Ensure each medicine has a reminder for today.
  await Promise.all(
    medicines.map((medicine) =>
      prisma.reminderStatus.upsert({
        where: {
          medicineId_date: {
            medicineId: medicine.id,
            date: start,
          },
        },
        update: {},
        create: {
          medicineId: medicine.id,
          date: start,
          status: ReminderState.Pending,
        },
      })
    )
  );

  const reminders = await prisma.reminderStatus.findMany({
    where: {
      medicine: { userId: session.sub },
      date: { gte: start, lt: end },
    },
    include: {
      medicine: { select: { id: true, name: true, dose: true, time: true, notes: true } },
    },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });

  return json({
    date: start.toISOString().slice(0, 10),
    reminders,
  });
});
