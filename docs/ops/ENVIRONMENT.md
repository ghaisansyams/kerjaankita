# Environment Variables

Copy `.env.local.example` → `.env.local` and fill in these values. All are read
through `src/lib/env.ts`, which throws early if a required one is missing.

| Variable | Scope | Required | Description |
|----------|-------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | ✅ | Supabase project URL, e.g. `https://abcd.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server | ✅ | Anon/public key. Safe to ship to the browser (RLS enforces access). |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | ✅ | Service-role key. Powers signed-URL downloads and invitation acceptance. **Never** expose to the client or commit it. |
| `NEXT_PUBLIC_SITE_URL` | client + server | ✅ | Public origin, used for auth email redirects and invite links. `http://localhost:3000` locally. |

## Rules

- `NEXT_PUBLIC_*` values are inlined into the client bundle — only put
  non-secret values there. The anon key is designed to be public.
- `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS. It is used **only** in
  `src/lib/supabase/admin.ts` (server), for: creating signed download URLs after
  an RLS visibility check, and creating a membership when a user accepts an
  invitation. Keep it in Vercel's encrypted env, server scope only.
- `.env.local` is git-ignored. Never commit real keys.

## Where each is used

- Browser client (`src/lib/supabase/client.ts`) → `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Server client (`src/lib/supabase/server.ts`) → same two, plus cookie handling.
- Admin client (`src/lib/supabase/admin.ts`) → URL + `SUPABASE_SERVICE_ROLE_KEY`.
- Auth redirects (`src/features/auth/actions.ts`) → `NEXT_PUBLIC_SITE_URL`.
