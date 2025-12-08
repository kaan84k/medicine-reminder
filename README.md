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
- Models:
  - `User` — `id`, `email`, `passwordHash`, `createdAt`, relation to `Medicine`.
  - `Medicine` — `id`, `userId` (FK), `name`, `dose`, `time`, `notes`, `createdAt`, relation to `ReminderStatus`.
  - `ReminderStatus` — `id`, `medicineId` (FK), `date`, `status` enum (`Pending`/`Taken`).

## API foundation

- `GET /api/health` – readiness endpoint that reports environment status.
- `POST /api/auth` – development token generator (requires `email` or `userId`).
- `GET /api/users` – returns placeholder user data.
- `POST /api/users` – accepts user payload and echoes a created user with an ID.

## Tooling

- Lint: `npm run lint`
- Prettier check: `npm run format:check`
- Prettier write: `npm run format`

## Notes

- Data is still stored only in `localStorage` under `medicine_reminders_v1`. Clearing site data removes entries.
- Backend/API routes exist for future multi-user features but do not persist to a database yet.
