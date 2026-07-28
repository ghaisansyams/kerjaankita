-- ============================================================================
-- 0019 · Workflow column management RPCs
--
-- Column CRUD is exposed as SECURITY DEFINER functions that each assert the
-- caller holds `workflow.manage` for the workflow's organization, then enforce
-- the sprint's invariants in one transaction:
--   • at least one column always remains
--   • one default (is_initial) column, one completed (is_final) column
--   • unique column names per workflow
--   • deleting a column never deletes tasks — they are reassigned first
-- Task reassignment on delete goes through the normal task triggers, so the
-- destination column's progress weight (auto_progress) is applied and project
-- progress recomputes automatically.
-- ============================================================================

create or replace function public.assert_can_manage_workflow(p_workflow uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  select organization_id into v_org from public.workflows where id = p_workflow and deleted_at is null;
  if v_org is null then
    raise exception 'Workflow not found' using errcode = 'no_data_found';
  end if;
  if not public.has_permission(v_org, 'workflow.manage') then
    raise exception 'You do not have permission to manage this board''s columns'
      using errcode = 'insufficient_privilege';
  end if;
  return v_org;
end; $$;

-- CREATE ---------------------------------------------------------------------
create or replace function public.create_workflow_column(
  p_workflow uuid, p_name text, p_color text default '#64748B', p_weight int default 0
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_pos int; v_key text; v_base text; v_n int := 1; v_id uuid;
begin
  v_org := public.assert_can_manage_workflow(p_workflow);
  p_name := btrim(coalesce(p_name, ''));
  if p_name = '' then raise exception 'Column name is required' using errcode = 'check_violation'; end if;
  if char_length(p_name) > 40 then raise exception 'Column name is too long' using errcode = 'check_violation'; end if;
  if exists (select 1 from public.workflow_statuses
             where workflow_id = p_workflow and deleted_at is null and lower(name) = lower(p_name)) then
    raise exception 'A column named "%" already exists', p_name using errcode = 'unique_violation';
  end if;

  select coalesce(max(position), -1) + 1 into v_pos
    from public.workflow_statuses where workflow_id = p_workflow and deleted_at is null;

  v_base := btrim(regexp_replace(lower(p_name), '[^a-z0-9]+', '_', 'g'), '_');
  if v_base = '' then v_base := 'col'; end if;
  v_key := v_base;
  while exists (select 1 from public.workflow_statuses where workflow_id = p_workflow and key = v_key) loop
    v_n := v_n + 1; v_key := v_base || '_' || v_n;
  end loop;

  insert into public.workflow_statuses
    (organization_id, workflow_id, key, name, category, color, position,
     is_initial, is_final, auto_progress, created_by)
  values
    (v_org, p_workflow, v_key, p_name, 'in_progress', coalesce(p_color, '#64748B'), v_pos,
     false, false, greatest(0, least(100, coalesce(p_weight, 0))), auth.uid())
  returning id into v_id;
  return v_id;
end; $$;

-- UPDATE (rename / recolor / reweight) ---------------------------------------
create or replace function public.update_workflow_column(
  p_status uuid, p_name text, p_color text, p_weight int
) returns void language plpgsql security definer set search_path = public as $$
declare v_wf uuid;
begin
  select workflow_id into v_wf from public.workflow_statuses where id = p_status and deleted_at is null;
  if v_wf is null then raise exception 'Column not found' using errcode = 'no_data_found'; end if;
  perform public.assert_can_manage_workflow(v_wf);

  if p_name is not null then
    p_name := btrim(p_name);
    if p_name = '' then raise exception 'Column name is required' using errcode = 'check_violation'; end if;
    if char_length(p_name) > 40 then raise exception 'Column name is too long' using errcode = 'check_violation'; end if;
    if exists (select 1 from public.workflow_statuses
               where workflow_id = v_wf and id <> p_status and deleted_at is null and lower(name) = lower(p_name)) then
      raise exception 'A column named "%" already exists', p_name using errcode = 'unique_violation';
    end if;
  end if;

  update public.workflow_statuses
     set name = coalesce(p_name, name),
         color = coalesce(p_color, color),
         auto_progress = case when p_weight is null then auto_progress else greatest(0, least(100, p_weight)) end,
         updated_at = now(), updated_by = auth.uid()
   where id = p_status;
end; $$;

-- REORDER --------------------------------------------------------------------
create or replace function public.reorder_workflow_columns(
  p_workflow uuid, p_ids uuid[]
) returns void language plpgsql security definer set search_path = public as $$
declare i int;
begin
  perform public.assert_can_manage_workflow(p_workflow);
  for i in 1 .. array_length(p_ids, 1) loop
    update public.workflow_statuses
       set position = i - 1, updated_at = now(), updated_by = auth.uid()
     where id = p_ids[i] and workflow_id = p_workflow and deleted_at is null;
  end loop;
end; $$;

-- DELETE (reassign tasks, never delete them) ---------------------------------
create or replace function public.delete_workflow_column(
  p_status uuid, p_reassign_to uuid
) returns void language plpgsql security definer set search_path = public as $$
declare v_wf uuid; v_remaining int; v_tasks int;
begin
  select workflow_id into v_wf from public.workflow_statuses where id = p_status and deleted_at is null;
  if v_wf is null then raise exception 'Column not found' using errcode = 'no_data_found'; end if;
  perform public.assert_can_manage_workflow(v_wf);

  select count(*) into v_remaining from public.workflow_statuses where workflow_id = v_wf and deleted_at is null;
  if v_remaining <= 1 then
    raise exception 'A board must keep at least one column' using errcode = 'check_violation';
  end if;

  select count(*) into v_tasks from public.tasks where status_id = p_status and deleted_at is null;
  if v_tasks > 0 then
    if p_reassign_to is null then
      raise exception 'Choose a column to move the tasks into' using errcode = 'check_violation';
    end if;
    if p_reassign_to = p_status
       or not exists (select 1 from public.workflow_statuses
                      where id = p_reassign_to and workflow_id = v_wf and deleted_at is null) then
      raise exception 'Pick a valid destination column' using errcode = 'check_violation';
    end if;
    update public.tasks set status_id = p_reassign_to where status_id = p_status and deleted_at is null;
  end if;

  update public.workflow_statuses
     set deleted_at = now(), deleted_by = auth.uid()
   where id = p_status;
end; $$;

-- SET DEFAULT (single is_initial) --------------------------------------------
create or replace function public.set_default_workflow_column(p_status uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_wf uuid;
begin
  select workflow_id into v_wf from public.workflow_statuses where id = p_status and deleted_at is null;
  if v_wf is null then raise exception 'Column not found' using errcode = 'no_data_found'; end if;
  perform public.assert_can_manage_workflow(v_wf);
  update public.workflow_statuses set is_initial = false, updated_by = auth.uid()
   where workflow_id = v_wf and is_initial and id <> p_status;
  update public.workflow_statuses set is_initial = true, updated_at = now(), updated_by = auth.uid()
   where id = p_status;
end; $$;

-- SET COMPLETED (single is_final; toggles category done ↔ in_progress) --------
create or replace function public.set_completed_workflow_column(p_status uuid, p_completed boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_wf uuid;
begin
  select workflow_id into v_wf from public.workflow_statuses where id = p_status and deleted_at is null;
  if v_wf is null then raise exception 'Column not found' using errcode = 'no_data_found'; end if;
  perform public.assert_can_manage_workflow(v_wf);

  if p_completed then
    -- demote any current completed column back to a normal in-progress column
    update public.workflow_statuses
       set is_final = false, category = 'in_progress', updated_by = auth.uid()
     where workflow_id = v_wf and id <> p_status and (is_final or category = 'done');
    update public.workflow_statuses
       set is_final = true, category = 'done', auto_progress = 100, updated_at = now(), updated_by = auth.uid()
     where id = p_status;
  else
    update public.workflow_statuses
       set is_final = false, category = 'in_progress', updated_at = now(), updated_by = auth.uid()
     where id = p_status;
  end if;
end; $$;

grant execute on function
  public.create_workflow_column(uuid, text, text, int),
  public.update_workflow_column(uuid, text, text, int),
  public.reorder_workflow_columns(uuid, uuid[]),
  public.delete_workflow_column(uuid, uuid),
  public.set_default_workflow_column(uuid),
  public.set_completed_workflow_column(uuid, boolean)
  to authenticated;
