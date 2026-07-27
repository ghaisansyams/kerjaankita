# Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| App redirects to `/` or throws on boot | Missing env vars | Fill all four in `.env.local`; restart `npm run dev`. |
| "Missing environment variable …" | `src/lib/env.ts` guard | The named variable is unset. |
| Login works but every list is empty | No organization yet | Complete `/onboarding`. Data is org-scoped by RLS. |
| File download fails / "couldn't create link" | `SUPABASE_SERVICE_ROLE_KEY` unset | Signed URLs need the service-role key (server). |
| Accepting an invite errors | service-role key unset, or link expired | Set the key; regenerate the invite (14-day expiry). |
| Guest sees nothing in the portal | Guest not linked to the project's account | Invite as **Guest** with the correct client account; the project must have that `account_id`. |
| Realtime board doesn't sync across tabs | Realtime disabled / table not published | Enable Realtime; confirm migration `0014` ran. |
| Deadline notifications never fire | `pg_cron` not enabled | Enable `pg_cron`, or run `generate_deadline_notifications()` from a scheduled function. |
| `npm test` fails on a fresh clone | Stale deps | `rm -rf node_modules && npm install`. |
| Build fails: "relation between X and Y not found" | `database.types.ts` missing an FK relationship | Add the `Relationships` entry to match the migration. |
| Avatar/logo upload rejected | Wrong folder or type | Files must go to `{userId}/…` (avatars) / `{orgId}/…` (branding); images only. |
| Transition rejected changing a task status | Workflow transition rule | The target status isn't an allowed transition from the current one. |

## Diagnosing RLS issues

If a query returns nothing unexpectedly, it's almost always RLS doing its job:
check the acting user's membership (`organization_members`), `member_type`, and
for guests the `account_id` match against the project's `account_id`. The
policies live in `supabase/migrations/0008_rls.sql`; the helper functions in
`0006_functions.sql`.

## Where errors surface

- Expected failures → returned as `ActionResult` and shown as a toast.
- Unexpected server errors → the nearest `error.tsx` boundary (`(app)` / `(portal)`),
  or `global-error.tsx` for root failures.
- Unmatched routes → `not-found.tsx`.
