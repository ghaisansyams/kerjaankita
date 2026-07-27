# FlowDesk — Database

Complete Postgres schema for Supabase: tables, indexes, foreign keys, RLS
policies, triggers, functions, a health/overview view, and storage buckets.

## Files

| File | Contents |
| --- | --- |
| `migrations/0001_init.sql` | Enums, tables, indexes, RLS helper functions, triggers, RLS policies, `project_overview` view, grants |
| `migrations/0002_storage.sql` | Storage buckets (`avatars`, `attachments`) + storage RLS policies |

## Apply the schema

**Option A — Supabase SQL editor (simplest)**

1. Open your project → **SQL Editor**.
2. Paste the contents of `0001_init.sql`, run it.
3. Paste the contents of `0002_storage.sql`, run it.

**Option B — Supabase CLI**

```bash
supabase link --project-ref <your-ref>
supabase db push
```

## First user

The **first** account to sign up automatically becomes `super_admin`
(see `handle_new_user()`). Every later signup defaults to `developer` unless a
`role` is provided in the user metadata. Change roles later from the Team
settings screen (super admin only).

## Roles & access

Access is enforced by **Row Level Security** — the source of truth, independent
of the UI:

| Role | Projects | Tasks | Notes |
| --- | --- | --- | --- |
| `super_admin` | all | all | full control |
| `project_manager` | all | all | manages projects, tasks, members, clients |
| `developer` | ones they're a member of / assigned | edit only their **assigned** tasks (status, progress, hours, evidence) | cannot edit project settings |
| `client` | their organisation's projects | read-only | no comments, only client-visible files |

## Scheduled job (optional)

`generate_deadline_notifications()` creates "due today / due tomorrow"
notifications. Schedule it daily with Supabase cron / `pg_cron`:

```sql
select cron.schedule(
  'flowdesk-deadlines', '0 7 * * *',
  $$ select public.generate_deadline_notifications(); $$
);
```

## Regenerating TypeScript types

`src/lib/database.types.ts` mirrors this schema. If you change the schema,
regenerate with the CLI:

```bash
supabase gen types typescript --project-id <ref> --schema public > src/lib/database.types.ts
```
