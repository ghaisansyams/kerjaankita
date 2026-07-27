# Folder Structure

Layered architecture: **app → features → services → repositories → supabase**.
Only repositories import Supabase clients; only they touch the database.

```
src/
  app/                      # Next.js App Router
    (app)/                  # authenticated internal shell (redirects guests → /portal)
      dashboard/ projects/ tasks/ board/ timeline/ calendar/
      reports/ analytics/ notifications/ team/ clients/ settings/
      error.tsx loading.tsx # group-level 500 boundary + skeleton
    (auth)/                 # login / register / forgot / reset
    (portal)/               # read-only guest portal (own shell)
      error.tsx loading.tsx
    invite/[token]/         # public invitation acceptance
    auth/callback/          # Supabase auth callback
    not-found.tsx           # 404
    global-error.tsx        # root error fallback (own <html>)
    layout.tsx              # root layout + providers

  features/                 # one folder per feature: UI + actions + schemas usage
    <feature>/
      components/           # client components
      actions.ts            # "use server" Server Actions (mutations)
      loaders.ts            # server read helpers (some features)

  services/                 # pure domain logic (health, dashboard, reports, analytics)
  repositories/             # the ONLY layer that imports Supabase clients
  schemas/                  # Zod schemas (server-authoritative + client form schemas)
  components/
    ui/                     # shadcn/ui primitives
    domain/                 # progress-ring, health-badge, project-card, …
    data/                   # empty-state, etc.
  lib/
    supabase/               # client.ts (browser) · server.ts (RSC/actions)
                            # admin.ts (service role) · middleware.ts (session)
    auth.ts                 # getOrgContext / requireOrgContext / requirePermission / can
    env.ts errors.ts validation.ts utils.ts
  types/
    action.ts               # ActionResult envelope
    database.types.ts       # hand-maintained Supabase types
  utils/                    # format, csv, humanize-activity, …

supabase/
  migrations/               # 0001 → 0017, forward-only SQL (tables, RLS, triggers, functions, buckets)

tests/
  integration/              # Vitest + PGlite (real migrations); db.ts is the harness

docs/
  PRD, SDD, DATABASE, design/, features/   # the frozen blueprint
  ops/                      # this operational documentation
```

## Conventions

- **Mutations** = Server Actions returning `ActionResult<T>` (never throw expected
  failures). **Client reads** that need caching use TanStack Query + the browser
  client (RLS-scoped).
- **Every action** validates input with a Zod schema before touching the DB.
- **RLS is the source of truth** for access; UI permission checks are for UX only.
- **Forms** use React Hook Form + Zod; the server schema is authoritative.
