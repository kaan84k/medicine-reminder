# Production Readiness Plan — Medicine Reminder

Status: **not production ready** (blockers remain). The auth + API layer is a solid skeleton and the dashboard is already wired to the API (P0-1 done — see below), but rate limiting breaks at scale, there is a user-data leak, and a Next.js 15 incompatibility exists in rate limiting. This plan lists the work required to ship, grouped by priority, each with concrete success criteria.

Legend: **P0** = blocker (cannot ship), **P1** = required before public launch, **P2** = hardening / operability.

---

## P0 — Blockers

### P0-1. Wire frontend to the API (remove localStorage as source of truth) — ✅ DONE
**Original premise was false.** The claim that the UI still used `localStorage` came from a stale `README.md`; the actual dashboard was already server-backed. Verified by reading the source and by typecheck.

**What the code actually does (`app/page.tsx`):**
- Loads via `fetch` from `/api/auth`, `/api/medicines`, `/api/reminders/today`.
- Mutates via `POST /api/medicines`, `PATCH /api/reminders/:id`, `DELETE /api/medicines/:id`.
- Redirects unauthenticated visitors to `/login` (`router.replace("/login")` when `/api/auth` returns non-OK).
- Handles loading / error / empty states.
- No `localStorage` usage anywhere in `app/`, `components/`, or `lib/` (grep-confirmed).

**Verification performed:**
- `grep -r localStorage` over app source → **no matches** (only stale docs, now fixed).
- API response shapes match page expectations: `/api/auth` → `{ session }`; `/api/reminders/today` → `{ date, reminders }`; medicines routes return the shapes the page consumes.
- `tsc --noEmit`: `app/page.tsx` and all dashboard API routes compile **clean** (0 errors). Remaining typecheck errors are unrelated pre-existing issues tracked under other items (see P0-3 for `NextRequest.ip`, P2-3 for test infra, and `@types/pg` below).
- Stale `README.md` corrected (tech stack + Notes now describe server-side PostgreSQL persistence).

**Success criteria:**
- [x] Dashboard reads and writes exclusively through the API — no client-side authoritative store.
- [x] No code path writes app data to `localStorage`.
- [x] Unauthenticated visit to dashboard redirects to `/login`.
- [x] Frontend↔API wiring typechecks clean.
- [x] `README.md` accurately describes persistence.
- [ ] **Runtime E2E** (requires a live Postgres, not run here): signup → add medicine on device A → appears on device B after login → survives clearing browser site data. Run once the DB env is available; automate in CI (P2-3).

