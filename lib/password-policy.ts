import { ApiError } from "@/lib/http";

export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 200;

// Small embedded blocklist of the most common breached passwords. This is a
// pragmatic, offline stand-in for a full HIBP k-anonymity lookup — it catches
// the passwords that dominate credential-stuffing lists without a network call
// on the auth hot path. Extend as needed, or swap for an HIBP range query.
const COMMON_PASSWORDS = new Set(
  [
    "password",
    "password1",
    "password123",
    "passw0rd",
    "123456",
    "12345678",
    "123456789",
    "1234567890",
    "qwerty",
    "qwerty123",
    "111111",
    "000000",
    "iloveyou",
    "admin",
    "administrator",
    "welcome",
    "welcome1",
    "letmein",
    "monkey",
    "dragon",
    "abc123",
    "football",
    "baseball",
    "superman",
    "trustno1",
    "changeme",
    "secret",
    "master",
    "sunshine",
    "princess",
  ].map((p) => p.toLowerCase())
);

/**
 * Validate a raw password against the account policy.
 *
 * The password is intentionally NOT trimmed or otherwise mutated — every
 * character the user typed is part of the secret. We only read it here.
 *
 * @param password  raw password as received from the client
 * @param email     optional account email; the local-part must not appear in the password
 * @throws ApiError(400) with a clear, user-facing message when the policy is not met
 */
export const assertStrongPassword = (password: string, email?: string): void => {
  if (typeof password !== "string" || password.length === 0) {
    throw new ApiError(400, "password is required");
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new ApiError(
      400,
      `password must be at least ${MIN_PASSWORD_LENGTH} characters`
    );
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new ApiError(
      400,
      `password must be at most ${MAX_PASSWORD_LENGTH} characters`
    );
  }

  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  if (!hasLetter || !hasNumber) {
    throw new ApiError(400, "password must contain both letters and numbers");
  }

  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    throw new ApiError(
      400,
      "password is too common and has appeared in breaches; choose a stronger one"
    );
  }

  const localPart = email?.split("@")[0]?.toLowerCase();
  if (localPart && localPart.length >= 3 && password.toLowerCase().includes(localPart)) {
    throw new ApiError(400, "password must not contain your email name");
  }
};
