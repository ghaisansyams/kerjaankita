# FlowDesk

Internal project-management SaaS for an IT consultancy. One workspace where a
**CEO / Super Admin** sees every project's health, a **Project Manager** runs the
work, a **Developer** updates their own tasks, and a **Client** watches progress
read-only — replacing the "manage everything over WhatsApp" status quo.

## Stack

- **Next.js 15** (App Router, Server Actions) · **React 19** · **TypeScript**
- **Tailwind CSS v4** + **shadcn/ui** (radix-nova style, Radix primitives)
- **Supabase**: Postgres + Auth + Storage (accessed via `@supabase/ssr`)
- **TanStack Query** (client cache) · **React Hook Form** + **Zod** (forms/validation)
- **@dnd-kit** (kanban drag & drop) · **next-themes** (dark mode) · **lucide-react**
- Deploy target: **Vercel**

> This project is pinned to Next.js **15** on purpose (the spec requires it).
> Do not upgrade to Next 16 without an explicit request.

## Design language

Calm, premium, Linear/Notion-inspired. Palette is **white / slate / indigo**,
with blue reserved for chart accents. Colour only ever appears as small
status/priority chips — never as large filled surfaces. Tokens live in
`src/app/globals.css`; status/priority/health chip classes live in
`src/lib/constants.ts`. Font: **Inter** (UI) + **JetBrains Mono** (code/IDs).

## Roles (RBAC)

`super_admin` · `project_manager` · `developer` · `client`
(see `ROLES` in `src/lib/constants.ts`). Access is enforced in three layers:
middleware (authenticated vs. not) → route layouts (role gates) → **Postgres RLS**
(source of truth). Never rely on UI checks alone.

## Project structure

```
src/
  app/                 # routes (App Router)
  components/
    ui/                # shadcn primitives (generated)
    providers.tsx      # Theme + React Query providers
  lib/
    supabase/          # client.ts (browser) · server.ts (RSC/actions)
                       # middleware.ts (session refresh) · admin.ts (service role)
    constants.ts       # domain enums + labels + badge styles
    database.types.ts  # Supabase types (regenerated from the schema)
    env.ts             # env access + isSupabaseConfigured guard
  middleware.ts        # calls updateSession()
supabase/
  migrations/          # complete SQL schema (tables, RLS, triggers, functions, buckets)
```

## Conventions

- **Never use mock data.** Everything reads/writes Supabase.
- Feature = folder. Keep UI, data access, and validation separated.
- Server Actions for mutations; TanStack Query for client reads.
- Validate every action input with a Zod schema before touching the DB.
- Reuse shadcn primitives; do not hand-roll components that already exist in `ui/`.

## Commands

```bash
npm run dev     # start dev server (http://localhost:3000)
npm run build   # production build + typecheck + lint
npm run lint    # eslint
```

## Supabase setup

1. Create a project at supabase.com and copy the API keys.
2. `cp .env.local.example .env.local` and fill in the values.
3. Run the SQL in `supabase/migrations/` via the Supabase SQL editor
   (or `supabase db push` with the CLI).
