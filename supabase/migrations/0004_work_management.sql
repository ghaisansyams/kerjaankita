-- ============================================================================
-- 0004 · Accounts/contacts + the work hierarchy
--
-- Naming is deliberately industry-neutral:
--   accounts  = the external party (client, customer, patient, student body,
--               contractor, government agency). Renamed per tenant via
--               organization_settings.terminology.
--   projects  = the work container (project, case, campaign, site, batch, route)
--   tasks     = the atomic unit of work (task, activity, work order, ticket)
-- ============================================================================

create table public.accounts (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name            text not null,
  code            text,
  industry_id     uuid references public.industries (id),
  logo_url        text,
  website         text,
  email           text,
  phone           text,
  address         text,
  notes           text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  created_by      uuid references public.profiles (id),
  updated_at      timestamptz not null default now(),
  updated_by      uuid references public.profiles (id),
  deleted_at      timestamptz,
  deleted_by      uuid references public.profiles (id)
);
create index idx_accounts_org  on public.accounts (organization_id) where deleted_at is null;
create index idx_accounts_name on public.accounts (organization_id, lower(name));

create table public.contacts (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  account_id      uuid references public.accounts (id) on delete cascade,
  user_id         uuid references public.profiles (id) on delete set null, -- set when the contact has a login (guest)
  full_name       text not null,
  email           text,
  phone           text,
  job_title       text,
  is_primary      boolean not null default false,
  created_at      timestamptz not null default now(),
  created_by      uuid references public.profiles (id),
  updated_at      timestamptz not null default now(),
  updated_by      uuid references public.profiles (id),
  deleted_at      timestamptz,
  deleted_by      uuid references public.profiles (id)
);
create index idx_contacts_account on public.contacts (account_id) where deleted_at is null;
create index idx_contacts_org     on public.contacts (organization_id) where deleted_at is null;

-- Deferred FK from 0002: a guest membership may be tied to an account, so a
-- client's staff automatically scope to that account's projects.
alter table public.organization_members
  add constraint organization_members_account_id_fkey
  foreign key (account_id) references public.accounts (id) on delete set null;
create index idx_org_members_account on public.organization_members (account_id);

-- ----------------------------------------------------------------------------
-- Projects — the primary security boundary
-- ----------------------------------------------------------------------------
create table public.projects (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  workspace_id    uuid not null references public.workspaces (id) on delete cascade,
  account_id      uuid references public.accounts (id) on delete set null,
  template_id     uuid references public.project_templates (id) on delete set null,
  workflow_id     uuid references public.workflows (id) on delete set null,
  status_id       uuid references public.workflow_statuses (id) on delete set null,
  parent_id       uuid references public.projects (id) on delete cascade,  -- programmes / sub-projects
  key             text,
  name            text not null,
  description     text,
  owner_id        uuid references public.profiles (id) on delete set null,
  team_id         uuid references public.teams (id) on delete set null,
  visibility      public.project_visibility not null default 'workspace',
  priority        public.priority_level not null default 'medium',
  color           text not null default '#4F46E5',
  start_date      date,
  end_date        date,
  actual_end_date date,
  progress        smallint not null default 0 check (progress between 0 and 100),
  budget_amount   numeric(14,2),
  budget_currency text not null default 'USD',
  task_seq        integer not null default 0,   -- source of per-project task numbers
  is_archived     boolean not null default false,
  created_at      timestamptz not null default now(),
  created_by      uuid references public.profiles (id),
  updated_at      timestamptz not null default now(),
  updated_by      uuid references public.profiles (id),
  deleted_at      timestamptz,
  deleted_by      uuid references public.profiles (id),
  constraint projects_dates_valid check (start_date is null or end_date is null or start_date <= end_date)
);
create index idx_projects_org        on public.projects (organization_id) where deleted_at is null;
create index idx_projects_workspace  on public.projects (workspace_id) where deleted_at is null;
create index idx_projects_account    on public.projects (account_id) where deleted_at is null;
create index idx_projects_owner      on public.projects (owner_id);
create index idx_projects_status     on public.projects (status_id);
create index idx_projects_dates      on public.projects (end_date) where deleted_at is null;
create unique index projects_key_uniq on public.projects (organization_id, key)
  where key is not null and deleted_at is null;

