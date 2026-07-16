import { NextRequest } from "next/server";

/**
 * CSRF protection (P1-1).
 *
 * Cookie-based auth means the browser attaches the session cookie automatically,
 * so a cross-site form/fetch could act as the user. `sameSite=lax` blocks most
 * of this but is not sufficient alone. We add strict Origin validation on every
 * state-changing request:
 *
 *   - Safe methods (GET/HEAD/OPTIONS) are never CSRF-relevant → allowed.
 *   - Requests authenticated by an `Authorization: Bearer` header are not
 *     cookie-driven — an attacker's page cannot set that header cross-origin —
 *     so they are exempt (API clients, mobile).
 *   - Otherwise the request's Origin (or, if absent, the Referer's origin) must
 *     match the app's own origin or a configured allowlist. Origin is set by the
 *     browser and cannot be forged by cross-origin JavaScript.
 *
 * This is the "require strict same-origin / CORS" option from the plan; it needs
 * no token plumbing and same-origin app flows are unaffected (relative-URL
 * fetches send a matching Origin automatically).
 */

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const getAllowedOrigins = (request: NextRequest): Set<string> => {
  const allowed = new Set<string>();

  // The app's own origin, derived from the Host the request came in on.
  const host = request.headers.get("host");
  if (host) {
    allowed.add(`https://${host}`);
    allowed.add(`http://${host}`);
  }

  // Extra origins (e.g. a separate frontend domain) via env, comma-separated.
  const configured = process.env.ALLOWED_ORIGINS;
  if (configured) {
    for (const origin of configured.split(",")) {
      const trimmed = origin.trim();
      if (trimmed) allowed.add(trimmed);
    }
  }

  return allowed;
};

export const isCsrfSafe = (request: NextRequest): boolean => {
  if (SAFE_METHODS.has(request.method)) {
    return true;
  }

  // Bearer-token auth is immune to CSRF: cross-origin pages cannot set the
  // Authorization header on a request that carries the victim's credentials.
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return true;
  }

  const allowed = getAllowedOrigins(request);

  const origin = request.headers.get("origin");
  if (origin) {
    return allowed.has(origin);
  }

  // Some browsers omit Origin on same-origin requests; fall back to Referer.
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      return allowed.has(new URL(referer).origin);
    } catch {
      return false;
    }
  }

  // A cookie-authenticated mutating request with neither Origin nor Referer is
  // not a request we can vouch for — reject it.
  return false;
};
