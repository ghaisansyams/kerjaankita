-- ============================================================================
-- 0005 · Collaboration + extensibility (custom fields, automation)
--
-- Polymorphism note: comments/attachments/custom values/tags attach to many
-- entity types. They carry `entity` + `entity_id` (no FK possible) BUT ALSO a
-- denormalised organization_id and project_id. The denormalisation is the whole
-- point: RLS can isolate tenants and scope projects with one indexed predicate
-- instead of a polymorphic join. Referential integrity is enforced by trigger.
-- ============================================================================

create table public.comments (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  project_id      uuid references public.projects (id) on delete cascade,
  entity          public.entity_type not null,
  entity_id       uuid not null,
  parent_id       uuid references public.comments (id) on delete cascade,
  author_id       uuid references public.profiles (id) on delete set null,
  body            text not null,
  -- Internal comments are invisible to guests. Default true: discussion is
  -- private unless someone deliberately shares it.
  is_internal     boolean not null default true,
  is_edited       boolean not null default false,
  mentions        uuid[] not null default '{}',
  created_at      timestamptz not null default now(),
  created_by      uuid references public.profiles (id),
  updated_at      timestamptz not null default now(),
  updated_by      uuid references public.profiles (id),
  deleted_at      timestamptz,
  deleted_by      uuid references public.profiles (id)
);
create index idx_comments_entity  on public.comments (entity, entity_id, created_at desc) where deleted_at is null;
create index idx_comments_project on public.comments (project_id) where deleted_at is null;
create index idx_comments_org     on public.comments (organization_id) where deleted_at is null;
create index idx_comments_parent  on public.comments (parent_id) where parent_id is not null;

create table public.attachments (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  project_id      uuid references public.projects (id) on delete cascade,
  entity          public.entity_type not null,
  entity_id       uuid not null,
  bucket          text not null default 'attachments',
  path            text not null,
  file_name       text not null,
  file_type       text,
  file_size       bigint,
  checksum        text,
  -- Guests (clients) only ever see files explicitly shared with them.
  is_guest_visible boolean not null default false,
  uploaded_by     uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  created_by      uuid references public.profiles (id),
  updated_at      timestamptz not null default now(),
  updated_by      uuid references public.profiles (id),
  deleted_at      timestamptz,
  deleted_by      uuid references public.profiles (id)
);
create index idx_attachments_entity  on public.attachments (entity, entity_id) where deleted_at is null;
create index idx_attachments_project on public.attachments (project_id) where deleted_at is null;
create index idx_attachments_org     on public.attachments (organization_id) where deleted_at is null;

-- ----------------------------------------------------------------------------
-- Activities — append-only audit trail. `action` is TEXT, not an enum, so
-- automation and future features can emit new action types without migrations.
-- ----------------------------------------------------------------------------
create table public.activities (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  workspace_id    uuid references public.workspaces (id) on delete cascade,
  project_id      uuid references public.projects (id) on delete cascade,
  entity          public.entity_type not null,
  entity_id       uuid not null,
  actor_id        uuid references public.profiles (id) on delete set null,
  action          text not null,
  metadata        jsonb not null default '{}'::jsonb,
  -- Guests see a filtered subset of the audit trail.
  is_guest_visible boolean not null default false,
  created_at      timestamptz not null default now()
);
create index idx_activities_org     on public.activities (organization_id, created_at desc);
create index idx_activities_project on public.activities (project_id, created_at desc);
create index idx_activities_entity  on public.activities (entity, entity_id, created_at desc);
create index idx_activities_actor   on public.activities (actor_id, created_at desc);

create table public.notifications (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  type            text not null,
  title           text not null,
  body            text,
  entity          public.entity_type,
  entity_id       uuid,
  action_url      text,
  is_read         boolean not null default false,
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);
create index idx_notifications_user on public.notifications (user_id, is_read, created_at desc);
create index idx_notifications_org  on public.notifications (organization_id);

