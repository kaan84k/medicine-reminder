import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { GET as listMedicines, POST as createMedicineRoute } from "@/app/api/medicines/route";
import {
  DELETE as deleteMedicineRoute,
  GET as getMedicineRoute,
  PUT as updateMedicineRoute,
} from "@/app/api/medicines/[id]/route";
import { prisma } from "@/lib/prisma";
import {
  createAuthHeader,
  createMedicine,
  createUser,
  disconnectDatabase,
  jsonRequest,
  resetDatabase,
} from "@/tests/test-helpers";

describe("medicine endpoints", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  it("creates a medicine and lists only the authenticated user's medicines", async () => {
    const { user } = await createUser({ email: "owner@example.com" });
    const headers = await createAuthHeader(user);

    const createResponse = await createMedicineRoute(
      jsonRequest("/api/medicines", "POST", {
        name: "Vitamin C",
        time: "08:00",
        dose: "500mg",
      }, headers)
    );
    const created = await createResponse.json();

    expect(createResponse.status).toBe(201);
    expect(created.name).toBe("Vitamin C");
    expect(created.userId).toBe(user.id);

    // Another user's medicine should not leak into the list.
    const { user: otherUser } = await createUser({ email: "other@example.com" });
    await createMedicine(otherUser.id, { name: "Hidden" });

    const listResponse = await listMedicines(jsonRequest("/api/medicines", "GET", undefined, headers));
    const { medicines } = await listResponse.json();

    expect(listResponse.status).toBe(200);
    expect(medicines).toHaveLength(1);
    expect(medicines[0].name).toBe("Vitamin C");
  });

  it("updates and deletes a medicine for the authenticated user", async () => {
    const { user } = await createUser({ email: "editor@example.com" });
    const headers = await createAuthHeader(user);
    const medicine = await createMedicine(user.id, {
      name: "Painkiller",
      dose: "1 pill",
      time: "09:00",
      notes: "Original note",
    });

    const updateResponse = await updateMedicineRoute(
      jsonRequest(
        `/api/medicines/${medicine.id}`,
        "PUT",
        { dose: "2 pills", notes: "Updated note" },
        headers
      ),
      { params: { id: medicine.id } }
    );
    const updated = await updateResponse.json();

    expect(updateResponse.status).toBe(200);
    expect(updated.dose).toBe("2 pills");
    expect(updated.notes).toBe("Updated note");

    const deleteResponse = await deleteMedicineRoute(
      jsonRequest(`/api/medicines/${medicine.id}`, "DELETE", undefined, headers),
      { params: { id: medicine.id } }
    );

    expect(deleteResponse.status).toBe(200);
    const shouldBeGone = await prisma.medicine.findUnique({ where: { id: medicine.id } });
    expect(shouldBeGone).toBeNull();
  });
});
