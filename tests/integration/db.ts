import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const MIGRATIONS = path.join(process.cwd(), "supabase", "migrations");

/**
 * Mocks the Supabase-managed `auth` + `storage` schemas the migrations depend
 * on, plus the anon/authenticated/service_role roles and `auth.uid()` (driven
 * by the `app.current_user_id` GUC).
 */
const BOOTSTRAP = `
create schema if not exists auth;
create schema if not exists storage;
create table if not exists auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb not null default '{}'::jsonb, created_at timestamptz default now());
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.current_user_id', true), '')::uuid $$;
create table if not exists storage.buckets (id text primary key, name text not null, public boolean default false, file_size_limit bigint, allowed_mime_types text[], created_at timestamptz default now());
create table if not exists storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text, owner uuid, created_at timestamptz default now());
alter table storage.objects enable row level security;
create or replace function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name,'/'))[1 : greatest(array_length(string_to_array(name,'/'),1)-1,0)] $$;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
end $$;
grant usage on schema auth, storage to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant execute on function storage.foldername(text) to anon, authenticated, service_role;
grant select, insert, update, delete on storage.objects, storage.buckets to authenticated;
`;

/**
 * TEST-ONLY: PGlite mis-evaluates STABLE security-definer functions inside an
 * INSERT WITH CHECK (they work fine in USING/SELECT). Real Postgres/Supabase
 * handle STABLE correctly — it is the standard pattern. We flip the functions
 * used in WITH CHECK to VOLATILE (keeping their bodies) so the harness can
 * exercise inserts; production keeps them STABLE (0006_functions.sql).
 */
const VOLATILITY_SHIM = `
alter function public.has_permission(uuid, text, uuid, uuid) volatile;
alter function public.can_view_project(uuid) volatile;
alter function public.can_edit_task(uuid) volatile;
`;

export type Row = Record<string, unknown>;

export type TestDb = {
  db: PGlite;
  /** Run a query and return rows. */
  query: (sql: string, params?: unknown[]) => Promise<Row[]>;
  /** Run a statement and return the affected row count. */
  run: (sql: string, params?: unknown[]) => Promise<number>;
  exec: (sql: string) => Promise<void>;
  /** Set the acting user (auth.uid). */
  asUser: (id: string | null) => Promise<void>;
  /** Switch to the authenticated role (RLS applies). */
  authenticate: () => Promise<void>;
  /** Switch back to the superuser (RLS bypassed). */
  reset: () => Promise<void>;
};

/** Spin up an ephemeral Postgres with the full schema applied. */
export async function createTestDb(): Promise<TestDb> {
  const db = new PGlite();
  await db.exec(BOOTSTRAP);
  for (const f of readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    await db.exec(readFileSync(path.join(MIGRATIONS, f), "utf8"));
  }
  await db.exec(VOLATILITY_SHIM);

  return {
    db,
    query: async (sql, params = []) => (await db.query(sql, params)).rows as Row[],
    run: async (sql, params = []) => (await db.query(sql, params)).affectedRows ?? 0,
    exec: (sql) => db.exec(sql).then(() => undefined),
    asUser: (id) =>
      db
        .query("select set_config('app.current_user_id', $1, false)", [id ?? ""])
        .then(() => undefined),
    authenticate: () => db.exec("set role authenticated"),
    reset: () => db.exec("reset role"),
  };
}
