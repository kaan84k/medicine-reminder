import { randomUUID } from "crypto";
import { NextRequest } from "next/server";

import { hashPassword, issueSessionToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const jsonRequest = (
  path: string,
  method: string,
  body?: unknown,
  headers: HeadersInit = {}
) => {
  const url = new URL(path, "http://localhost");
  const mergedHeaders = new Headers(headers);

  if (body !== undefined) {
    mergedHeaders.set("content-type", "application/json");
  }

  return new NextRequest(url, {
    method,
    headers: mergedHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
};

export const createUser = async (overrides: { email?: string; password?: string } = {}) => {
  const email = overrides.email ?? `user-${randomUUID()}@test.com`;
  const password = overrides.password ?? "password123";
  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: { email, passwordHash },
    select: { id: true, email: true, createdAt: true },
  });

  return { user, password };
};

export const createAuthHeader = async (user: { id: string; email: string }) => {
  const token = await issueSessionToken({ sub: user.id, email: user.email });
  return { authorization: `Bearer ${token}` };
};

export const createMedicine = async (
  userId: string,
  data: { name?: string; dose?: string | null; time?: string; notes?: string | null } = {}
) => {
  return prisma.medicine.create({
    data: {
      userId,
      name: data.name ?? "Test Med",
      time: data.time ?? "08:00",
      dose: data.dose ?? null,
      notes: data.notes ?? null,
    },
  });
};

export const resetDatabase = async () => {
  // Use TRUNCATE to ensure a clean slate even if FK relations are present.
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "ReminderStatus", "Medicine", "User" CASCADE');
};

export const disconnectDatabase = async () => prisma.$disconnect();