-- ----------------------------------------------------------------------------
-- Custom fields — tenant-defined attributes on any entity.
-- Scope cascade: organization-wide → workspace → single project.
-- ----------------------------------------------------------------------------
create table public.custom_field_definitions (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  workspace_id    uuid references public.workspaces (id) on delete cascade,
  project_id      uuid references public.projects (id) on delete cascade,
  entity          public.entity_type not null,
  key             text not null,
  label           text not null,
  description     text,
  field_type      public.custom_field_type not null,
  options         jsonb not null default '[]'::jsonb,   -- for select / multi_select
  default_value   jsonb,
  validation      jsonb not null default '{}'::jsonb,   -- {min,max,pattern,...}
  is_required     boolean not null default false,
  is_guest_visible boolean not null default false,
  position        integer not null default 0,
  created_at      timestamptz not null default now(),
  created_by      uuid references public.profiles (id),
  updated_at      timestamptz not null default now(),
  updated_by      uuid references public.profiles (id),
  deleted_at      timestamptz,
  deleted_by      uuid references public.profiles (id)
);
create unique index custom_field_key_uniq
  on public.custom_field_definitions (
    organization_id,
    coalesce(project_id, '00000000-0000-0000-0000-000000000000'::uuid),
    entity, key
  ) where deleted_at is null;
create index idx_cfd_org_entity on public.custom_field_definitions (organization_id, entity) where deleted_at is null;

create table public.custom_field_values (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  project_id      uuid references public.projects (id) on delete cascade,
  definition_id   uuid not null references public.custom_field_definitions (id) on delete cascade,
  entity          public.entity_type not null,
  entity_id       uuid not null,
  value           jsonb,
  created_at      timestamptz not null default now(),
  created_by      uuid references public.profiles (id),
  updated_at      timestamptz not null default now(),
  updated_by      uuid references public.profiles (id),
  unique (definition_id, entity_id)
);
create index idx_cfv_entity on public.custom_field_values (entity, entity_id);
create index idx_cfv_org    on public.custom_field_values (organization_id);
create index idx_cfv_value  on public.custom_field_values using gin (value jsonb_path_ops);

-- ----------------------------------------------------------------------------
-- Automation — rule definitions stored now, execution engine added later.
-- Shape: WHEN <trigger> IF <conditions> THEN <actions>
-- ----------------------------------------------------------------------------
create table public.automation_rules (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  workspace_id    uuid references public.workspaces (id) on delete cascade,
  project_id      uuid references public.projects (id) on delete cascade,
  name            text not null,
  description     text,
  trigger_type    text not null,                          -- 'task.status_changed', 'task.created', 'schedule.daily', …
  trigger_config  jsonb not null default '{}'::jsonb,
  conditions      jsonb not null default '[]'::jsonb,     -- [{field, operator, value}]
  actions         jsonb not null default '[]'::jsonb,     -- [{type, params}]
  is_active       boolean not null default true,
  run_count       integer not null default 0,
  last_run_at     timestamptz,
  created_at      timestamptz not null default now(),
  created_by      uuid references public.profiles (id),
  updated_at      timestamptz not null default now(),
  updated_by      uuid references public.profiles (id),
  deleted_at      timestamptz,
  deleted_by      uuid references public.profiles (id)
);
create index idx_automation_rules_org     on public.automation_rules (organization_id, is_active) where deleted_at is null;
create index idx_automation_rules_trigger on public.automation_rules (trigger_type) where is_active and deleted_at is null;

create table public.automation_runs (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  rule_id         uuid not null references public.automation_rules (id) on delete cascade,
  entity          public.entity_type,
  entity_id       uuid,
  status          public.automation_run_status not null,
  error_message   text,
  payload         jsonb not null default '{}'::jsonb,
  duration_ms     integer,
  created_at      timestamptz not null default now()
);
create index idx_automation_runs_rule on public.automation_runs (rule_id, created_at desc);
