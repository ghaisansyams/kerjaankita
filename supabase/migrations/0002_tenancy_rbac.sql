-- ============================================================================
-- 0002 · Tenancy (organizations → workspaces → teams) and generic RBAC
--
-- Tenancy chain:  organization → workspace → project → task
-- EVERY tenant-owned table carries organization_id, denormalised on purpose:
-- RLS must isolate tenants with a single indexed predicate, never a join chain.
--
-- Audit columns on every table:
--   created_at / created_by / updated_at / updated_by / deleted_at / deleted_by
-- Soft delete = deleted_at IS NOT NULL. Nothing is ever hard-deleted by the app.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Industries (system reference data — drives default templates & terminology)
-- ----------------------------------------------------------------------------
create table public.industries (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,
  name        text not null,
  description text,
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Profiles — application identity, 1:1 with auth.users. Global, not tenant-owned:
-- one human may belong to many organizations.
-- ----------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text,
  full_name    text,
  avatar_url   text,
  title        text,
  phone        text,
  timezone     text not null default 'UTC',
  locale       text not null default 'en',
  is_active    boolean not null default true,
  last_seen_at timestamptz,
  created_at   timestamptz not null default now(),
  created_by   uuid references public.profiles (id),
  updated_at   timestamptz not null default now(),
  updated_by   uuid references public.profiles (id),
  deleted_at   timestamptz,
  deleted_by   uuid references public.profiles (id)
);
create index idx_profiles_email   on public.profiles (lower(email));
create index idx_profiles_active  on public.profiles (is_active) where deleted_at is null;

-- ----------------------------------------------------------------------------
-- Organizations — the tenant root
-- ----------------------------------------------------------------------------
create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  industry_id uuid references public.industries (id),
  logo_url    text,
  website     text,
  plan        text not null default 'free',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  created_by  uuid references public.profiles (id),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles (id),
  deleted_at  timestamptz,
  deleted_by  uuid references public.profiles (id)
);
create index idx_organizations_industry on public.organizations (industry_id);
create index idx_organizations_active   on public.organizations (is_active) where deleted_at is null;

-- ----------------------------------------------------------------------------
-- Organization settings — per-tenant configuration.
-- `terminology` is what makes this platform industry-agnostic: a construction
-- firm renders "Project/Task" as "Site/Work Order", a clinic as "Case/Activity".
-- Business-rule constants live here so rules are configurable, not hard-coded.
-- ----------------------------------------------------------------------------
create table public.organization_settings (
  id                       uuid primary key default gen_random_uuid(),
  organization_id          uuid not null unique references public.organizations (id) on delete cascade,
  timezone                 text not null default 'UTC',
  week_start               smallint not null default 1 check (week_start between 0 and 6),
  working_hours_per_day    numeric(4,2) not null default 8,
  capacity_hours_per_week  numeric(5,2) not null default 40,
  health_tolerance_points  smallint not null default 15 check (health_tolerance_points between 0 and 100),
  blocked_threshold_days   smallint not null default 3,
  terminology              jsonb not null default '{}'::jsonb,
  features                 jsonb not null default '{}'::jsonb,
  created_at               timestamptz not null default now(),
  created_by               uuid references public.profiles (id),
  updated_at               timestamptz not null default now(),
  updated_by               uuid references public.profiles (id)
);

-- ----------------------------------------------------------------------------
-- RBAC · permissions catalogue (system-wide, seeded, never tenant-owned)
-- ----------------------------------------------------------------------------
create table public.permissions (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,   -- e.g. 'project.update'
  category    text not null,          -- e.g. 'project'
  name        text not null,
  description text,
  created_at  timestamptz not null default now()
);
create index idx_permissions_category on public.permissions (category);

-- ----------------------------------------------------------------------------
-- RBAC · roles. organization_id NULL = system template role (cloned per tenant
-- or referenced directly). Tenants may define their own custom roles.
-- ----------------------------------------------------------------------------
create table public.roles (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  key             text not null,
  name            text not null,
  description     text,
  scope           public.role_scope not null,
  is_system       boolean not null default false,
  is_default      boolean not null default false,
  rank            smallint not null default 100,  -- lower = more privileged
  created_at      timestamptz not null default now(),
  created_by      uuid references public.profiles (id),
  updated_at      timestamptz not null default now(),
  updated_by      uuid references public.profiles (id),
  deleted_at      timestamptz,
  deleted_by      uuid references public.profiles (id)
);
create unique index roles_tenant_key_uniq on public.roles (organization_id, key)
  where organization_id is not null and deleted_at is null;
create unique index roles_system_key_uniq on public.roles (key)
  where organization_id is null;
create index idx_roles_org_scope on public.roles (organization_id, scope);

