-- ============================================================================
-- 0016 · Notification center: preferences, preference-aware delivery, new
--        notification types, and the scheduled deadline scan.
-- Forward-only. One new table (notification_preferences); the rest are
-- CREATE OR REPLACE of existing trigger functions + a new function that the
-- generated types already reference (generate_deadline_notifications).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Per-user notification preferences (personal, like notifications themselves).
-- A missing row means "enabled" — we only store opt-outs / email opt-ins.
-- ---------------------------------------------------------------------------
create table if not exists public.notification_preferences (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  type            text not null,
  in_app          boolean not null default true,
  email           boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, user_id, type)
);
create index if not exists idx_notification_prefs_user
  on public.notification_preferences (user_id, organization_id);

alter table public.notification_preferences enable row level security;

create policy notification_prefs_read on public.notification_preferences
  for select using (user_id = auth.uid());
create policy notification_prefs_write on public.notification_preferences
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- The blanket grant in 0008 only covered tables that existed then; grant the
-- new table to the authenticated role (RLS still gates row access).
grant select, insert, update, delete on public.notification_preferences to authenticated;

-- ---------------------------------------------------------------------------
-- notify_user — now respects an in-app opt-out for the (user, org, type).
-- ---------------------------------------------------------------------------
create or replace function public.notify_user(
  p_org uuid, p_target uuid, p_actor uuid, p_type text,
  p_title text, p_body text, p_entity public.entity_type, p_entity_id uuid
) returns void language plpgsql security definer set search_path = public
as $$
begin
  if p_target is null or p_target = p_actor then return; end if;
  if exists (
    select 1 from public.notification_preferences np
    where np.user_id = p_target and np.organization_id = p_org
      and np.type = p_type and np.in_app = false
  ) then
    return;
  end if;
  insert into public.notifications (organization_id, user_id, type, title, body, entity, entity_id)
  values (p_org, p_target, p_type, p_title, p_body, p_entity, p_entity_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- tasks_after_write — adds task_reassigned + task_completed notifications and
-- keeps the task.rescheduled / task.reordered audit events from 0015.
-- ---------------------------------------------------------------------------
create or replace function public.tasks_after_write()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_project uuid;
  v_org     uuid;
  v_owner   uuid;
  v_cat     public.status_category;
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
      -- Completion: entering a done-category status notifies the reporter.
      select category into v_cat from public.workflow_statuses where id = new.status_id;
      if v_cat = 'done' then
        perform public.notify_user(v_org, new.reporter_id, auth.uid(), 'task_completed',
          'Task completed', new.title, 'task', new.id);
      end if;
    end if;
    if new.progress is distinct from old.progress then
      perform public.log_activity(v_org, v_project, 'task', new.id, 'task.progress_updated',
        jsonb_build_object('from', old.progress, 'to', new.progress), true);
    end if;
    if new.assignee_id is distinct from old.assignee_id then
      perform public.log_activity(v_org, v_project, 'task', new.id, 'task.assigned',
        jsonb_build_object('assignee_id', new.assignee_id), false);
      -- An existing task changing hands is a reassignment.
      perform public.notify_user(v_org, new.assignee_id, auth.uid(), 'task_reassigned',
        'Task reassigned to you', new.title, 'task', new.id);
    end if;
    if new.is_blocked and not old.is_blocked then
      select owner_id into v_owner from public.projects where id = v_project;
      perform public.log_activity(v_org, v_project, 'task', new.id, 'task.blocked',
        jsonb_build_object('reason', new.blocked_reason), false);
      perform public.notify_user(v_org, v_owner, auth.uid(), 'task_blocked',
        'Task blocked', new.title, 'task', new.id);
    end if;
    if new.due_date is distinct from old.due_date then
      perform public.log_activity(v_org, v_project, 'task', new.id, 'task.rescheduled',
        jsonb_build_object('from', old.due_date, 'to', new.due_date), false);
    end if;
    if new.position is distinct from old.position
       and new.status_id is not distinct from old.status_id then
      perform public.log_activity(v_org, v_project, 'task', new.id, 'task.reordered',
        jsonb_build_object('from', old.position, 'to', new.position), true);
    end if;
  end if;

  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- projects_after_write — adds a project_completed activity + owner notification
-- when progress first reaches 100.
-- ---------------------------------------------------------------------------
create or replace function public.projects_after_write()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_activity(new.organization_id, new.id, 'project', new.id,
      'project.created', jsonb_build_object('name', new.name), true);
  elsif tg_op = 'UPDATE' then
    if new.status_id is distinct from old.status_id then
      perform public.log_activity(new.organization_id, new.id, 'project', new.id,
        'project.status_changed',
        jsonb_build_object('from', old.status_id, 'to', new.status_id), true);
    end if;
    if new.progress >= 100 and coalesce(old.progress, 0) < 100 then
      perform public.log_activity(new.organization_id, new.id, 'project', new.id,
        'project.completed', '{}'::jsonb, true);
      perform public.notify_user(new.organization_id, new.owner_id, auth.uid(),
        'project_completed', 'Project completed', new.name, 'project', new.id);
    end if;
    if new.deleted_at is not null and old.deleted_at is null then
      perform public.log_activity(new.organization_id, new.id, 'project', new.id,
        'project.deleted', '{}'::jsonb, false);
    end if;
  end if;
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- guest_file_shared — when a file is made guest-visible, notify the guests of
-- the project's client account. (The visibility toggle ships with the guest
-- portal; the delivery path is wired here.)
-- ---------------------------------------------------------------------------
create or replace function public.attachments_after_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_account uuid;
  g record;
