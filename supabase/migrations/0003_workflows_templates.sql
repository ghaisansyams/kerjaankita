-- ============================================================================
-- 0003 · Configurable workflows + project/task templates
--
-- Why workflows are data, not an enum:
--   A software team wants Todo → In Progress → Code Review → QA → Done.
--   A construction firm wants Planned → Materials → Execution → Inspection → Handover.
--   A clinic wants Intake → Triage → Treatment → Follow-up → Discharged.
-- Hard-coding statuses would make the platform single-industry. Instead each
-- tenant defines statuses freely, and every status maps to a stable
-- `status_category` so progress, reporting and automation work identically
-- across all tenants and industries.
-- ============================================================================

create table public.workflows (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  workspace_id    uuid references public.workspaces (id) on delete cascade,
  name            text not null,
  description     text,
  entity          public.workflow_entity not null default 'task',
  is_default      boolean not null default false,
  is_system       boolean not null default false,
  created_at      timestamptz not null default now(),
  created_by      uuid references public.profiles (id),
  updated_at      timestamptz not null default now(),
  updated_by      uuid references public.profiles (id),
  deleted_at      timestamptz,
  deleted_by      uuid references public.profiles (id)
);
create index idx_workflows_org on public.workflows (organization_id, entity) where deleted_at is null;
-- At most one default workflow per (organization, workspace, entity)
create unique index workflows_default_uniq
  on public.workflows (organization_id, coalesce(workspace_id, '00000000-0000-0000-0000-000000000000'::uuid), entity)
  where is_default and deleted_at is null;

create table public.workflow_statuses (
  id          uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  workflow_id uuid not null references public.workflows (id) on delete cascade,
  key         text not null,
  name        text not null,
  description text,
  category    public.status_category not null,
  color       text not null default '#64748B',
  position    integer not null default 0,
  is_initial  boolean not null default false,
  is_final    boolean not null default false,
  -- Progress automatically applied when a task enters this status (NULL = leave alone)
  auto_progress smallint check (auto_progress between 0 and 100),
  created_at  timestamptz not null default now(),
  created_by  uuid references public.profiles (id),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles (id),
  deleted_at  timestamptz,
  deleted_by  uuid references public.profiles (id),
  unique (workflow_id, key)
);
create index idx_workflow_statuses_wf  on public.workflow_statuses (workflow_id, position);
create index idx_workflow_statuses_cat on public.workflow_statuses (organization_id, category);
create unique index workflow_statuses_initial_uniq
  on public.workflow_statuses (workflow_id) where is_initial and deleted_at is null;

-- Allowed moves. from_status_id NULL = "from any status".
-- required_permission gates who may perform the move (e.g. only QA closes tests).
create table public.workflow_transitions (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations (id) on delete cascade,
  workflow_id         uuid not null references public.workflows (id) on delete cascade,
  from_status_id      uuid references public.workflow_statuses (id) on delete cascade,
  to_status_id        uuid not null references public.workflow_statuses (id) on delete cascade,
  name                text,
  required_permission text,
  requires_comment    boolean not null default false,
  created_at          timestamptz not null default now(),
  created_by          uuid references public.profiles (id),
  updated_at          timestamptz not null default now(),
  updated_by          uuid references public.profiles (id),
  deleted_at          timestamptz,
  deleted_by          uuid references public.profiles (id)
);
create index idx_workflow_transitions_wf on public.workflow_transitions (workflow_id, from_status_id);

-- ----------------------------------------------------------------------------
-- Project templates — repeatable project shapes per industry
-- ----------------------------------------------------------------------------
create table public.project_templates (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid references public.organizations (id) on delete cascade, -- NULL = system template
  industry_id      uuid references public.industries (id),
  name             text not null,
  description      text,
  default_workflow_id uuid references public.workflows (id) on delete set null,
  default_duration_days integer,
  config           jsonb not null default '{}'::jsonb,
  is_system        boolean not null default false,
  created_at       timestamptz not null default now(),
  created_by       uuid references public.profiles (id),
  updated_at       timestamptz not null default now(),
  updated_by       uuid references public.profiles (id),
  deleted_at       timestamptz,
  deleted_by       uuid references public.profiles (id)
);
create index idx_project_templates_org      on public.project_templates (organization_id) where deleted_at is null;
create index idx_project_templates_industry on public.project_templates (industry_id);

-- Template tasks are date-relative (offsets), never absolute — that is what
-- makes a template reusable. Assignment is by ROLE, resolved at instantiation.
create table public.project_template_tasks (
  id                    uuid primary key default gen_random_uuid(),
  template_id           uuid not null references public.project_templates (id) on delete cascade,
  parent_id             uuid references public.project_template_tasks (id) on delete cascade,
  title                 text not null,
  description           text,
  priority              public.priority_level not null default 'medium',
  position              integer not null default 0,
  start_offset_days     integer not null default 0,
  duration_days         integer not null default 1,
  estimated_hours       numeric(7,2),
  assignee_role_id      uuid references public.roles (id) on delete set null,
  checklist             jsonb not null default '[]'::jsonb,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index idx_template_tasks_template on public.project_template_tasks (template_id, position);

-- ----------------------------------------------------------------------------
-- Task templates — single reusable task definitions (checklists, SOPs)
-- ----------------------------------------------------------------------------
create table public.task_templates (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  name            text not null,
  title           text not null,
  description     text,
  priority        public.priority_level not null default 'medium',
  estimated_hours numeric(7,2),
  duration_days   integer not null default 1,
  checklist       jsonb not null default '[]'::jsonb,
  custom_fields   jsonb not null default '{}'::jsonb,
  is_system       boolean not null default false,
  created_at      timestamptz not null default now(),
  created_by      uuid references public.profiles (id),
  updated_at      timestamptz not null default now(),
  updated_by      uuid references public.profiles (id),
  deleted_at      timestamptz,
  deleted_by      uuid references public.profiles (id)
);
create index idx_task_templates_org on public.task_templates (organization_id) where deleted_at is null;
