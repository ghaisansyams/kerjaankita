-- 0014_realtime.sql
-- Publish the collaboration tables to the `supabase_realtime` publication so
-- the browser client can subscribe to postgres_changes. Realtime delivery is
-- still filtered by RLS, so a subscriber only receives rows it may read.
--
-- Written defensively: Supabase provisions `supabase_realtime` for every
-- project, but the PGlite test harness does not — so we create it if missing
-- and add each table only when it isn't already published (re-run safe).

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

do $$
declare
  t text;
  tables text[] := array[
    'tasks',
    'milestones',
    'comments',
    'notifications',
    'projects',
    'activities',
    'project_members'
  ];
begin
  foreach t in array tables loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
