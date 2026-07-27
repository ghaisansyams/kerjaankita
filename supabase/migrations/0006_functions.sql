-- ============================================================================
-- 0006 · Database functions
--
-- Three families:
--   A. Access helpers  — SECURITY DEFINER, called by RLS policies. Definer
--      rights are mandatory: a policy on `projects` that reads `projects`
--      would recurse infinitely under invoker rights.
--   B. Domain logic    — progress, health, transitions.
--   C. Operations      — bootstrap a tenant, instantiate templates, soft delete.
--
-- All helpers are STABLE so Postgres evaluates them once per statement rather
-- than once per row. This is the difference between a fast and unusable RLS.
-- ============================================================================

-- ============================ A. ACCESS HELPERS =============================

create or replace function public.is_org_member(p_org uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.organization_members om
    where om.organization_id = p_org
      and om.user_id = auth.uid()
      and om.status = 'active'
      and om.deleted_at is null
  )
$$;

create or replace function public.is_org_guest(p_org uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.organization_members om
    where om.organization_id = p_org
      and om.user_id = auth.uid()
      and om.member_type = 'guest'
      and om.status = 'active'
      and om.deleted_at is null
  )
$$;

create or replace function public.is_workspace_member(p_workspace uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = p_workspace
      and wm.user_id = auth.uid()
      and wm.deleted_at is null
  )
$$;

create or replace function public.is_project_member(p_project uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.project_members pm
    where pm.project_id = p_project
      and pm.user_id = auth.uid()
      and pm.deleted_at is null
  )
$$;

/*
  Effective permission = union of the permissions granted by the caller's
  organization role, workspace role and project role. Passing the workspace /
  project narrows the check; omitting them evaluates organization scope only.
*/
create or replace function public.has_permission(
  p_org        uuid,
  p_permission text,
  p_workspace  uuid default null,
  p_project    uuid default null
) returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.role_permissions rp
    join public.permissions p on p.id = rp.permission_id
    where p.key = p_permission
      and rp.role_id in (
        select om.role_id from public.organization_members om
         where om.organization_id = p_org
           and om.user_id = auth.uid()
           and om.status = 'active'
           and om.deleted_at is null
        union all
        select wm.role_id from public.workspace_members wm
         where p_workspace is not null
           and wm.workspace_id = p_workspace
           and wm.user_id = auth.uid()
           and wm.deleted_at is null
        union all
        select pm.role_id from public.project_members pm
         where p_project is not null
           and pm.project_id = p_project
           and pm.user_id = auth.uid()
           and pm.deleted_at is null
      )
  )
$$;

/*
  Project visibility resolution — the single most important access rule.

    explicit project membership          → always visible
    guest + account match                → visible (client sees their own work)
    member + visibility='organization'   → visible
    member + visibility='workspace'      → visible if workspace member
    member with 'project.view.all'       → visible (managers/auditors)
    otherwise                            → hidden
*/
create or replace function public.can_view_project(p_project uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.projects pr
    join public.organization_members om
      on om.organization_id = pr.organization_id
     and om.user_id = auth.uid()
     and om.status = 'active'
     and om.deleted_at is null
    where pr.id = p_project
      and pr.deleted_at is null
      and (
        exists (
          select 1 from public.project_members pm
          where pm.project_id = pr.id
            and pm.user_id = auth.uid()
            and pm.deleted_at is null
        )
        or (om.member_type = 'guest'
            and om.account_id is not null
            and om.account_id = pr.account_id)
        or (om.member_type = 'member' and (
              pr.visibility = 'organization'
              or (pr.visibility = 'workspace'
                  and exists (select 1 from public.workspace_members wm
                              where wm.workspace_id = pr.workspace_id
                                and wm.user_id = auth.uid()
                                and wm.deleted_at is null))
              or public.has_permission(pr.organization_id, 'project.view.all')
           ))
      )
  )
$$;

