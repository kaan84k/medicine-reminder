import { ReminderState } from "@prisma/client";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PATCH as updateReminderRoute, POST as createReminderRoute } from "@/app/api/reminders/[id]/route";
import { GET as todayRoute } from "@/app/api/reminders/today/route";
import { prisma } from "@/lib/prisma";
import {
  createAuthHeader,
  createMedicine,
  createUser,
  disconnectDatabase,
  jsonRequest,
  resetDatabase,
} from "@/tests/test-helpers";

describe("reminder endpoints", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-02T10:00:00Z"));
    await resetDatabase();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  it("ensures today's reminders are created for every medicine", async () => {
    const { user } = await createUser({ email: "reminders@example.com" });
    const headers = await createAuthHeader(user);

    await createMedicine(user.id, { name: "Morning Med", time: "08:00" });
    await createMedicine(user.id, { name: "Evening Med", time: "20:00" });

    const response = await todayRoute(
      jsonRequest("/api/reminders/today", "GET", undefined, headers)
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.date).toBe("2024-01-02");
    expect(payload.reminders).toHaveLength(2);
    expect(payload.reminders.every((reminder: any) => reminder.status === ReminderState.Pending)).toBe(
      true
    );

    const storedCount = await prisma.reminderStatus.count();
    expect(storedCount).toBe(2);
  });

  it("creates a reminder for a medicine and toggles the status", async () => {
    const { user } = await createUser({ email: "toggle@example.com" });
    const headers = await createAuthHeader(user);
    const medicine = await createMedicine(user.id, { name: "Toggle Med", time: "07:00" });

    const createResponse = await createReminderRoute(
      jsonRequest(`/api/reminders/${medicine.id}`, "POST", {}, headers),
      { params: { id: medicine.id } }
    );
    const created = await createResponse.json();

    expect(createResponse.status).toBe(201);
    expect(created.medicineId).toBe(medicine.id);
    expect(created.status).toBe(ReminderState.Pending);

    const updateResponse = await updateReminderRoute(
      jsonRequest(
        `/api/reminders/${created.id}`,
        "PATCH",
        { status: ReminderState.Taken },
        headers
      ),
      { params: { id: created.id } }
    );
    const updated = await updateResponse.json();

    expect(updateResponse.status).toBe(200);
    expect(updated.status).toBe(ReminderState.Taken);

    const persisted = await prisma.reminderStatus.findUnique({ where: { id: created.id } });
    expect(persisted?.status).toBe(ReminderState.Taken);
  });
});
