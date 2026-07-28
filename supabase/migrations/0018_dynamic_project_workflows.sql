-- ============================================================================
-- 0018 · Per-project editable workflows
--
-- The workflow model (0003) was built so statuses are data, not an enum, and
-- both `projects.workflow_id` and `tasks.workflow_id` already exist. They were
-- simply never populated per project — every task fell back to the single
-- org-wide default task workflow, so all boards showed identical columns.
--
-- This migration gives each project its OWN task workflow (a clone of the org
-- default) so managers can rename / recolor / reorder / add / delete columns
-- per project. Nothing about the task/status/progress model changes: tasks keep
-- `status_id` + `workflow_id`, category still drives done/blocked/completion,
-- and `recompute_project_progress` still rolls up weighted `tasks.progress`.
-- ============================================================================

-- 1. Project-scoped workflows + future-ready per-column WIP limit ------------
alter table public.workflows
  add column if not exists project_id uuid references public.projects (id) on delete cascade;
create index if not exists idx_workflows_project
  on public.workflows (project_id) where project_id is not null and deleted_at is null;

alter table public.workflow_statuses
  add column if not exists wip_limit integer check (wip_limit is null or wip_limit >= 0);

-- 2. Clone the org default task workflow into a project-owned workflow -------
--    Also remaps any existing tasks in the project from the shared statuses to
--    the clone's statuses (matched by stable `key`). Safe to call for a new,
--    empty project (the remap is then a no-op).
create or replace function public.clone_task_workflow_for_project(p_project uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
  v_src uuid;
  v_new uuid;
begin
  select organization_id into v_org from public.projects where id = p_project;
  if v_org is null then return null; end if;

  -- Source template = the org's default task workflow.
  select id into v_src from public.workflows
   where organization_id = v_org and entity = 'task'
     and is_default and deleted_at is null
   limit 1;
  if v_src is null then return null; end if;

  insert into public.workflows
    (organization_id, project_id, name, description, entity, is_default, is_system, created_by)
  values
    (v_org, p_project, 'Project Workflow', 'Per-project task workflow', 'task', false, false, auth.uid())
  returning id into v_new;

  insert into public.workflow_statuses
    (organization_id, workflow_id, key, name, description, category, color,
     position, is_initial, is_final, auto_progress, wip_limit, created_by)
  select v_org, v_new, s.key, s.name, s.description, s.category, s.color,
         s.position, s.is_initial, s.is_final, s.auto_progress, s.wip_limit, auth.uid()
    from public.workflow_statuses s
   where s.workflow_id = v_src and s.deleted_at is null;

  update public.projects set workflow_id = v_new where id = p_project;

  -- Repoint existing tasks to the equivalent clone status (same key).
  update public.tasks t
     set status_id = ns.id, workflow_id = v_new
    from public.workflow_statuses os
    join public.workflow_statuses ns on ns.workflow_id = v_new and ns.key = os.key
   where os.workflow_id = v_src
     and t.project_id = p_project
     and t.status_id = os.id;

  return v_new;
end;
$$;

-- 3. Auto-provision a per-project workflow on project creation ---------------
create or replace function public.provision_project_workflow()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Only when a project doesn't already carry its own task workflow (templates
  -- may set one explicitly). New projects have no tasks yet, so no remap runs.
  if new.workflow_id is null then
    perform public.clone_task_workflow_for_project(new.id);
  end if;
  return null;
end;
$$;

drop trigger if exists trg_projects_provision_workflow on public.projects;
create trigger trg_projects_provision_workflow
  after insert on public.projects
  for each row execute function public.provision_project_workflow();

-- 4. Backfill existing projects ---------------------------------------------
--    Triggers on tasks are paused so the status remap preserves each task's
--    current progress (the status-change trigger would otherwise reset it to
--    the column's auto_progress). Progress is recomputed afterwards.
do $$
declare r record;
begin
  alter table public.tasks disable trigger trg_tasks_before;
  alter table public.tasks disable trigger trg_tasks_after;

  for r in select id from public.projects where deleted_at is null and workflow_id is null loop
    perform public.clone_task_workflow_for_project(r.id);
  end loop;

  alter table public.tasks enable trigger trg_tasks_before;
  alter table public.tasks enable trigger trg_tasks_after;

  for r in select id from public.projects where deleted_at is null loop
    perform public.recompute_project_progress(r.id);
  end loop;
end $$;