create or replace function public.can_view_task(p_task uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.can_view_project(
    (select project_id from public.tasks where id = p_task)
  )
$$;

create or replace function public.can_edit_task(p_task uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.tasks t
    where t.id = p_task
      and t.deleted_at is null
      and (
        public.has_permission(t.organization_id, 'task.update.any', null, t.project_id)
        or (t.assignee_id = auth.uid()
            and public.has_permission(t.organization_id, 'task.update.own', null, t.project_id))
      )
  )
$$;

-- Guests must never see internal discussion, hours, or unshared files.
create or replace function public.can_see_internal(p_org uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.is_org_member(p_org) and not public.is_org_guest(p_org)
$$;

-- ============================ B. DOMAIN LOGIC ===============================

create or replace function public.status_category_of(p_status uuid)
returns public.status_category language sql stable security definer set search_path = public
as $$ select category from public.workflow_statuses where id = p_status $$;

/*
  Effort-weighted project progress (PRD BR-2 / decision D4).
  A 40-hour task must not count the same as a 1-hour task.
      progress = Σ(task_progress × weight) / Σ(weight),  weight = estimated_hours (default 1)
  Only leaf tasks count — parent tasks aggregate their children and would
  otherwise be counted twice.
*/
create or replace function public.recompute_project_progress(p_project uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare
  v_progress smallint;
begin
  select coalesce(
           round(
             sum(t.progress * coalesce(t.estimated_hours, 1))::numeric
             / nullif(sum(coalesce(t.estimated_hours, 1)), 0)
           ), 0)::smallint
    into v_progress
  from public.tasks t
  where t.project_id = p_project
    and t.deleted_at is null
    and not exists (select 1 from public.tasks c
                    where c.parent_id = t.id and c.deleted_at is null);

  update public.projects
     set progress = coalesce(v_progress, 0)
   where id = p_project
     and progress is distinct from coalesce(v_progress, 0);
end;
$$;

/*
  Project health (PRD BR-5). Tolerance is per-tenant, never hard-coded.
*/
create or replace function public.compute_project_health(
  p_progress  smallint,
  p_start     date,
  p_end       date,
  p_is_closed boolean,
  p_tolerance smallint default 15
) returns public.project_health
language plpgsql stable
as $$
declare
  v_expected int;
begin
  if p_is_closed then return 'on_track'; end if;
  if p_end is null then return 'on_track'; end if;
  if current_date > p_end and coalesce(p_progress, 0) < 100 then return 'delayed'; end if;
  if p_start is null or p_end <= p_start then return 'on_track'; end if;

  v_expected := greatest(0, least(100,
    round((current_date - p_start)::numeric / nullif((p_end - p_start), 0) * 100)::int));

  if coalesce(p_progress, 0) < v_expected - p_tolerance then
    return 'at_risk';
  end if;
  return 'on_track';
end;
$$;

-- Is a move allowed by the workflow? No transition rows defined = allow all.
create or replace function public.is_transition_allowed(
  p_workflow uuid, p_from uuid, p_to uuid
) returns boolean language sql stable security definer set search_path = public
as $$
  select
    case
      when p_from is null or p_from = p_to then true
      when not exists (select 1 from public.workflow_transitions wt
                       where wt.workflow_id = p_workflow and wt.deleted_at is null)
        then true
      else exists (
        select 1 from public.workflow_transitions wt
        where wt.workflow_id = p_workflow
          and wt.to_status_id = p_to
          and (wt.from_status_id is null or wt.from_status_id = p_from)
          and wt.deleted_at is null
      )
    end
$$;

create or replace function public.notify_user(
  p_org uuid, p_target uuid, p_actor uuid, p_type text,
  p_title text, p_body text, p_entity public.entity_type, p_entity_id uuid
) returns void language plpgsql security definer set search_path = public
as $$
begin
  if p_target is null or p_target = p_actor then return; end if;
  insert into public.notifications (organization_id, user_id, type, title, body, entity, entity_id)
  values (p_org, p_target, p_type, p_title, p_body, p_entity, p_entity_id);
end;
$$;

create or replace function public.log_activity(
  p_org uuid, p_project uuid, p_entity public.entity_type, p_entity_id uuid,
  p_action text, p_metadata jsonb default '{}'::jsonb, p_guest_visible boolean default false
) returns void language plpgsql security definer set search_path = public
as $$
begin
  insert into public.activities (organization_id, project_id, entity, entity_id,
                                 actor_id, action, metadata, is_guest_visible)
  values (p_org, p_project, p_entity, p_entity_id, auth.uid(), p_action, p_metadata, p_guest_visible);
end;
$$;

-- ============================ C. OPERATIONS =================================

/*
  Creates an industry-appropriate default task workflow.
  This is what makes onboarding a construction firm feel different from
  onboarding a software agency, without any code branching in the app.
*/
create or replace function public.create_default_task_workflow(
  p_org uuid, p_workspace uuid, p_industry text default 'general'
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_workflow uuid;
  v_statuses jsonb;
  v_item     jsonb;
  v_idx      int := 0;
begin
  insert into public.workflows (organization_id, workspace_id, name, entity, is_default, is_system)
  values (p_org, p_workspace, 'Default Task Workflow', 'task', true, true)
  returning id into v_workflow;

  v_statuses := case p_industry
    when 'construction' then '[
      {"key":"planned","name":"Planned","category":"todo","color":"#64748B","initial":true,"progress":0},
      {"key":"materials","name":"Materials","category":"todo","color":"#0EA5E9","progress":10},
      {"key":"execution","name":"Execution","category":"in_progress","color":"#2563EB","progress":40},
      {"key":"inspection","name":"Inspection","category":"review","color":"#7C3AED","progress":80},
      {"key":"handover","name":"Handover","category":"done","color":"#059669","final":true,"progress":100},
      {"key":"on_hold","name":"On Hold","category":"blocked","color":"#DC2626"}
    ]'::jsonb
    when 'healthcare' then '[
      {"key":"intake","name":"Intake","category":"todo","color":"#64748B","initial":true,"progress":0},
      {"key":"triage","name":"Triage","category":"todo","color":"#0EA5E9","progress":20},
      {"key":"treatment","name":"Treatment","category":"in_progress","color":"#2563EB","progress":50},
      {"key":"follow_up","name":"Follow-up","category":"review","color":"#7C3AED","progress":80},
      {"key":"discharged","name":"Discharged","category":"done","color":"#059669","final":true,"progress":100},
      {"key":"on_hold","name":"On Hold","category":"blocked","color":"#DC2626"}
    ]'::jsonb
    when 'marketing' then '[
      {"key":"brief","name":"Brief","category":"todo","color":"#64748B","initial":true,"progress":0},
      {"key":"creative","name":"Creative","category":"in_progress","color":"#2563EB","progress":30},
      {"key":"client_review","name":"Client Review","category":"review","color":"#7C3AED","progress":70},
      {"key":"scheduled","name":"Scheduled","category":"in_progress","color":"#0EA5E9","progress":90},
      {"key":"published","name":"Published","category":"done","color":"#059669","final":true,"progress":100},
      {"key":"on_hold","name":"On Hold","category":"blocked","color":"#DC2626"}
    ]'::jsonb
    when 'education' then '[
      {"key":"planned","name":"Planned","category":"todo","color":"#64748B","initial":true,"progress":0},
      {"key":"in_progress","name":"In Progress","category":"in_progress","color":"#2563EB","progress":40},
      {"key":"grading","name":"Grading","category":"review","color":"#7C3AED","progress":80},
      {"key":"completed","name":"Completed","category":"done","color":"#059669","final":true,"progress":100},
      {"key":"on_hold","name":"On Hold","category":"blocked","color":"#DC2626"}
    ]'::jsonb
    when 'it_services' then '[
      {"key":"todo","name":"To Do","category":"todo","color":"#64748B","initial":true,"progress":0},
      {"key":"in_progress","name":"In Progress","category":"in_progress","color":"#2563EB","progress":30},
      {"key":"review","name":"Code Review","category":"review","color":"#7C3AED","progress":70},
      {"key":"testing","name":"Testing","category":"review","color":"#D97706","progress":85},
      {"key":"done","name":"Done","category":"done","color":"#059669","final":true,"progress":100},
      {"key":"blocked","name":"Blocked","category":"blocked","color":"#DC2626"}
    ]'::jsonb
    else '[
      {"key":"todo","name":"To Do","category":"todo","color":"#64748B","initial":true,"progress":0},
      {"key":"in_progress","name":"In Progress","category":"in_progress","color":"#2563EB","progress":30},
      {"key":"review","name":"Review","category":"review","color":"#7C3AED","progress":70},
      {"key":"done","name":"Done","category":"done","color":"#059669","final":true,"progress":100},
      {"key":"blocked","name":"Blocked","category":"blocked","color":"#DC2626"}
    ]'::jsonb
  end;

  for v_item in select * from jsonb_array_elements(v_statuses) loop
    insert into public.workflow_statuses (
      organization_id, workflow_id, key, name, category, color, position,
      is_initial, is_final, auto_progress
    ) values (
      p_org, v_workflow,
      v_item ->> 'key', v_item ->> 'name',
      (v_item ->> 'category')::public.status_category,
      coalesce(v_item ->> 'color', '#64748B'),
      v_idx,
      coalesce((v_item ->> 'initial')::boolean, false),
      coalesce((v_item ->> 'final')::boolean, false),
      (v_item ->> 'progress')::smallint
    );
    v_idx := v_idx + 1;
  end loop;

  return v_workflow;
