# Medicine Reminder (MVP)

Simple web app to record medicines, mark doses as taken, and keep a day-at-a-glance schedule. Everything is stored locally in the browser—no backend or login required.

## Tech stack
- Next.js (App Router)
- TypeScript
- Bootstrap (via CDN)
- LocalStorage (browser-only persistence)

## Prerequisites
- Node.js 18+

## Run locally
```bash
npm install
npm run dev
```
Then open [http://localhost:3000](http://localhost:3000).

## Notes
- Data is stored only in `localStorage` under `medicine_reminders_v1`. Clearing site data removes entries.
- No backend, authentication, or multi-user features are implemented in this MVP.
