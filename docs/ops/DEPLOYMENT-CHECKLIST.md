# Production Deployment Checklist

Tick every box before going live.

## Supabase (database)
- [ ] Dedicated **production** project (separate from dev/staging).
- [ ] Migrations `0001`–`0017` applied in order; no drift.
- [ ] RLS is **enabled** on every public table (verify: Table editor → each table).
- [ ] Helper functions (`0006`) and triggers (`0007`, `0012`–`0016`) present.
- [ ] Point-in-time recovery / daily backups enabled (see Backup).

## Storage
- [ ] Buckets exist: `avatars` (public), `branding` (public), `attachments`
      (private), `exports` (private).
- [ ] Bucket policies applied (`0009`): avatars/branding owner-folder write,
      attachments/exports private.
- [ ] File size limits sane (attachments 50 MB, avatars/branding 5 MB).

## Authentication
- [ ] Email provider configured (SMTP for production email).
- [ ] Site URL = production origin.
- [ ] Redirect allow-list includes `https://<domain>/auth/callback`.
- [ ] Email confirmation policy decided (on for production).
- [ ] Password policy / rate limits reviewed.

## Environment variables (Vercel)
- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` — marked **Sensitive**, server scope only
- [ ] `NEXT_PUBLIC_SITE_URL` = production URL
- [ ] Service-role key is **not** present in any `NEXT_PUBLIC_*` var or client bundle.

## Vercel
- [ ] Framework = Next.js; build `next build` green.
- [ ] Production domain attached; HTTPS enforced.
- [ ] Security headers verified (curl the site: `X-Frame-Options`,
      `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`).
- [ ] Decide on a Content-Security-Policy (start report-only, then enforce).

## Cron jobs
- [ ] `pg_cron` enabled **or** a Scheduled Edge Function calls
      `select public.generate_deadline_notifications();` daily.
- [ ] Verified it inserts `deadline_today` / `deadline_tomorrow` notifications once/day.

## Backup
- [ ] Automated daily DB backups + PITR on the Supabase plan.
- [ ] Documented restore procedure; a restore rehearsed at least once.
- [ ] Storage bucket contents included in the backup/retention plan.

## Monitoring
- [ ] Error tracking wired (e.g. Sentry) into `error.tsx` / `global-error.tsx`
      (`console.error` hooks are already in place).
- [ ] Vercel Analytics / logs enabled; alerting on 5xx rate.
- [ ] Supabase logs + DB health (connections, slow queries) dashboards reviewed.
- [ ] Uptime check on the production URL.

## Final gates
- [ ] `npm run build`, `npm run lint`, `npm test` all green on the release commit.
- [ ] Post-deploy smoke test (see DEPLOYMENT.md) passed.