end;
$$;

/*
  Tenant bootstrap: organization + settings + default workspace + workflow +
  owner membership. One call — no partially-created tenants.
*/
create or replace function public.bootstrap_organization(
  p_name text,
  p_slug text,
  p_owner uuid,
  p_industry_key text default 'general'
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_org       uuid;
  v_workspace uuid;
  v_industry  uuid;
  v_owner_role uuid;
  v_slug      text;
  v_suffix    int := 1;
begin
  -- This function is SECURITY DEFINER, so it must police its own caller:
  -- an authenticated user may only create an organization for THEMSELVES.
  -- auth.uid() IS NULL means the service role or a migration, which may act freely.
  if p_owner is null then
    p_owner := auth.uid();
  end if;
  if auth.uid() is not null and p_owner <> auth.uid() then
    raise exception 'Cannot create an organization on behalf of another user'
      using errcode = 'insufficient_privilege';
  end if;
  if p_owner is null then
    raise exception 'An owner is required' using errcode = 'null_value_not_allowed';
  end if;

  select id into v_industry from public.industries where key = p_industry_key;

  -- Guarantee a unique slug here: the caller cannot check availability itself,
  -- because RLS hides organizations they do not belong to.
  v_slug := p_slug;
  while exists (select 1 from public.organizations where slug = v_slug) loop
    v_suffix := v_suffix + 1;
    v_slug := p_slug || '-' || v_suffix;
  end loop;

  insert into public.organizations (name, slug, industry_id, created_by, updated_by)
  values (p_name, v_slug, v_industry, p_owner, p_owner)
  returning id into v_org;

  insert into public.organization_settings (organization_id, created_by, updated_by)
  values (v_org, p_owner, p_owner);

  insert into public.workspaces (organization_id, name, slug, is_default, created_by, updated_by)
  values (v_org, 'General', 'general', true, p_owner, p_owner)
  returning id into v_workspace;

  perform public.create_default_task_workflow(v_org, v_workspace, p_industry_key);

  select id into v_owner_role
    from public.roles
   where organization_id is null and key = 'org_owner' and scope = 'organization';

  insert into public.organization_members (
    organization_id, user_id, role_id, member_type, status, joined_at, created_by, updated_by
  ) values (v_org, p_owner, v_owner_role, 'member', 'active', now(), p_owner, p_owner);

  insert into public.workspace_members (organization_id, workspace_id, user_id, role_id, created_by, updated_by)
  select v_org, v_workspace, p_owner,
         (select id from public.roles where organization_id is null and key = 'ws_admin'),
         p_owner, p_owner;

  return v_org;
end;
$$;

/*
  Instantiate a project template. Date offsets become real dates; template
  tasks become real tasks; parent/child structure is preserved via a two-pass
  insert (children can reference parents created in the same call).
*/
create or replace function public.instantiate_project_template(
  p_template  uuid,
  p_org       uuid,
  p_workspace uuid,
  p_name      text,
  p_start     date default current_date,
  p_owner     uuid default null,
  p_account   uuid default null
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_project   uuid;
  v_workflow  uuid;
  v_initial   uuid;
  v_tpl       record;
  v_map       jsonb := '{}'::jsonb;
  v_new_task  uuid;
  v_duration  int;
begin
  select coalesce(default_workflow_id,
           (select id from public.workflows
             where organization_id = p_org and entity = 'task'
               and is_default and deleted_at is null limit 1)),
         default_duration_days
    into v_workflow, v_duration
  from public.project_templates where id = p_template;

  select id into v_initial
    from public.workflow_statuses
   where workflow_id = v_workflow and is_initial and deleted_at is null
   limit 1;

  insert into public.projects (
    organization_id, workspace_id, account_id, template_id, workflow_id,
    name, owner_id, start_date, end_date, created_by, updated_by
  ) values (
    p_org, p_workspace, p_account, p_template, v_workflow,
    p_name, p_owner, p_start,
    case when v_duration is not null then p_start + v_duration else null end,
    p_owner, p_owner
  ) returning id into v_project;

  -- pass 1: create tasks
  for v_tpl in
    select * from public.project_template_tasks
     where template_id = p_template order by position, created_at
  loop
    insert into public.tasks (
      organization_id, project_id, workflow_id, status_id, title, description,
      priority, start_date, due_date, estimated_hours, position, created_by, updated_by
    ) values (
      p_org, v_project, v_workflow, v_initial, v_tpl.title, v_tpl.description,
      v_tpl.priority,
      p_start + v_tpl.start_offset_days,
      p_start + v_tpl.start_offset_days + greatest(v_tpl.duration_days - 1, 0),
      v_tpl.estimated_hours, v_tpl.position, p_owner, p_owner
    ) returning id into v_new_task;

    v_map := v_map || jsonb_build_object(v_tpl.id::text, v_new_task::text);

    -- checklist items defined on the template
    insert into public.task_checklist_items (organization_id, task_id, content, position, created_by, updated_by)
    select p_org, v_new_task, item ->> 'content', (ord - 1)::double precision, p_owner, p_owner
      from jsonb_array_elements(v_tpl.checklist) with ordinality as t(item, ord)
     where v_tpl.checklist is not null and jsonb_typeof(v_tpl.checklist) = 'array';
  end loop;

  -- pass 2: wire parent/child relationships
  for v_tpl in
    select * from public.project_template_tasks
     where template_id = p_template and parent_id is not null
  loop
    update public.tasks
       set parent_id = (v_map ->> v_tpl.parent_id::text)::uuid
     where id = (v_map ->> v_tpl.id::text)::uuid;
  end loop;

  perform public.recompute_project_progress(v_project);
  return v_project;
end;
$$;

-- Soft delete a project and everything beneath it, in one auditable call.
create or replace function public.soft_delete_project(p_project uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare v_actor uuid := auth.uid();
begin
  update public.tasks                set deleted_at = now(), deleted_by = v_actor
   where project_id = p_project and deleted_at is null;
  update public.milestones           set deleted_at = now(), deleted_by = v_actor
   where project_id = p_project and deleted_at is null;
  update public.project_members      set deleted_at = now(), deleted_by = v_actor
   where project_id = p_project and deleted_at is null;
  update public.comments             set deleted_at = now(), deleted_by = v_actor
   where project_id = p_project and deleted_at is null;
  update public.attachments          set deleted_at = now(), deleted_by = v_actor
   where project_id = p_project and deleted_at is null;
  update public.projects             set deleted_at = now(), deleted_by = v_actor
   where id = p_project and deleted_at is null;
end;
$$;

-- Deadline notifications — schedule daily via pg_cron.
create or replace function public.generate_deadline_notifications()
returns void language plpgsql security definer set search_path = public
as $$
begin
  insert into public.notifications (organization_id, user_id, type, title, body, entity, entity_id)
  select t.organization_id, t.assignee_id, 'deadline_today', 'Task due today', t.title, 'task', t.id
    from public.tasks t
    join public.workflow_statuses ws on ws.id = t.status_id
   where t.assignee_id is not null
     and t.deleted_at is null
     and t.due_date = current_date
     and ws.category not in ('done', 'cancelled')
     and not exists (
       select 1 from public.notifications n
        where n.user_id = t.assignee_id and n.entity_id = t.id
          and n.type = 'deadline_today' and n.created_at::date = current_date);

  insert into public.notifications (organization_id, user_id, type, title, body, entity, entity_id)
  select t.organization_id, t.assignee_id, 'deadline_tomorrow', 'Task due tomorrow', t.title, 'task', t.id
    from public.tasks t
    join public.workflow_statuses ws on ws.id = t.status_id
   where t.assignee_id is not null
     and t.deleted_at is null
     and t.due_date = current_date + 1
     and ws.category not in ('done', 'cancelled')
     and not exists (
       select 1 from public.notifications n
        where n.user_id = t.assignee_id and n.entity_id = t.id
          and n.type = 'deadline_tomorrow' and n.created_at::date = current_date);
end;
$$;
