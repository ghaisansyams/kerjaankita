-- ============================================================================
-- 0012 · Task column guard + insert-visibility hardening
--
-- (1) Column guard. RLS lets an assignee update their own task
--     (task.update.own), but the PRD/FSD restrict non-managers to
--     status / progress / actual_hours / evidence / checklist — they must not
--     change title, description, priority, assignee, dates or estimates. RLS
--     filters rows, not columns, so this BEFORE UPDATE trigger reverts
--     manager-owned columns for callers who lack task.update.any on the task's
--     project. Managers may change anything.
--
-- (2) Insert visibility. `org_member` holds `task.create` organization-wide, so
--     tasks_insert must also require can_view_project(project_id) — otherwise a
--     member who knew a private project's id could inject tasks into it.
-- ============================================================================

create or replace function public.enforce_task_column_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Managers (task.update.any on this project) may change any column.
  if public.has_permission(new.organization_id, 'task.update.any', null, new.project_id) then
    return new;
  end if;
  -- Otherwise preserve manager-owned fields. Fields NOT listed here
  -- (status_id, progress, actual_hours, completed_at, is_blocked,
  --  blocked_*, evidence urls/notes) remain editable by the assignee.
  new.title           := old.title;
  new.description     := old.description;
  new.priority        := old.priority;
  new.assignee_id     := old.assignee_id;
  new.reporter_id     := old.reporter_id;
  new.start_date      := old.start_date;
  new.due_date        := old.due_date;
  new.estimated_hours := old.estimated_hours;
  new.project_id      := old.project_id;
  new.number          := old.number;
  new.milestone_id    := old.milestone_id;
  return new;
end;
$$;

-- Runs after trg_tasks_before (b < g) so status/progress side-effects are kept.
create trigger trg_tasks_guard
  before update on public.tasks
  for each row execute function public.enforce_task_column_guard();

-- Harden task creation: capability AND project visibility.
drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks for insert
  with check (
    public.has_permission(organization_id, 'task.create', null, project_id)
    and public.can_view_project(project_id)
  );
