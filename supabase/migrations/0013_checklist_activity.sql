-- ============================================================================
-- 0013 · Checklist activity
--
-- The task Activity Timeline is the central history of everything that happens
-- to a task. Status changes, assignments, progress, uploads and comments are
-- already logged by triggers; checklist changes were not. This adds them so
-- "added a checklist item" / "completed a checklist item" appear in the feed.
-- Logged against the parent task (entity='task', entity_id=task_id), internal.
-- ============================================================================

create or replace function public.log_checklist_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_task    uuid;
  v_project uuid;
  v_org     uuid;
begin
  v_task := coalesce(new.task_id, old.task_id);
  select project_id, organization_id into v_project, v_org
    from public.tasks where id = v_task;

  if tg_op = 'INSERT' then
    perform public.log_activity(v_org, v_project, 'task', v_task,
      'checklist.item_added', jsonb_build_object('content', new.content), false);
  elsif tg_op = 'UPDATE' and new.is_done and not old.is_done then
    perform public.log_activity(v_org, v_project, 'task', v_task,
      'checklist.item_completed', jsonb_build_object('content', new.content), false);
  end if;
  return null;
end;
$$;

create trigger trg_checklist_activity
  after insert or update on public.task_checklist_items
  for each row execute function public.log_checklist_activity();
