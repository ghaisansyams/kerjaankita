# Local Development Guide

Everything works on `localhost` without a production deploy — that is the
supported way to validate the app.

## Commands

```bash
npm run dev         # dev server, http://localhost:3000
npm run build       # production build + TypeScript + lint (fails on any error)
npm run start       # serve the production build locally
npm run lint        # ESLint only
npm run test        # Vitest (unit + integration)
npm run test:watch  # Vitest watch mode
```

## What to verify locally

- **Routes** — sign in and visit each nav item plus `/portal`, `/invite/<token>`,
  and the settings sub-pages. Unmatched URLs render `not-found.tsx`.
- **Server Actions** — create/edit/move a task, comment, upload a file, invite a
  member/guest. Failures surface as toasts (the `ActionResult` envelope), never
  crashes.
- **Migrations** — the test harness applies every migration to an in-memory
  Postgres on each run, so `npm test` passing means the full schema is valid.
- **Uploads** — avatars and attachments upload to Supabase Storage from the
  browser; downloads use short-lived signed URLs. Set `SUPABASE_SERVICE_ROLE_KEY`
  locally or downloads/invites will fail.
- **Auth** — register → confirm → onboarding → dashboard. Guests are redirected
  to `/portal`.

## Testing model

Integration tests run against **PGlite** (WebAssembly Postgres) with the real
migrations applied, so RLS, triggers and functions are exercised exactly as in
production. Tests live in `tests/integration/` and `src/**/*.test.ts`.

> Test-only note: PGlite mis-evaluates a few `STABLE` security-definer functions
> inside `INSERT … WITH CHECK`. The harness flips just those to `VOLATILE`
> (`tests/integration/db.ts`); **production keeps them `STABLE`** — this is the
> standard, correct pattern.

## Hot tips

- After editing `.env.local`, restart `npm run dev`.
- After adding a migration, add it to `supabase/migrations/` with the next number
  and it is picked up by both Supabase and the test harness automatically.
- Type generation is manual: update `src/types/database.types.ts` when you change
  the schema (add the table/column/relationship to match).