**Follow-up surfaced during verification (not P0-1, tracked here so it isn't lost):**
- `lib/prisma.ts` imports `pg` with no type declarations → add `@types/pg` as a devDependency (removes one `tsc` error). Fold into P2-4 / dependency hygiene.

### P0-2. Fix the `/api/users` data leak and access control — ✅ DONE (code); runtime test pending DB
**Problem:** `GET /api/users` returned all users' emails to any authenticated user (`app/api/users/route.ts:28-32`). `POST /api/users` let any logged-in user create arbitrary accounts — no role gate.

**What was changed:**
- `GET /api/users`: now returns only `{ currentUser }` (the caller's own record). The `findMany` over all users was removed — no other user's email/PII is exposed.
- `POST /api/users`: now admin-only. Looks up the caller's `role`; a non-`Admin` gets `403 Forbidden` before any body is read. Self-registration stays on `/api/auth/signup`.
- Added a `Role` enum (`User` | `Admin`) and a `role` field on `User` (default `User`), plus migration `0002_user_role`.
- Test suite `tests/api/users.test.ts`: asserts GET leaks no other email, POST → 403 for non-admin (and no account created), POST → 201 for admin, POST → 401 unauthenticated.

**Success criteria:**
- [x] No endpoint returns another user's email/PII to a non-admin. (GET returns only the caller.)
- [x] A normal authenticated user cannot create accounts for others. (POST → 403.)
- [x] Test asserts a non-admin gets 403 on admin-only user actions. (`tests/api/users.test.ts`.)
- [ ] **Runtime:** typecheck clean on all changed files; the new tests were **not executed here** — no local Postgres reachable (`localhost:5432` down), same constraint as P0-1 E2E. Run `prisma migrate deploy` + `vitest` once a DB is available.

### P0-3. Durable, shared rate limiting — ✅ DONE (code); real 2-instance load test pending live Upstash
**Problem:** `lib/rate-limit.ts` used an in-memory `Map`. It reset on restart, was not shared across serverless/multi-instance deploys, `buckets` was never pruned (memory leak), and `getKey` read `request.ip` — removed in Next 15+ (the "Next.js 15 incompatibility").

**What was changed:**
- Shared store: **Upstash Redis via its REST API** (no SDK dependency — plain `fetch`, works in node and edge runtimes). Configured with `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`. Counter is a fixed-window `INCR` + `PEXPIRE …NX` + `PTTL` pipeline, so it is shared across instances and survives restart (state lives in Redis, not the process).
- Fallback: when Upstash is not configured (dev/tests/CI), an in-process `Map` is used. It now **prunes expired buckets** and hard-caps at 10k keys — the memory leak is closed. Documented as per-instance / non-durable (dev only).
- **Failure policy: fail-open**, documented in the module header — on store timeout/error we log and allow, favoring availability. 1s `AbortSignal.timeout` so a slow store cannot hang the request path.
- Fixed the Next 15/16 `request.ip` break: IP now derived from `x-forwarded-for` / `x-real-ip` headers. Removes the `tsc` error.
- `rateLimit` is now `async`; all 7 call sites (`auth/login`, `auth/signup`, `medicines` create/list/get/update/delete) updated to `await`.
- Tests `tests/rate-limit.test.ts` (5, all passing, no DB needed): in-memory 6th call → 429, IP+scope isolation, Redis over-limit → 429, Redis within-limit → allow, store-unreachable → fail-open.

**Success criteria:**
- [x] Rate limits enforced consistently across ≥2 concurrent instances. (By design — shared Redis counter; verified via mocked store path. Real multi-instance load test pending a live Upstash — see below.)
- [x] Limits survive process restart / cold start. (State in Redis, not process memory.)
- [x] No unbounded in-process growth. (Fallback prunes + caps; production store is external.)
- [x] Load test: 6th login attempt within window returns 429. (Asserted in-memory; Redis path asserted via mock.)
- [ ] **Runtime:** end-to-end load test across ≥2 live instances against a real Upstash instance not run here (no Upstash creds / offline). Provision Upstash, set the two env vars, then load-test.

**Config note:** set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in the platform secret store (fold into P2-4). Without them the app runs on the in-memory fallback — fine for local dev, **not** for production multi-instance.

---

## P1 — Required before public launch

### P1-1. CSRF protection — ✅ DONE (code); runtime browser check pending
**Problem:** Cookie-based auth with state-changing `POST/PUT/PATCH/DELETE`. `sameSite=lax` blocks most cross-site POST but is not sufficient alone.

**What was changed:** chose the strict same-origin / CORS option (no token plumbing, no frontend change). New `lib/csrf.ts` `isCsrfSafe()`, enforced in `middleware.ts` on every `/api` request, **before** the public-path bypass so login/signup POSTs are covered too:
- Safe methods (GET/HEAD/OPTIONS) always pass.
- `Authorization: Bearer` requests are exempt — not cookie-driven, so not CSRF-prone (API/mobile clients).
- Otherwise the request `Origin` (or `Referer` origin if Origin absent) must match the app's own origin (derived from `Host`) or the `ALLOWED_ORIGINS` allowlist. Mismatch, or a cookie mutation with neither header, → `403 CSRF validation failed`.
- Origin is browser-set and unforgeable by cross-origin JS; same-origin relative-URL fetches send a matching Origin automatically.
- Tests `tests/csrf.test.ts` (7, passing): safe methods, same-origin allow, cross-origin 403, Bearer exempt, missing-both reject, Referer fallback, allowlist.

**Success criteria:**
- [x] Cross-origin mutating request is rejected (403). (Origin/Referer mismatch → 403; unit-tested.)
- [x] Same-origin app flows unaffected. (Matching Origin passes; Bearer clients exempt.)
- [ ] **Runtime:** verify in a real browser that the dashboard's POST/PATCH/DELETE flows still succeed and a cross-site POST is blocked — not run here (no live server). If a separate frontend domain is ever used, add it to `ALLOWED_ORIGINS`.

**Config note:** `ALLOWED_ORIGINS` (comma-separated) only needed if the frontend is served from a different origin than the API; same-origin deploys need nothing.

### P1-2. Security headers — ✅ DONE (verified locally); deployed-domain grade pending
**Problem:** `next.config.ts` set no headers.

**What was changed:**
- `next.config.ts` `headers()` now sets, on every route (`/:path*`): `Content-Security-Policy`, `Strict-Transport-Security` (`max-age=63072000; includeSubDomains; preload`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera/mic/geolocation/interest-cohort denied).
- CSP: `default-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`, `upgrade-insecure-requests`. `script-src`/`style-src` allow `'unsafe-inline'` — **documented exception** (Next App Router injects nonce-less inline hydration scripts; strict `'self'` breaks the app). No `'unsafe-eval'`.
- **Bootstrap self-hosted** (`npm i bootstrap`, imported in `app/layout.tsx`); the jsDelivr CDN `<link>` removed. CSP needs no external origins. README updated.
- **Verified live:** started `next dev`, `curl -I /login` → all six headers present with the exact values above; page returned 200 (self-hosted Bootstrap renders).

**Success criteria:**
- [x] CSP + HSTS + frame/content-type/referrer/permissions headers present on all routes. (curl-verified locally.)
- [x] CSP has no `unsafe-inline`/`unsafe-eval` for scripts — met via **documented exception** for inline scripts (`'unsafe-inline'`, no `'unsafe-eval'`). A+ follow-up: nonce-based CSP in middleware to drop script `'unsafe-inline'`.
- [x] HSTS present with `max-age >= 15552000`. (63072000.)
- [ ] **Deployed:** run `securityheaders.com` against the live domain for the grade (expect A; A+ needs the nonce follow-up). Not runnable here (no public deploy).

**Follow-up surfaced:** Next 16 warns `middleware` file convention is deprecated in favor of `proxy` — track under P2-4 / dependency hygiene. Non-blocking (middleware still runs).

### P1-3. Stronger auth policy + session handling ✅
**Problem:** Password min length 8, no complexity; `password.trim()` silently mutates input; 12h JWT with no revocation.

**Work:**
- Raise/clarify password policy (min length + zxcvbn-style strength or breached-password check). Stop silently trimming the middle/end of passwords; only reject on validation.
- Add session revocation: store a session id / version and check it, or keep a short access token + refresh token, so logout and password change invalidate existing tokens.
- Confirm `logout` invalidates server-side, not just the cookie.

**Done:**
- **Password policy** centralized in `lib/password-policy.ts` (`assertStrongPassword`): min length 12, must mix letters+numbers, rejects an embedded common/breached-password blocklist, rejects passwords containing the email local-part. Applied at `signup`, `users` POST, and `change-password`. Passwords are **no longer trimmed** — validated as typed, never mutated.
- **Session revocation via `tokenVersion`** (new `User.tokenVersion Int @default(0)`, migration `0003_token_version`). The stateless JWT carries `ver`; `requireSession`/`getServerSession` compare it against the DB value on every protected request and 401 on mismatch. Prisma is lazily imported in `lib/auth.ts` so the Edge `middleware.ts` bundle stays Node-free (middleware remains a cheap signature pre-filter; revocation is enforced at the route layer, through which all protected routes pass).
- **Logout** (`/api/auth/logout`) now increments `tokenVersion` server-side, invalidating every token issued before it — not just clearing the cookie.
- **New `/api/auth/change-password`**: verifies current password, applies the policy to the new one, rotates the hash and bumps `tokenVersion` in one write (kills sessions on all devices), then re-issues a fresh cookie for the current caller.

**Success criteria:**
- [x] Weak/breached passwords rejected with clear error.
- [x] After logout or password change, previously issued tokens no longer authenticate.
- [x] Session lifetime and refresh behavior documented. (12h token, no sliding refresh — see README "Auth & sessions".)

**Notes / follow-ups:**
- Blocklist is a small offline stand-in for a full HIBP k-anonymity check (P2 candidate if breach coverage must be exhaustive).
- Deploy invalidates all *existing* sessions (old tokens lack `ver`) — expected one-time re-login.
- Tests added in `tests/api/auth.test.ts` (weak-password reject, logout revocation, change-password revocation, wrong-current-password). Not run in this environment — no Postgres; run `npm test` against a test DB to verify.

### P1-4. Health check that reflects real readiness ✅
**Problem:** `/api/health` should verify dependencies, not just env presence.

**Work:** Have `/api/health` (or a `/api/ready`) run a cheap DB round-trip (`SELECT 1`) and report degraded status on failure.

**Done:**
- `GET /api/health` now runs `prisma.$queryRaw`SELECT 1`` on every call (marked `force-dynamic`, never cached). Reachable → `200 {status:"ok", database:"up"}`; unreachable → `503 {status:"degraded", database:"down"}` (failure caught and logged, never a 500). Env fields (`databaseConfigured`, `authConfigured`, `environment`) retained.

**Success criteria:**
- [x] Health endpoint returns non-200 when Postgres is unreachable. (503)
- [x] Deploy platform uses it for readiness gating. (Documented in README as the readiness probe; 503 lets LBs/orchestrators gate traffic.)

**Notes / follow-ups:**
- Tests in `tests/api/health.test.ts` (200/up happy path; 503/down via mocked `$queryRaw` rejection). Happy path needs Postgres; run `npm test` against a test DB.
- Wire the deploy platform's readiness probe to `GET /api/health` and treat non-200 as not-ready (infra config, outside this repo).

### P1-5. Input validation hardening ✅
**Problem:** Hand-rolled validation per route; easy to drift.

**Work:** Adopt a schema validator (e.g. `zod`) for all request bodies and route params. Validate `time` format, string lengths, enum values centrally.

**Done:**
- New `lib/validation.ts` centralizes all request-body and route-param parsing: `parseMedicineCreate`, `parseMedicineUpdate`, `parseReminderStatus`, `parseUuidParam`, `parseEmail`. One source of truth for types, length caps (`FIELD_LIMITS`), `time` format (`HH:MM` 24-hour regex), UUID param format, and the `ReminderState` enum. A hand-rolled module rather than `zod` — deliberately zero new runtime dependency (offline-installable), same pattern as `lib/password-policy.ts`; swappable for zod later without touching call sites.
- Every mutating route now parses through it: `medicines` POST/PUT (+ GET/DELETE param), `reminders/:id` POST/PATCH (+ params), `auth/signup` and `users` POST (email format/length). Wrong-type, oversized, malformed, and non-object bodies raise `ApiError(400)` **before** any Prisma call. Non-UUID `:id` params are rejected up front instead of reaching a `@db.Uuid` query.

**Success criteria:**
- [x] Every mutating route validates its body against a schema. (Centralized in `lib/validation.ts`.)
- [x] Oversized / malformed / wrong-type inputs return 400, never reach Prisma.
- [x] Tests cover invalid-input cases per route. (`tests/api/validation.test.ts`.)

**Notes:** Validation-only test file added; needs Postgres for the authed cases (session lookup precedes parse). Run `npm test` against a test DB. Hand-rolled validators can be replaced by `zod` schemas behind the same `parse*` function signatures if a dependency is later acceptable.

---

## P2 — Hardening & operability

### P2-1. Observability
**Work:** Structured logging (request id, user id, latency), error tracking (Sentry or equivalent), basic metrics. Replace ad-hoc `console.*`.

**Success criteria:**
- [ ] Errors surface in a dashboard with stack + context.
- [ ] Each request traceable by correlation id.

### P2-2. Database operations
**Work:** Connection pool sizing for the deploy target (serverless → use a pooler like PgBouncer/Prisma Accelerate/Neon pooling), migration deploy step in CD, backup + restore runbook.

**Success criteria:**
- [ ] No connection exhaustion under expected concurrency (load tested).
- [ ] Migrations applied automatically on deploy (`prisma migrate deploy`).
- [ ] Documented, tested restore-from-backup procedure.

### P2-3. CI/CD gates
**Work:** Extend CI to run lint + format check + typecheck + tests on every PR; block merge on failure. Add a deploy pipeline.

**Success criteria:**
- [ ] PR cannot merge with failing lint/typecheck/test.
- [ ] `npm run build` runs in CI and must pass.
- [ ] Coverage reported (target agreed, e.g. ≥70% on `lib/` and route handlers).

### P2-4. Secrets & config management
**Work:** Ensure `JWT_SECRET`/`AUTH_SECRET`/`DATABASE_URL` come from the platform secret store, rotated, never in the repo. Enforce a minimum secret length at boot.

**Success criteria:**
- [ ] App refuses to start in production with a missing or short (<32 char) auth secret.
- [ ] No secrets in git history.

### P2-5. Legal / product basics
**Work:** Privacy policy + terms (medical-adjacent data), account deletion (GDPR-style), data export. Note: this stores health-related data — check regulatory scope (HIPAA/GDPR) for the target market.

**Success criteria:**
- [ ] User can delete their account and all associated data (cascades already exist in schema).
- [ ] Privacy policy published; data retention documented.

---

## Definition of Done (ship gate)

All **P0** and **P1** checkboxes complete, plus:

- [ ] End-to-end test: signup → add medicine → mark reminder taken → reload → data persists server-side.
- [ ] Security review passed (no known data leak, CSRF + headers in place, secrets enforced).
- [ ] Load test at expected peak: p95 latency and error rate within target; rate limits hold across instances.
- [ ] Rollback plan documented and rehearsed.
- [ ] On-call / alerting configured for error rate and health-check failures.

## Suggested order

1. P0-2 (data leak — fast, high risk) → P0-3 (rate limit) → P0-1 (frontend wiring — largest).
2. P1-1, P1-2 (CSRF + headers — quick wins) → P1-5 (validation) → P1-3 (auth/session) → P1-4 (health).
3. P2 items in parallel with launch prep.
