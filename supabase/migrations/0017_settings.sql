-- ============================================================================
-- 0017 · Settings columns for Sprint 7.
--   • profiles.date_format          — per-user date rendering preference
--   • workspaces.logo_url           — workspace branding
--   • workspaces.default_workflow_id — the workspace's preferred task workflow
-- Forward-only, additive columns only. No RLS or behaviour changes; existing
-- project creation still falls back to the org default workflow.
-- ============================================================================

alter table public.profiles
  add column if not exists date_format text not null default 'medium';

alter table public.workspaces
  add column if not exists logo_url text;

alter table public.workspaces
  add column if not exists default_workflow_id uuid references public.workflows (id) on delete set null;

-- Guest invitations carry the client account so acceptance can link the guest
-- to the account whose projects they may see (can_view_project guest path).
alter table public.invitations
  add column if not exists account_id uuid references public.accounts (id) on delete set null;
