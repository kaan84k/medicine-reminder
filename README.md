# Medicine Reminder (MVP)

Simple web app to record medicines, mark doses as taken, and keep a day-at-a-glance schedule. The app is authenticated and multi-user: the browser UI reads and writes through the Next.js API, which persists to PostgreSQL via Prisma.

## Tech stack

- Next.js (App Router + API routes)
- TypeScript
- Bootstrap (self-hosted via npm; imported in `app/layout.tsx`)
- PostgreSQL + Prisma (server-side persistence, per-user)

## Prerequisites

- Node.js 18+

## Environment variables

Create a `.env.local` file (ignored by git) with the required variables:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/medicine_reminder"
JWT_SECRET="development-jwt-secret"
AUTH_SECRET="development-auth-secret"
```

`DATABASE_URL` and one of `JWT_SECRET`/`AUTH_SECRET` must be present for the API routes to start.

## Run locally

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Database & Prisma

- Start a PostgreSQL instance that matches `DATABASE_URL` (see `.env` or `.env.local`).
- Initialize/update the schema via Prisma:
  - Create migration and apply: `npx prisma migrate dev --name init`
  - Regenerate client only: `npm run prisma:generate`
  - Inspect data: `npm run prisma:studio` (runs headless; open the printed URL)
- A migration SQL (`prisma/migrations/0001_init/migration.sql`) has been generated; run `prisma migrate dev` against a running database to apply it.
- Models:
  - `User` — `id`, `email`, `passwordHash`, `createdAt`, relation to `Medicine`.
  - `Medicine` — `id`, `userId` (FK), `name`, `dose`, `time`, `notes`, `createdAt`, relation to `ReminderStatus`.
  - `ReminderStatus` — `id`, `medicineId` (FK), `date`, `status` enum (`Pending`/`Taken`).

## API foundation

- `GET /api/health` – readiness probe. Runs a live `SELECT 1` against Postgres: returns `200` `{status:"ok", database:"up"}` when reachable, `503` `{status:"degraded", database:"down"}` when not. Also reports `environment`, `databaseConfigured`, `authConfigured`. Wire your deploy platform's readiness check to this and treat non-200 as not-ready.
- `POST /api/auth/signup` – register with `email`/`password`, hashes via bcrypt, and issues an HTTP-only session cookie.
- `POST /api/auth/login` – sign in with `email`/`password`, issues an HTTP-only session cookie.
- `POST /api/auth/logout` – clears the session cookie **and** bumps the user's `tokenVersion`, invalidating every previously issued token server-side.
- `POST /api/auth/change-password` – protected; verifies `currentPassword`, applies the password policy to `newPassword`, rotates the hash, invalidates all existing sessions, and re-issues a cookie for the caller.
- `GET /api/auth` – returns the current session payload when authenticated.
- `GET /api/users` – protected; returns the current user plus a recent user list.
- `POST /api/users` – protected; create another user (requires `email` and `password`).
- `GET /api/medicines` – protected; list medicines for the authenticated user.
- `POST /api/medicines` – protected; create a medicine (`name`, `time`, optional `dose`, `notes`).
- `GET /api/medicines/:id` – protected; fetch a single medicine owned by the user.
- `PUT /api/medicines/:id` – protected; update a medicine (validates provided fields).
- `DELETE /api/medicines/:id` – protected; delete a medicine.
- `POST /api/reminders/:medicineId` – protected; create today’s reminder for a medicine (idempotent, defaults to Pending).
- `PATCH /api/reminders/:id` – protected; update a reminder status (`Pending`/`Taken`).
- `GET /api/reminders/today` – protected; ensure today’s reminders exist for all medicines and return them.

## Auth & sessions

- **Password policy** (`lib/password-policy.ts`): minimum 12 characters, must contain both letters and numbers, may not be a common/breached password (offline blocklist), and may not contain the email local-part. Passwords are validated exactly as typed — never trimmed or otherwise mutated.
- **Sessions** are stateless HS256 JWTs in an HTTP-only, `SameSite=Lax` cookie (`Secure` in production), **12-hour lifetime, no sliding refresh**. Re-authentication is required after expiry.
- **Revocation** is version-based. Each user has a `tokenVersion`; the JWT embeds it as `ver`. Every protected request compares the token's `ver` to the current DB value (`requireSession`/`getServerSession`) and rejects a mismatch with `401`. Middleware stays a cheap signature check (Edge runtime, no DB); revocation is enforced at the Node route layer, which all protected routes pass through.
- **What invalidates a token:** `POST /api/auth/logout` and `POST /api/auth/change-password` both increment `tokenVersion`, so all tokens issued earlier — on any device — stop authenticating immediately.
- Deploying this change invalidates all currently active sessions (older tokens carry no `ver`); users log in once more afterward.

## Tooling

- Lint: `npm run lint`
- Prettier check: `npm run format:check`
- Prettier write: `npm run format`
- Tests (Vitest): `npm test` (watch: `npm run test:watch`)

## Testing

- Use a dedicated Postgres URL via `TEST_DATABASE_URL` (or `DATABASE_URL`). `.env.test` is loaded automatically when running tests.
- Apply migrations to the test database first: `DATABASE_URL=$TEST_DATABASE_URL npx prisma migrate deploy`.
- Run the suite: `npm test`.

## Notes

- All application data (medicines and reminder statuses) is persisted server-side in PostgreSQL, scoped to the authenticated user. Clearing browser site data does not remove it.
- The dashboard (`app/page.tsx`) loads and mutates data exclusively through the API routes above; it holds no client-side source of truth. Unauthenticated visitors are redirected to `/login`.
