import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { POST as createMedicineRoute } from "@/app/api/medicines/route";
import {
  DELETE as deleteMedicineRoute,
  GET as getMedicineRoute,
  PUT as updateMedicineRoute,
} from "@/app/api/medicines/[id]/route";
import { PATCH as updateReminderRoute } from "@/app/api/reminders/[id]/route";
import { POST as signup } from "@/app/api/auth/signup/route";
import {
  createAuthHeader,
  createMedicine,
  createUser,
  disconnectDatabase,
  jsonRequest,
  resetDatabase,
} from "@/tests/test-helpers";

const VALID_UUID = "00000000-0000-4000-8000-000000000000";

describe("input validation", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  describe("POST /api/medicines", () => {
    const post = async (body: unknown, headers: HeadersInit) =>
      createMedicineRoute(jsonRequest("/api/medicines", "POST", body, headers));

    it("rejects a missing name", async () => {
      const { user } = await createUser();
      const headers = await createAuthHeader(user);
      const response = await post({ time: "08:00" }, headers);
      expect(response.status).toBe(400);
    });

    it("rejects a name of the wrong type", async () => {
      const { user } = await createUser();
      const headers = await createAuthHeader(user);
      const response = await post({ name: 12345, time: "08:00" }, headers);
      expect(response.status).toBe(400);
    });

    it("rejects an oversized name", async () => {
      const { user } = await createUser();
      const headers = await createAuthHeader(user);
      const response = await post({ name: "x".repeat(201), time: "08:00" }, headers);
      expect(response.status).toBe(400);
    });

    it("rejects a malformed time", async () => {
      const { user } = await createUser();
      const headers = await createAuthHeader(user);
      const response = await post({ name: "Vitamin C", time: "8am" }, headers);
      expect(response.status).toBe(400);
    });

    it("rejects a non-object body", async () => {
      const { user } = await createUser();
      const headers = await createAuthHeader(user);
      const response = await post([1, 2, 3], headers);
      expect(response.status).toBe(400);
    });
  });

  describe("medicine route params", () => {
    it("rejects a non-UUID id on GET", async () => {
      const { user } = await createUser();
      const headers = await createAuthHeader(user);
      const response = await getMedicineRoute(
        jsonRequest("/api/medicines/not-a-uuid", "GET", undefined, headers),
        { params: { id: "not-a-uuid" } }
      );
      expect(response.status).toBe(400);
    });

    it("rejects a non-UUID id on DELETE", async () => {
      const { user } = await createUser();
      const headers = await createAuthHeader(user);
      const response = await deleteMedicineRoute(
        jsonRequest("/api/medicines/not-a-uuid", "DELETE", undefined, headers),
        { params: { id: "not-a-uuid" } }
      );
      expect(response.status).toBe(400);
    });

    it("rejects a malformed time on PUT before touching the database", async () => {
      const { user } = await createUser();
      const headers = await createAuthHeader(user);
      const medicine = await createMedicine(user.id, { name: "Med", time: "09:00" });
      const response = await updateMedicineRoute(
        jsonRequest(`/api/medicines/${medicine.id}`, "PUT", { time: "25:00" }, headers),
        { params: { id: medicine.id } }
      );
      expect(response.status).toBe(400);
    });
  });

  describe("PATCH /api/reminders/:id", () => {
    it("rejects an invalid status value", async () => {
      const { user } = await createUser();
      const headers = await createAuthHeader(user);
      const response = await updateReminderRoute(
        jsonRequest(`/api/reminders/${VALID_UUID}`, "PATCH", { status: "Skipped" }, headers),
        { params: { id: VALID_UUID } }
      );
      expect(response.status).toBe(400);
    });
  });

  describe("POST /api/auth/signup", () => {
    it("rejects a malformed email", async () => {
      const response = await signup(
        jsonRequest("/api/auth/signup", "POST", {
          email: "not-an-email",
          password: "Sup3r-Secret-Pw",
        })
      );
      expect(response.status).toBe(400);
    });
  });
});
