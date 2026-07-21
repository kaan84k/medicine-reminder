import { ReminderState } from "@prisma/client";

import { ApiError } from "@/lib/http";

/**
 * Centralized request-body and route-param validation.
 *
 * Every mutating route parses its input through one of the `parse*` functions
 * below, so validation rules (types, lengths, formats, enums) live in a single
 * place and cannot drift per-route. Anything malformed, oversized, or of the
 * wrong type raises `ApiError(400)` here — before the value ever reaches Prisma.
 */

// Maximum accepted lengths (post-trim) for free-text fields.
export const FIELD_LIMITS = {
  name: 200,
  dose: 100,
  notes: 1000,
  email: 254,
} as const;

// 24-hour HH:MM, e.g. "08:00", "20:30".
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
// RFC-4122-shaped UUID (Prisma @db.Uuid columns).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Deliberately permissive: one @, no whitespace, a dot in the domain.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const assertBodyObject = (body: unknown): Record<string, unknown> => {
  if (!isPlainObject(body)) {
    throw new ApiError(400, "request body must be a JSON object");
  }
  return body;
};

const requiredString = (value: unknown, field: string, max: number): string => {
  if (typeof value !== "string") {
    throw new ApiError(400, `${field} must be a string`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new ApiError(400, `${field} is required`);
  }
  if (trimmed.length > max) {
    throw new ApiError(400, `${field} must be at most ${max} characters`);
  }
  return trimmed;
};

// Optional free-text: absent/null/blank collapses to null; wrong type or
// oversized value is rejected.
const optionalNullableString = (
  value: unknown,
  field: string,
  max: number
): string | null => {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new ApiError(400, `${field} must be a string`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.length > max) {
    throw new ApiError(400, `${field} must be at most ${max} characters`);
  }
  return trimmed;
};

const parseTime = (value: unknown): string => {
  if (typeof value !== "string") {
    throw new ApiError(400, "time must be a string");
  }
  const time = value.trim();
  if (!time) {
    throw new ApiError(400, "time is required");
  }
  if (!TIME_RE.test(time)) {
    throw new ApiError(400, "time must be in HH:MM 24-hour format");
  }
  return time;
};

/** Validate a route param that must be a UUID (e.g. `/medicines/:id`). */
export const parseUuidParam = (value: unknown, field: string): string => {
  if (typeof value !== "string" || !value) {
    throw new ApiError(400, `${field} is required`);
  }
  if (!UUID_RE.test(value)) {
    throw new ApiError(400, `${field} must be a valid id`);
  }
  return value;
};

/** Validate and normalize an email (trimmed, lowercased). */
export const parseEmail = (value: unknown): string => {
  if (typeof value !== "string") {
    throw new ApiError(400, "email must be a string");
  }
  const email = value.trim().toLowerCase();
  if (!email) {
    throw new ApiError(400, "email is required");
  }
  if (email.length > FIELD_LIMITS.email) {
    throw new ApiError(400, `email must be at most ${FIELD_LIMITS.email} characters`);
  }
  if (!EMAIL_RE.test(email)) {
    throw new ApiError(400, "email must be a valid email address");
  }
  return email;
};

export type MedicineCreateInput = {
  name: string;
  time: string;
  dose: string | null;
  notes: string | null;
};

/** Full medicine payload for creation — name and time required. */
export const parseMedicineCreate = (body: unknown): MedicineCreateInput => {
  const obj = assertBodyObject(body);
  return {
    name: requiredString(obj.name, "name", FIELD_LIMITS.name),
    time: parseTime(obj.time),
    dose: optionalNullableString(obj.dose, "dose", FIELD_LIMITS.dose),
    notes: optionalNullableString(obj.notes, "notes", FIELD_LIMITS.notes),
  };
};

/** Partial medicine payload for updates — only provided fields are validated. */
export const parseMedicineUpdate = (body: unknown): Record<string, string | null> => {
  const obj = assertBodyObject(body);
  const updates: Record<string, string | null> = {};

  if (obj.name !== undefined) {
    updates.name = requiredString(obj.name, "name", FIELD_LIMITS.name);
  }
  if (obj.time !== undefined) {
    updates.time = parseTime(obj.time);
  }
  if (obj.dose !== undefined) {
    updates.dose = optionalNullableString(obj.dose, "dose", FIELD_LIMITS.dose);
  }
  if (obj.notes !== undefined) {
    updates.notes = optionalNullableString(obj.notes, "notes", FIELD_LIMITS.notes);
  }

  if (Object.keys(updates).length === 0) {
    throw new ApiError(400, "no fields provided to update");
  }
  return updates;
};

/** Validate a reminder status enum value. */
export const parseReminderStatus = (value: unknown): ReminderState => {
  if (value === ReminderState.Pending || value === ReminderState.Taken) {
    return value;
  }
  throw new ApiError(400, "status must be Pending or Taken");
};
