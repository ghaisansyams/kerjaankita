# Installation Guide

FlowDesk is a Next.js 15 (App Router) app backed by Supabase (Postgres + Auth +
Storage). This guide gets a fresh machine to a running local instance.

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | **20 LTS+** (18.18 min) | `node -v` |
| npm | 10+ | ships with Node 20 |
| A Supabase project | free tier is fine | [supabase.com](https://supabase.com) |
| Supabase CLI | optional | only for `supabase db push` |

## 1. Install dependencies

```bash
git clone <your-repo> flowdesk
cd flowdesk
npm install
```

## 2. Create a Supabase project

1. Create a project at supabase.com.
2. Project Settings → **API**: copy the Project URL, the `anon` key and the
   `service_role` key.

## 3. Configure environment

```bash
cp .env.local.example .env.local
```

Fill in the four values (see [ENVIRONMENT.md](./ENVIRONMENT.md)).

## 4. Apply the database schema

Run every file in `supabase/migrations/` **in order** (`0001` → `0017`):

- **SQL editor**: paste each migration and run, oldest first, or
- **CLI**: `supabase link --project-ref <ref>` then `supabase db push`.

This creates all tables, RLS policies, functions, triggers and the four storage
buckets (`avatars`, `branding`, `attachments`, `exports`).

## 5. Run

```bash
npm run dev        # http://localhost:3000
```

Register a user at `/register`, confirm the email (or disable email confirmation
in Supabase → Auth → Providers while developing), then complete `/onboarding` to
create your first organization.

See [LOCAL-DEVELOPMENT.md](./LOCAL-DEVELOPMENT.md) for the full local workflow and
[TROUBLESHOOTING.md](./TROUBLESHOOTING.md) if something fails.
