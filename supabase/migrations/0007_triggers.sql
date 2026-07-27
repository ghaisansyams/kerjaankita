-- ============================================================================
-- 0007 · Trigger functions and triggers
--
-- Principle: invariants that must ALWAYS hold live in the database, never in
-- application code. Tenant consistency, task numbering, progress rollups and
-- the audit trail cannot be skipped by a forgotten code path or a direct SQL
-- edit — every write goes through these triggers.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Audit column stamping
-- ----------------------------------------------------------------------------
create or replace function public.set_audit_fields()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := coalesce(new.created_at, now());
    new.created_by := coalesce(new.created_by, auth.uid());
    new.updated_at := now();
    new.updated_by := coalesce(new.updated_by, auth.uid());
  else
    new.created_at := old.created_at;
    new.created_by := old.created_by;
    new.updated_at := now();
    new.updated_by := coalesce(auth.uid(), old.updated_by);
  end if;
  return new;
end;
$$;

create or replace function public.set_created_audit()
returns trigger language plpgsql as $$
begin
  new.created_at := coalesce(new.created_at, now());
  new.created_by := coalesce(new.created_by, auth.uid());
  return new;
end;
$$;

create or replace function public.set_updated_timestamp()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- Identity: create a profile whenever an auth user is created
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name',
             new.raw_user_meta_data ->> 'name',
             split_part(coalesce(new.email, ''), '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- An organization must never lose its last active owner
-- ----------------------------------------------------------------------------
create or replace function public.prevent_last_owner_removal()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_owner_role uuid;
  v_remaining  int;
begin
  select id into v_owner_role
    from public.roles where organization_id is null and key = 'org_owner';

  if old.role_id = v_owner_role
     and (new.role_id is distinct from v_owner_role
          or new.status <> 'active'
          or new.deleted_at is not null) then
    select count(*) into v_remaining
      from public.organization_members
     where organization_id = old.organization_id
       and role_id = v_owner_role
       and status = 'active'
       and deleted_at is null
       and id <> old.id;
    if v_remaining = 0 then
      raise exception 'An organization must retain at least one active owner'
        using errcode = 'restrict_violation';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_org_members_last_owner
  before update on public.organization_members
  for each row execute function public.prevent_last_owner_removal();

-- ----------------------------------------------------------------------------
-- Projects: derive tenancy, log activity
-- ----------------------------------------------------------------------------
create or replace function public.projects_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- organization always follows the workspace: tenancy cannot be spoofed
  select w.organization_id into new.organization_id
    from public.workspaces w where w.id = new.workspace_id;

  if new.workflow_id is null then
    select id into new.workflow_id from public.workflows
     where organization_id = new.organization_id and entity = 'project'
       and is_default and deleted_at is null limit 1;
  end if;

  new.progress := greatest(0, least(100, coalesce(new.progress, 0)));
  return new;
end;
$$;

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
    if new.deleted_at is not null and old.deleted_at is null then
      perform public.log_activity(new.organization_id, new.id, 'project', new.id,
        'project.deleted', '{}'::jsonb, false);
    end if;
  end if;
  return null;
end;
$$;

create trigger trg_projects_before before insert or update on public.projects
  for each row execute function public.projects_before_write();
create trigger trg_projects_after  after insert or update on public.projects
  for each row execute function public.projects_after_write();

-- ----------------------------------------------------------------------------
-- Tasks: the busiest trigger in the system
--   • derives organization + workflow from the project (tenancy integrity)
--   • allocates the per-project task number atomically
--   • validates the workflow transition
--   • applies status-driven progress / completion / blocked state
-- ----------------------------------------------------------------------------
create or replace function public.tasks_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_cat  public.status_category;
  v_auto smallint;
  v_org  uuid;
  v_wf   uuid;
begin
  select p.organization_id, p.workflow_id into v_org, v_wf
    from public.projects p where p.id = new.project_id;

  new.organization_id := v_org;
  new.workflow_id := coalesce(new.workflow_id, v_wf);

  if new.workflow_id is null then
    select id into new.workflow_id from public.workflows
     where organization_id = v_org and entity = 'task'
       and is_default and deleted_at is null limit 1;
  end if;

  if new.status_id is null then
    select id into new.status_id from public.workflow_statuses
     where workflow_id = new.workflow_id and is_initial and deleted_at is null limit 1;
  end if;

  if tg_op = 'INSERT' and coalesce(new.number, 0) = 0 then
    update public.projects set task_seq = task_seq + 1
     where id = new.project_id
     returning task_seq into new.number;
  end if;

  if tg_op = 'UPDATE' and new.status_id is distinct from old.status_id then
    if not public.is_transition_allowed(new.workflow_id, old.status_id, new.status_id) then
      raise exception 'Status transition is not permitted by this workflow'
        using errcode = 'check_violation';
    end if;
  end if;

  select category, auto_progress into v_cat, v_auto
    from public.workflow_statuses where id = new.status_id;

  -- Apply the status's default progress, but never clobber a progress value the
  -- caller supplied explicitly (only fill in when it is still at the default 0).
  if v_auto is not null
     and (
       (tg_op = 'INSERT' and coalesce(new.progress, 0) = 0)
       or (tg_op = 'UPDATE' and new.status_id is distinct from old.status_id)
     ) then
    new.progress := v_auto;
  end if;

  if v_cat = 'done' then
    new.progress := 100;
    new.completed_at := coalesce(new.completed_at, now());
  elsif tg_op = 'UPDATE' and old.completed_at is not null and v_cat is distinct from 'done' then
    new.completed_at := null;
  end if;

  if v_cat = 'blocked' then
    new.is_blocked := true;
    new.blocked_since := coalesce(new.blocked_since, now());
  else
    new.is_blocked := false;
    new.blocked_since := null;
  end if;

  new.progress := greatest(0, least(100, coalesce(new.progress, 0)));
  return new;
end;
$$;

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
  end if;

  return null;
end;
$$;

create trigger trg_tasks_before before insert or update on public.tasks
  for each row execute function public.tasks_before_write();
create trigger trg_tasks_after  after insert or update or delete on public.tasks
  for each row execute function public.tasks_after_write();

-- ----------------------------------------------------------------------------
-- Child records inherit tenancy from their project — never trust the client
-- ----------------------------------------------------------------------------
create or replace function public.derive_org_from_project()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.project_id is not null then
    select organization_id into new.organization_id
      from public.projects where id = new.project_id;
  end if;
  return new;
end;
$$;

create or replace function public.derive_org_from_task()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select organization_id into new.organization_id
    from public.tasks where id = new.task_id;
  return new;
end;
$$;

create trigger trg_milestones_org before insert or update on public.milestones
  for each row execute function public.derive_org_from_project();
create trigger trg_project_members_org before insert or update on public.project_members
  for each row execute function public.derive_org_from_project();
create trigger trg_checklist_org before insert or update on public.task_checklist_items
  for each row execute function public.derive_org_from_task();

-- ----------------------------------------------------------------------------
-- Comments: activity + @mention notifications
-- ----------------------------------------------------------------------------
create or replace function public.comments_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_mention uuid;
begin
  perform public.log_activity(new.organization_id, new.project_id, new.entity, new.entity_id,
    'comment.created', jsonb_build_object('comment_id', new.id), not new.is_internal);

  foreach v_mention in array new.mentions loop
    perform public.notify_user(new.organization_id, v_mention, new.author_id, 'mentioned',
      'You were mentioned', left(new.body, 140), new.entity, new.entity_id);
  end loop;

  return null;
end;
$$;

create trigger trg_comments_after after insert on public.comments
  for each row execute function public.comments_after_insert();

-- ----------------------------------------------------------------------------
-- Attachments: activity trail
-- ----------------------------------------------------------------------------
create or replace function public.attachments_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.log_activity(new.organization_id, new.project_id, new.entity, new.entity_id,
    'attachment.uploaded', jsonb_build_object('file_name', new.file_name), new.is_guest_visible);
  return null;
end;
$$;

create trigger trg_attachments_after after insert on public.attachments
  for each row execute function public.attachments_after_insert();

-- ----------------------------------------------------------------------------
-- Custom fields: enforce the declared type at write time
-- ----------------------------------------------------------------------------
create or replace function public.validate_custom_field_value()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_type public.custom_field_type;
  v_req  boolean;
  v_opts jsonb;
begin
  select field_type, is_required, options into v_type, v_req, v_opts
    from public.custom_field_definitions where id = new.definition_id;

  if new.value is null or jsonb_typeof(new.value) = 'null' then
    if v_req then
      raise exception 'Custom field is required' using errcode = 'not_null_violation';
    end if;
    return new;
  end if;

  case v_type
    when 'number', 'currency' then
      if jsonb_typeof(new.value) <> 'number' then
        raise exception 'Custom field expects a number' using errcode = 'invalid_text_representation';
      end if;
    when 'boolean' then
      if jsonb_typeof(new.value) <> 'boolean' then
        raise exception 'Custom field expects a boolean' using errcode = 'invalid_text_representation';
      end if;
    when 'multi_select' then
      if jsonb_typeof(new.value) <> 'array' then
        raise exception 'Custom field expects an array' using errcode = 'invalid_text_representation';
      end if;
    when 'select' then
      if jsonb_array_length(v_opts) > 0
         and not (v_opts @> jsonb_build_array(new.value)) then
        raise exception 'Value is not one of the allowed options' using errcode = 'check_violation';
      end if;
    else
      null; -- text-like types accept any scalar
  end case;

  return new;
end;
$$;

create trigger trg_cfv_validate before insert or update on public.custom_field_values
  for each row execute function public.validate_custom_field_value();

-- ----------------------------------------------------------------------------
-- Apply audit stamping
-- ----------------------------------------------------------------------------
do $$
declare
  t text;
  full_audit text[] := array[
    'profiles','organizations','organization_settings','roles','organization_members',
    'workspaces','workspace_members','teams','invitations','workflows','workflow_statuses',
    'workflow_transitions','project_templates','task_templates','accounts','contacts',
    'projects','project_members','milestones','tasks','task_checklist_items','comments',
    'attachments','custom_field_definitions','custom_field_values','automation_rules'
  ];
  created_only text[] := array['team_members','tags','taggables','task_dependencies'];
begin
  foreach t in array full_audit loop
    execute format(
      'create trigger trg_%s_audit before insert or update on public.%I
         for each row execute function public.set_audit_fields()', t, t);
  end loop;

  foreach t in array created_only loop
    execute format(
      'create trigger trg_%s_audit before insert on public.%I
         for each row execute function public.set_created_audit()', t, t);
  end loop;

  execute 'create trigger trg_project_template_tasks_updated
             before update on public.project_template_tasks
             for each row execute function public.set_updated_timestamp()';
end;
$$;
