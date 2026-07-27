-- ============================================================================
-- 0011 · Task evidence fields
--
-- The "Project Evidence" fields (PRD §Project Evidence, FSD 07) — links a task
-- to its proof of work. The v2 tasks redesign omitted these; this additive
-- migration restores them. The developer column-guard trigger already permits
-- non-managers to edit these (they are not in its protected-field list), so
-- assignees can attach evidence to their own tasks.
-- ============================================================================

alter table public.tasks
  add column if not exists github_pr_url  text,
  add column if not exists figma_url      text,
  add column if not exists staging_url    text,
  add column if not exists production_url text,
  add column if not exists evidence_notes text;
