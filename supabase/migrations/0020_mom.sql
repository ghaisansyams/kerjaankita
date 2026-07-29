-- ============================================================================
-- 0020 · MOM (Minutes of Meeting) module
--
-- A first-class meeting-minutes feature living inside a project. Follows the
-- existing conventions: tenant-scoped (organization_id), capability RBAC via
-- has_permission, project-visibility reads via can_view_project, and normalized
-- child tables (participants, distribution recipients, and structured numbered
-- notes where each note may spawn a Task).
-- ============================================================================

-- 1. Activity can reference meeting minutes ---------------------------------
alter type public.entity_type add value if not exists 'mom';

-- 2. Permissions (capability RBAC) ------------------------------------------
insert into public.permissions (key, category, name, description) values
  ('mom.create', 'work', 'Create meeting minutes', 'Create MOM documents'),
  ('mom.update', 'work', 'Edit meeting minutes',   'Edit MOM documents'),
  ('mom.delete', 'work', 'Delete meeting minutes', 'Delete MOM documents'),
  ('mom.export', 'work', 'Export meeting minutes', 'Export a MOM to PDF')
on conflict (key) do nothing;

-- Owner + Admin: everything. Manager: create / edit / export (no delete).
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
 where r.organization_id is null and r.key in ('org_owner', 'org_admin')
   and p.key in ('mom.create', 'mom.update', 'mom.delete', 'mom.export')
on conflict do nothing;
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
 where r.organization_id is null and r.key = 'org_manager'
   and p.key in ('mom.create', 'mom.update', 'mom.export')
on conflict do nothing;

-- 3. Tables -----------------------------------------------------------------
create table public.mom (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  workspace_id     uuid references public.workspaces (id) on delete set null,
  project_id       uuid not null references public.projects (id) on delete cascade,
  title            text not null,
  meeting_date     date not null,
  meeting_time     text,
  location         text,
  pic_id           uuid references public.profiles (id) on delete set null,
  prepared_by      uuid references public.profiles (id) on delete set null,
  approved_by_name text not null default 'Galih Aldio Putra',
  approved_by_role text not null default 'Director',
  created_at       timestamptz not null default now(),
  created_by       uuid references public.profiles (id),
  updated_at       timestamptz not null default now(),
  updated_by       uuid references public.profiles (id),
  deleted_at       timestamptz,
  deleted_by       uuid references public.profiles (id)
);
create index idx_mom_project   on public.mom (project_id) where deleted_at is null;
create index idx_mom_org_date  on public.mom (organization_id, meeting_date desc) where deleted_at is null;
create index idx_mom_pic       on public.mom (pic_id);
create index idx_mom_workspace on public.mom (workspace_id);

create table public.mom_participants (
  id       uuid primary key default gen_random_uuid(),
  mom_id   uuid not null references public.mom (id) on delete cascade,
  name     text not null,
  role     text,
  company  text,
  position integer not null default 0
);
create index idx_mom_participants on public.mom_participants (mom_id, position);

create table public.mom_distribution (
  id        uuid primary key default gen_random_uuid(),
  mom_id    uuid not null references public.mom (id) on delete cascade,
  recipient text not null,
  position  integer not null default 0
);
create index idx_mom_distribution on public.mom_distribution (mom_id, position);

-- Structured notes: each is a numbered point. category is a stable slug so the
-- UI can label it (Discussion / Decision / Action item / Next step). Any note
-- may spawn a Task (task_id) — the point→task integration.
create table public.mom_notes (
  id         uuid primary key default gen_random_uuid(),
  mom_id     uuid not null references public.mom (id) on delete cascade,
  category   text not null default 'discussion',
  content    text not null,
  position   integer not null default 0,
  task_id    uuid references public.tasks (id) on delete set null,
  created_at timestamptz not null default now()
);
create index idx_mom_notes on public.mom_notes (mom_id, position);

-- 4. RLS --------------------------------------------------------------------
alter table public.mom              enable row level security;
alter table public.mom_participants enable row level security;
alter table public.mom_distribution enable row level security;
alter table public.mom_notes        enable row level security;

-- Read: anyone who can see the project (developer members, and clients whose
-- account is linked to the project). Writes: capability-gated per action.
create policy mom_read on public.mom for select
  using (deleted_at is null and public.can_view_project(project_id));
create policy mom_insert on public.mom for insert
  with check (public.has_permission(organization_id, 'mom.create', null, project_id));
create policy mom_update on public.mom for update
  using (public.has_permission(organization_id, 'mom.update', null, project_id))
  with check (public.has_permission(organization_id, 'mom.update', null, project_id));
create policy mom_delete on public.mom for delete
  using (public.has_permission(organization_id, 'mom.delete', null, project_id));

-- Children inherit the parent's access. Writable while creating OR editing.
create or replace function public.mom_can_read(p_mom uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.mom m
                 where m.id = p_mom and m.deleted_at is null and public.can_view_project(m.project_id));
$$;
create or replace function public.mom_can_write(p_mom uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.mom m where m.id = p_mom
                 and (public.has_permission(m.organization_id, 'mom.update', null, m.project_id)
                   or public.has_permission(m.organization_id, 'mom.create', null, m.project_id)));
$$;

create policy mom_participants_read on public.mom_participants for select using (public.mom_can_read(mom_id));
create policy mom_participants_write on public.mom_participants for all
  using (public.mom_can_write(mom_id)) with check (public.mom_can_write(mom_id));
create policy mom_distribution_read on public.mom_distribution for select using (public.mom_can_read(mom_id));
create policy mom_distribution_write on public.mom_distribution for all
  using (public.mom_can_write(mom_id)) with check (public.mom_can_write(mom_id));
create policy mom_notes_read on public.mom_notes for select using (public.mom_can_read(mom_id));
create policy mom_notes_write on public.mom_notes for all
  using (public.mom_can_write(mom_id)) with check (public.mom_can_write(mom_id));
