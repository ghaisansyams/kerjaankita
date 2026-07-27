# Security Audit (Sprint 8)

How each required control is enforced, and where to verify it.

| Control | Status | Enforcement |
|---------|--------|-------------|
| **RLS** | ✅ | Enabled on all tenant tables; policies in `0008_rls.sql` using helpers in `0006_functions.sql`. Proven by `tests/integration/tenancy-isolation.test.ts` and `portal.test.ts`. |
| **Server Actions** | ✅ | All mutations are `"use server"` and return the `ActionResult` envelope. Every action taking input validates it with a Zod schema before any DB call (`signOut` / `markAllNotificationsRead` / `setActiveOrganization` take no untrusted payload). |
| **Auth guards** | ✅ | `requireOrgContext` / `requirePermission` / `requireInternal` in `src/lib/auth.ts` gate server components; unauthenticated → `/login`, no org → `/onboarding`, guest → `/portal`. |
| **Route protection** | ✅ | `middleware.ts` (`updateSession`) redirects unauthenticated users off non-public paths; `/invite` is explicitly public. Layouts re-check on the server. |
| **Signed URLs** | ✅ | Downloads go through `getDownloadUrl`: an RLS-scoped `getAttachment` (returns null if not visible) then a 60-second service-role signed URL. Private buckets are never public-readable. |
| **CSRF** | ✅ | Next.js Server Actions enforce same-origin/Origin checks by default; no custom mutation endpoints bypass this. |
| **Input validation** | ✅ | Zod schemas in `src/schemas/*`; server schema is authoritative even where a separate string-based client form schema exists. |
| **XSS** | ✅ | React escapes by default; no `dangerouslySetInnerHTML` in the app. User content (titles, comments) rendered as text. |
| **SQL injection** | ✅ | All DB access via the Supabase/PostgREST client with parameterized filters; no string-concatenated SQL in app code. Migrations are static SQL. |
| **Permission escalation** | ✅ | Capability-based RBAC via `has_permission`; scope-aware checks (org/workspace/project). The task column-guard trigger (`0012`) stops assignees editing manager-owned fields even though RLS lets them update the row. |
| **Multi-tenant isolation** | ✅ | Every tenant row carries `organization_id`; RLS predicates scope by membership. Cross-tenant read/write blocked — see `tenancy-isolation.test.ts` (4 cases incl. cross-tenant insert rejection). |
| **Guest isolation** | ✅ | Guests (`member_type='guest'`) see only their account's projects and only guest-visible files/activities; internal comments/attachments/activities are filtered out. See `portal.test.ts`. |
| **Audit logging** | ✅ | Domain events + membership/settings events written to `activities` via the SECURITY DEFINER `log_activity` (the only insert path; no direct INSERT policy). |
| **Secrets** | ✅ | Service-role key server-only (`admin.ts`); `.env.local` git-ignored; only the anon key (designed public) reaches the browser. |

## Residual / recommended follow-ups (non-blocking)
- **Content-Security-Policy**: baseline headers ship in `next.config.ts`; add a
  tuned CSP (report-only → enforce) at deploy time.
- **Rate limiting**: rely on Supabase Auth limits; consider edge rate-limiting for
  invite acceptance and auth endpoints under abuse.
- **Error tracking**: wire Sentry into the existing `error.tsx` hooks.