create table public.project_members (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  project_id      uuid not null references public.projects (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  role_id         uuid not null references public.roles (id),
  allocation_pct  smallint check (allocation_pct between 0 and 100),
  created_at      timestamptz not null default now(),
  created_by      uuid references public.profiles (id),
  updated_at      timestamptz not null default now(),
  updated_by      uuid references public.profiles (id),
  deleted_at      timestamptz,
  deleted_by      uuid references public.profiles (id),
  unique (project_id, user_id)
);
create index idx_project_members_user    on public.project_members (user_id) where deleted_at is null;
create index idx_project_members_project on public.project_members (project_id) where deleted_at is null;

-- ----------------------------------------------------------------------------
-- Milestones — coarse checkpoints, always visible to guests/clients
-- ----------------------------------------------------------------------------
create table public.milestones (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  project_id      uuid not null references public.projects (id) on delete cascade,
  name            text not null,
  description     text,
  due_date        date,
  achieved_at     timestamptz,
  position        integer not null default 0,
  created_at      timestamptz not null default now(),
  created_by      uuid references public.profiles (id),
  updated_at      timestamptz not null default now(),
  updated_by      uuid references public.profiles (id),
  deleted_at      timestamptz,
  deleted_by      uuid references public.profiles (id)
);
create index idx_milestones_project on public.milestones (project_id, position) where deleted_at is null;

-- ----------------------------------------------------------------------------
-- Tasks — highest-volume table. parent_id enables unlimited subtask nesting.
-- ----------------------------------------------------------------------------
create table public.tasks (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  project_id      uuid not null references public.projects (id) on delete cascade,
  parent_id       uuid references public.tasks (id) on delete cascade,
  milestone_id    uuid references public.milestones (id) on delete set null,
  workflow_id     uuid references public.workflows (id) on delete set null,
  status_id       uuid references public.workflow_statuses (id) on delete set null,
  template_id     uuid references public.task_templates (id) on delete set null,
  number          integer not null default 0,
  title           text not null,
  description     text,
  priority        public.priority_level not null default 'medium',
  assignee_id     uuid references public.profiles (id) on delete set null,
  reporter_id     uuid references public.profiles (id) on delete set null,
  start_date      date,
  due_date        date,
  completed_at    timestamptz,
  estimated_hours numeric(7,2),
  actual_hours    numeric(7,2),
  progress        smallint not null default 0 check (progress between 0 and 100),
  position        double precision not null default 0,
  is_blocked      boolean not null default false,
  blocked_reason  text,
  blocked_since   timestamptz,
  created_at      timestamptz not null default now(),
  created_by      uuid references public.profiles (id),
  updated_at      timestamptz not null default now(),
  updated_by      uuid references public.profiles (id),
  deleted_at      timestamptz,
  deleted_by      uuid references public.profiles (id),
  constraint tasks_dates_valid check (start_date is null or due_date is null or start_date <= due_date)
);
create index idx_tasks_project        on public.tasks (project_id, status_id) where deleted_at is null;
create index idx_tasks_assignee       on public.tasks (assignee_id, due_date) where deleted_at is null;
create index idx_tasks_org            on public.tasks (organization_id) where deleted_at is null;
create index idx_tasks_parent         on public.tasks (parent_id) where parent_id is not null;
create index idx_tasks_milestone      on public.tasks (milestone_id);
create index idx_tasks_due            on public.tasks (due_date) where deleted_at is null and completed_at is null;
create index idx_tasks_board          on public.tasks (project_id, status_id, position) where deleted_at is null;
create unique index tasks_number_uniq on public.tasks (project_id, number) where deleted_at is null;

create table public.task_dependencies (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  predecessor_id  uuid not null references public.tasks (id) on delete cascade,
  successor_id    uuid not null references public.tasks (id) on delete cascade,
  type            public.dependency_type not null default 'finish_to_start',
  lag_days        integer not null default 0,
  created_at      timestamptz not null default now(),
  created_by      uuid references public.profiles (id),
  unique (predecessor_id, successor_id),
  constraint task_dependencies_no_self check (predecessor_id <> successor_id)
);
create index idx_task_deps_successor on public.task_dependencies (successor_id);

create table public.task_checklist_items (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  task_id         uuid not null references public.tasks (id) on delete cascade,
  content         text not null,
  is_done         boolean not null default false,
  done_at         timestamptz,
  done_by         uuid references public.profiles (id),
  position        double precision not null default 0,
  created_at      timestamptz not null default now(),
  created_by      uuid references public.profiles (id),
  updated_at      timestamptz not null default now(),
  updated_by      uuid references public.profiles (id),
  deleted_at      timestamptz,
  deleted_by      uuid references public.profiles (id)
);
create index idx_checklist_task on public.task_checklist_items (task_id, position) where deleted_at is null;

-- ----------------------------------------------------------------------------
-- Tags — free-form labelling, polymorphic
-- ----------------------------------------------------------------------------
create table public.tags (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name            text not null,
  color           text not null default '#64748B',
  created_at      timestamptz not null default now(),
  created_by      uuid references public.profiles (id),
  deleted_at      timestamptz,
  deleted_by      uuid references public.profiles (id),
  unique (organization_id, name)
);

create table public.taggables (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  tag_id          uuid not null references public.tags (id) on delete cascade,
  entity          public.entity_type not null,
  entity_id       uuid not null,
  created_at      timestamptz not null default now(),
  created_by      uuid references public.profiles (id),
  unique (tag_id, entity, entity_id)
);
create index idx_taggables_entity on public.taggables (entity, entity_id);
