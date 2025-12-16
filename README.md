# Medicine Reminder (MVP)

Simple web app to record medicines, mark doses as taken, and keep a day-at-a-glance schedule. The app now includes a small Next.js API foundation to support future authenticated, multi-user work.

## Tech stack

- Next.js (App Router + API routes)
- TypeScript
- Bootstrap (via CDN)
- LocalStorage (browser-only persistence)

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

- `GET /api/health` – readiness endpoint that reports environment status.
- `POST /api/auth/signup` – register with `email`/`password`, hashes via bcrypt, and issues an HTTP-only session cookie.
- `POST /api/auth/login` – sign in with `email`/`password`, issues an HTTP-only session cookie.
- `POST /api/auth/logout` – clears the session cookie.
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

- Data is still stored only in `localStorage` under `medicine_reminders_v1`. Clearing site data removes entries.
- Backend/API routes exist for future multi-user features but do not persist to a database yet.