begin
  if new.is_guest_visible and not old.is_guest_visible then
    select account_id into v_account from public.projects where id = new.project_id;
    if v_account is not null then
      for g in
        select user_id from public.organization_members
        where organization_id = new.organization_id
          and member_type = 'guest' and status = 'active' and account_id = v_account
      loop
        perform public.notify_user(new.organization_id, g.user_id, auth.uid(),
          'guest_file_shared', 'A file was shared with you', new.file_name,
          new.entity, new.entity_id);
      end loop;
    end if;
  end if;
  return null;
end;
$$;

create trigger trg_attachments_after_update after update on public.attachments
  for each row execute function public.attachments_after_update();

-- ---------------------------------------------------------------------------
-- generate_deadline_notifications — daily scan for tasks due today / tomorrow.
-- Idempotent per calendar day (won't re-notify the same task+type twice a day).
-- Intended to run from pg_cron; also callable manually.
-- ---------------------------------------------------------------------------
create or replace function public.generate_deadline_notifications()
returns void language plpgsql security definer set search_path = public
as $$
declare
  r record;
  v_type text;
begin
  for r in
    select t.id, t.title, t.assignee_id, t.organization_id, t.due_date
    from public.tasks t
    join public.workflow_statuses s on s.id = t.status_id
    where t.deleted_at is null
      and t.assignee_id is not null
      and s.category not in ('done', 'cancelled')
      and t.due_date in (current_date, current_date + 1)
  loop
    v_type := case when r.due_date = current_date then 'deadline_today' else 'deadline_tomorrow' end;
    if not exists (
      select 1 from public.notifications n
      where n.user_id = r.assignee_id and n.entity = 'task' and n.entity_id = r.id
        and n.type = v_type and n.created_at::date = current_date
    ) then
      perform public.notify_user(r.organization_id, r.assignee_id, null, v_type,
        case when r.due_date = current_date then 'Due today' else 'Due tomorrow' end,
        r.title, 'task', r.id);
    end if;
  end loop;
end;
$$;

-- Schedule daily at 06:05 when pg_cron is available (skipped in test/dev).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('flowdesk-deadline-scan', '5 6 * * *',
      'select public.generate_deadline_notifications()');
  end if;
end $$;
