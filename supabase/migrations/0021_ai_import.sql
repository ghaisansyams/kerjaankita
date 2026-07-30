-- ============================================================================
-- 0021 · AI Document Import — planning hierarchy + import jobs
--
-- Adds a PLANNING hierarchy (Roadmap → Module) that is separate from the
-- EXECUTION workflow (board columns). Tasks (= Features) link to a roadmap and
-- module via nullable metadata; the Kanban workflow is untouched, so Timeline,
-- Calendar, Analytics, Reports and Project Progress keep working unchanged.
--
-- Also adds `import_jobs` to track the AI pipeline state and hold the validated
-- analysis result between preview and commit. No architecture is redesigned.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Roadmaps — Level 1 planning grouping within a project (Backend/Frontend/…,
-- or Phase 1/2/3). Deleting a roadmap never deletes tasks (see tasks FK below).
-- ----------------------------------------------------------------------------
create table if not exists public.roadmaps (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  project_id      uuid not null references public.projects (id) on delete cascade,
  name            text not null,
  description     text,
  color           text,
  position        integer not null default 0,
  created_at      timestamptz not null default now(),
  created_by      uuid references public.profiles (id),
  updated_at      timestamptz not null default now(),
  updated_by      uuid references public.profiles (id),
  deleted_at      timestamptz,
  deleted_by      uuid references public.profiles (id)
);
create index if not exists idx_roadmaps_project on public.roadmaps (project_id, position) where deleted_at is null;

-- ----------------------------------------------------------------------------
-- Modules — Level 2 grouping under a roadmap.
-- ----------------------------------------------------------------------------
create table if not exists public.modules (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  project_id      uuid not null references public.projects (id) on delete cascade,
  roadmap_id      uuid references public.roadmaps (id) on delete set null,
  name            text not null,
  description     text,
  position        integer not null default 0,
  created_at      timestamptz not null default now(),
  created_by      uuid references public.profiles (id),
  updated_at      timestamptz not null default now(),
  updated_by      uuid references public.profiles (id),
  deleted_at      timestamptz,
  deleted_by      uuid references public.profiles (id)
);
create index if not exists idx_modules_project on public.modules (project_id, position) where deleted_at is null;
create index if not exists idx_modules_roadmap on public.modules (roadmap_id) where deleted_at is null;

-- ----------------------------------------------------------------------------
-- Tasks gain planning metadata. NULLABLE + ON DELETE SET NULL so removing a
-- roadmap/module only unlinks tasks, never deletes them.
-- ----------------------------------------------------------------------------
alter table public.tasks
  add column if not exists roadmap_id uuid references public.roadmaps (id) on delete set null,
  add column if not exists module_id  uuid references public.modules (id)  on delete set null;
create index if not exists idx_tasks_roadmap on public.tasks (roadmap_id) where deleted_at is null;
create index if not exists idx_tasks_module  on public.tasks (module_id)  where deleted_at is null;

-- ----------------------------------------------------------------------------
-- Import jobs — pipeline state + validated AI analysis (preview → commit).
-- status: pending | parsing | analyzing | preview | committing | done | failed
-- ----------------------------------------------------------------------------
create table if not exists public.import_jobs (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  project_id      uuid references public.projects (id) on delete set null,
  created_by      uuid references public.profiles (id),
  file_name       text not null,
  file_path       text,
  file_type       text,
  document_type   text,
  provider        text,
  status          text not null default 'pending',
  error           text,
  result          jsonb,
  confidence      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_import_jobs_org on public.import_jobs (organization_id, created_at desc);

-- ----------------------------------------------------------------------------
-- RLS — same model as the rest of the app (project-visibility reads,
-- task.create-gated writes; import_jobs scoped to org members).
-- ----------------------------------------------------------------------------
alter table public.roadmaps    enable row level security;
alter table public.modules     enable row level security;
alter table public.import_jobs enable row level security;

create policy roadmaps_read on public.roadmaps for select
  using (deleted_at is null and public.can_view_project(project_id));
create policy roadmaps_write on public.roadmaps for all
  using (public.has_permission(organization_id, 'task.create', null, project_id))
  with check (public.has_permission(organization_id, 'task.create', null, project_id));

create policy modules_read on public.modules for select
  using (deleted_at is null and public.can_view_project(project_id));
create policy modules_write on public.modules for all
  using (public.has_permission(organization_id, 'task.create', null, project_id))
  with check (public.has_permission(organization_id, 'task.create', null, project_id));

create policy import_jobs_read on public.import_jobs for select
  using (public.is_org_member(organization_id));
create policy import_jobs_write on public.import_jobs for all
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));
