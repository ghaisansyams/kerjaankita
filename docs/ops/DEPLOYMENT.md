# Deployment Guide (Vercel + Supabase)

Deploy only after everything passes locally (`npm run build` + `npm test`).

## 1. Supabase (production project)

1. Create a **separate** Supabase project for production (don't reuse dev).
2. Apply migrations `0001` → `0017` in order (SQL editor or `supabase db push`).
3. Confirm the four buckets exist (`avatars`, `branding` — public; `attachments`,
   `exports` — private). They are created by `0009`.
4. **Auth** → URL configuration: set Site URL and add
   `https://<your-domain>/auth/callback` to the redirect allow-list.
5. **Realtime**: the `supabase_realtime` publication is populated by `0014`
   (tasks, milestones, comments, notifications, projects, activities,
   project_members). Verify Realtime is enabled for the project.
6. **Deadline notifications**: enable the `pg_cron` extension. `0016` schedules
   `generate_deadline_notifications()` daily at 06:05 when `pg_cron` is present.
   If you prefer, disable that and run it from a Supabase Scheduled Edge Function
   instead — the function is idempotent per calendar day.

## 2. Vercel

1. Import the repo. Framework preset: **Next.js** (auto-detected).
2. Project Settings → **Environment Variables** (see ENVIRONMENT.md), all four,
   for Production (and Preview if used):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` — **Sensitive**, server only
   - `NEXT_PUBLIC_SITE_URL` = your production URL
3. Deploy. Build command `next build`, output is the default `.next`.

## 3. Post-deploy smoke test

- Register → confirm email → onboarding → dashboard.
- Create a project + task; move a card on the board (realtime updates in a 2nd tab).
- Upload a file; download it (signed URL).
- Invite a guest → accept via the emailed/copied `/invite/<token>` link → verify
  the portal shows only their shared project.
- Open `/reports` and `/analytics`.

## Notes

- Security headers (`X-Frame-Options`, `nosniff`, `Referrer-Policy`,
  `Permissions-Policy`) ship via `next.config.ts`. A strict CSP is intentionally
  left for you to tune per environment — see the checklist.
- The service-role key must never appear in a `NEXT_PUBLIC_` variable or client
  bundle.
