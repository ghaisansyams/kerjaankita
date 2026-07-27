-- 0015_reschedule_reorder_activity.sql
-- Add two audit events to the existing task activity trigger:
--   • task.rescheduled — a due-date change. Client-visible (is_internal=false),
--     since deadline moves matter to guests. The column guard reverts due_date
--     for non-managers, so only real (manager) reschedules ever reach here.
--   • task.reordered   — a *within-column* position change (same status). Kept
--     internal (is_internal=true) as low-signal board housekeeping. A move that
--     also changes status is already logged as task.status_changed, so we
--     require the status to be unchanged — that's what makes a reorder
--     "meaningful" rather than a side effect of a column move.
-- Forward-only: CREATE OR REPLACE of the function body; no schema change.

create or replace function public.tasks_after_write()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_project uuid;
  v_org     uuid;
  v_owner   uuid;
begin
  if tg_op = 'DELETE' then
    v_project := old.project_id;
    v_org     := old.organization_id;
  else
    v_project := new.project_id;
    v_org     := new.organization_id;
  end if;

  perform public.recompute_project_progress(v_project);

  if tg_op = 'INSERT' then
    perform public.log_activity(v_org, v_project, 'task', new.id, 'task.created',
      jsonb_build_object('title', new.title), true);
    if new.assignee_id is not null then
      perform public.notify_user(v_org, new.assignee_id, auth.uid(), 'task_assigned',
        'New task assigned', new.title, 'task', new.id);
    end if;

  elsif tg_op = 'UPDATE' then
    if new.status_id is distinct from old.status_id then
      perform public.log_activity(v_org, v_project, 'task', new.id, 'task.status_changed',
        jsonb_build_object('from', old.status_id, 'to', new.status_id), true);
    end if;
    if new.progress is distinct from old.progress then
      perform public.log_activity(v_org, v_project, 'task', new.id, 'task.progress_updated',
        jsonb_build_object('from', old.progress, 'to', new.progress), true);
    end if;
    if new.assignee_id is distinct from old.assignee_id then
      perform public.log_activity(v_org, v_project, 'task', new.id, 'task.assigned',
        jsonb_build_object('assignee_id', new.assignee_id), false);
      perform public.notify_user(v_org, new.assignee_id, auth.uid(), 'task_assigned',
        'Task assigned to you', new.title, 'task', new.id);
    end if;
    if new.is_blocked and not old.is_blocked then
      select owner_id into v_owner from public.projects where id = v_project;
      perform public.log_activity(v_org, v_project, 'task', new.id, 'task.blocked',
        jsonb_build_object('reason', new.blocked_reason), false);
      perform public.notify_user(v_org, v_owner, auth.uid(), 'task_blocked',
        'Task blocked', new.title, 'task', new.id);
    end if;
    -- NEW: due-date change (client-visible).
    if new.due_date is distinct from old.due_date then
      perform public.log_activity(v_org, v_project, 'task', new.id, 'task.rescheduled',
        jsonb_build_object('from', old.due_date, 'to', new.due_date), false);
    end if;
    -- NEW: meaningful within-column reorder (internal).
    if new.position is distinct from old.position
       and new.status_id is not distinct from old.status_id then
      perform public.log_activity(v_org, v_project, 'task', new.id, 'task.reordered',
        jsonb_build_object('from', old.position, 'to', new.position), true);
    end if;
  end if;

  return null;
end;
$$;
