# FlowDesk

Internal project-management SaaS for an IT consultancy. One workspace where a
**CEO / Super Admin** sees every project's health, a **Project Manager** runs the
work, a **Developer** updates their own tasks, and a **Client** watches progress
read-only — replacing the "manage everything over WhatsApp" status quo.

## Stack

- **Next.js 15** (App Router, Server Actions) · **React 19** · **TypeScript**
- **Tailwind CSS v4** + **shadcn/ui** (radix-nova style, Radix primitives)
- **Neon PostgreSQL**: Serverless Postgres (accessed via `@prisma/adapter-pg` + `pg` pool)
- **Prisma ORM (v7)**: Type-safe database queries, migrations, and schema management
- **NextAuth.js v5 (Auth.js)**: Credentials authentication with bcryptjs + session JWT
- **TanStack Query** (client cache & background polling) · **React Hook Form** + **Zod** (forms/validation)
- **@dnd-kit** (kanban drag & drop) · **next-themes** (dark mode) · **lucide-react**
- Deploy target: **kerjaankita.spero-lab.id**

> This project is pinned to Next.js **15** on purpose (the spec requires it).
> Do not upgrade to Next 16 without an explicit request.

## Design language

Calm, premium, Linear/Notion-inspired. Palette is **white / slate / indigo**,
with blue reserved for chart accents. Colour only ever appears as small
status/priority chips — never as large filled surfaces. Tokens live in
`src/app/globals.css`; status/priority/health chip classes live in
`src/constants/index.ts`. Font: **Inter** (UI) + **JetBrains Mono** (code/IDs).

## Roles (RBAC)

`super_admin` · `project_manager` · `developer` · `client`
(see `ROLES` in `src/constants/index.ts`). Access is enforced in three layers:
middleware (authenticated vs. not) → route layouts (role gates) → Prisma queries with
organization/membership checks. Never rely on UI checks alone.

## Project structure

```
prisma/
  schema.prisma        # Complete database schema (all 47+ models, relations, enums)
  seed.ts              # Database seeder (industries, roles, permissions, workflow templates)
src/
  app/                 # routes (App Router)
  components/
    ui/                # shadcn primitives (generated)
    providers.tsx      # Theme + React Query providers
  lib/
    prisma.ts          # Singleton Prisma client with @prisma/adapter-pg
    auth.ts            # Server-side auth helpers (auth(), requireOrgContext, getUser, getProfile)
    env.ts             # Typed env access & database connection check
  constants/           # domain enums + labels + badge styles
  repositories/        # All 25 domain repositories powered by Prisma
  auth.ts              # Node-runtime NextAuth configuration (credentials + bcrypt)
  auth.config.ts       # Edge-compatible NextAuthConfig
  middleware.ts        # NextAuth edge middleware route protection
```

## Conventions

- **Never use mock data.** Everything reads/writes the Neon PostgreSQL database via Prisma.
- Feature = folder. Keep UI, data access, and validation separated.
- Server Actions for mutations; TanStack Query for client reads.
- Validate every action input with a Zod schema before touching the DB.
- Reuse shadcn primitives; do not hand-roll components that already exist in `ui/`.

## Commands

```bash
npm run dev     # start dev server (http://localhost:3000)
npm run build   # production build + typecheck + lint
npm run lint    # eslint
npx prisma db push # push schema to Neon
npm run db:seed # seed database
```