create table public.role_permissions (
  role_id       uuid not null references public.roles (id) on delete cascade,
  permission_id uuid not null references public.permissions (id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (role_id, permission_id)
);
create index idx_role_permissions_permission on public.role_permissions (permission_id);

-- ----------------------------------------------------------------------------
-- Organization members — the tenancy anchor.
-- member_type='guest' → external collaborator (client, contractor, auditor).
-- Guests see NOTHING by default; they only reach projects they are explicitly
-- added to. This is how "Guest Users" is implemented platform-wide.
-- ----------------------------------------------------------------------------
create table public.organization_members (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  role_id         uuid not null references public.roles (id),
  member_type     public.member_type not null default 'member',
  status          public.membership_status not null default 'active',
  account_id      uuid,   -- FK added in 0004: guests may represent an account
  invited_by      uuid references public.profiles (id),
  joined_at       timestamptz,
  created_at      timestamptz not null default now(),
  created_by      uuid references public.profiles (id),
  updated_at      timestamptz not null default now(),
  updated_by      uuid references public.profiles (id),
  deleted_at      timestamptz,
  deleted_by      uuid references public.profiles (id),
  unique (organization_id, user_id)
);
create index idx_org_members_user   on public.organization_members (user_id, status) where deleted_at is null;
create index idx_org_members_org    on public.organization_members (organization_id, status) where deleted_at is null;
create index idx_org_members_role   on public.organization_members (role_id);

-- ----------------------------------------------------------------------------
-- Workspaces — subdivision inside an organization (department, office, client
-- portfolio, product line). Projects always belong to exactly one workspace.
-- ----------------------------------------------------------------------------
create table public.workspaces (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name            text not null,
  slug            text not null,
  description     text,
  icon            text,
  color           text not null default '#4F46E5',
  is_default      boolean not null default false,
  is_archived     boolean not null default false,
  created_at      timestamptz not null default now(),
  created_by      uuid references public.profiles (id),
  updated_at      timestamptz not null default now(),
  updated_by      uuid references public.profiles (id),
  deleted_at      timestamptz,
  deleted_by      uuid references public.profiles (id),
  unique (organization_id, slug)
);
create index idx_workspaces_org on public.workspaces (organization_id) where deleted_at is null;

create table public.workspace_members (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  workspace_id    uuid not null references public.workspaces (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  role_id         uuid not null references public.roles (id),
  created_at      timestamptz not null default now(),
  created_by      uuid references public.profiles (id),
  updated_at      timestamptz not null default now(),
  updated_by      uuid references public.profiles (id),
  deleted_at      timestamptz,
  deleted_by      uuid references public.profiles (id),
  unique (workspace_id, user_id)
);
create index idx_workspace_members_user on public.workspace_members (user_id) where deleted_at is null;
create index idx_workspace_members_ws   on public.workspace_members (workspace_id) where deleted_at is null;

-- ----------------------------------------------------------------------------
-- Teams — durable groups of people, orthogonal to projects
-- (e.g. "Backend Guild", "Site Crew A", "Night Shift Nurses").
-- ----------------------------------------------------------------------------
create table public.teams (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  workspace_id    uuid references public.workspaces (id) on delete set null,
  name            text not null,
  description     text,
  color           text not null default '#64748B',
  lead_id         uuid references public.profiles (id),
  created_at      timestamptz not null default now(),
  created_by      uuid references public.profiles (id),
  updated_at      timestamptz not null default now(),
  updated_by      uuid references public.profiles (id),
  deleted_at      timestamptz,
  deleted_by      uuid references public.profiles (id)
);
create index idx_teams_org on public.teams (organization_id) where deleted_at is null;

create table public.team_members (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  team_id         uuid not null references public.teams (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  created_at      timestamptz not null default now(),
  created_by      uuid references public.profiles (id),
  deleted_at      timestamptz,
  deleted_by      uuid references public.profiles (id),
  unique (team_id, user_id)
);
create index idx_team_members_user on public.team_members (user_id) where deleted_at is null;

-- ----------------------------------------------------------------------------
-- Invitations — onboarding into an organization (member or guest)
-- ----------------------------------------------------------------------------
create table public.invitations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email           text not null,
  role_id         uuid not null references public.roles (id),
  workspace_id    uuid references public.workspaces (id) on delete cascade,
  member_type     public.member_type not null default 'member',
  token           text not null unique,
  status          public.invitation_status not null default 'pending',
  expires_at      timestamptz not null default (now() + interval '14 days'),
  invited_by      uuid references public.profiles (id),
  accepted_by     uuid references public.profiles (id),
  accepted_at     timestamptz,
  created_at      timestamptz not null default now(),
  created_by      uuid references public.profiles (id),
  updated_at      timestamptz not null default now(),
  updated_by      uuid references public.profiles (id)
);
create index idx_invitations_org   on public.invitations (organization_id, status);
create index idx_invitations_email on public.invitations (lower(email), status);
