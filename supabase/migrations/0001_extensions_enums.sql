-- ============================================================================
-- 0001 · Extensions and enumerated types
--
-- Design note on ENUM vs TEXT:
--   ENUM  → closed sets that the platform's logic depends on (a new value would
--           require code changes anyway).
--   TEXT  → open sets that tenants/automation extend at runtime (activity
--           actions, notification types, automation triggers).
-- Getting this split wrong is the most common cause of painful migrations.
-- ============================================================================

-- gen_random_uuid() is core in Postgres 13+. No extension required.
-- Optional (recommended in production, omitted here so the migration runs on
-- any Postgres): pg_trgm for fast ILIKE search. See 0010 extensibility notes.

create type public.member_type          as enum ('member', 'guest');
create type public.membership_status    as enum ('invited', 'active', 'suspended');
create type public.role_scope           as enum ('organization', 'workspace', 'project');

create type public.workflow_entity      as enum ('project', 'task');

-- Stable, cross-workflow semantics. Tenants rename statuses freely, but every
-- status maps to one of these so reporting/progress works across all tenants.
create type public.status_category      as enum (
  'backlog', 'todo', 'in_progress', 'review', 'done', 'blocked', 'cancelled'
);

create type public.priority_level       as enum ('none', 'low', 'medium', 'high', 'critical');
create type public.project_visibility   as enum ('organization', 'workspace', 'private');
create type public.project_health       as enum ('on_track', 'at_risk', 'delayed');

create type public.custom_field_type    as enum (
  'text', 'textarea', 'number', 'date', 'datetime', 'boolean',
  'select', 'multi_select', 'user', 'url', 'email', 'currency'
);

-- Polymorphic targets for comments, attachments, custom fields, tags.
create type public.entity_type          as enum (
  'organization', 'workspace', 'team', 'account', 'contact',
  'project', 'milestone', 'task'
);

create type public.dependency_type      as enum (
  'finish_to_start', 'start_to_start', 'finish_to_finish', 'start_to_finish'
);

create type public.invitation_status    as enum ('pending', 'accepted', 'revoked', 'expired');
create type public.automation_run_status as enum ('success', 'failed', 'skipped');
