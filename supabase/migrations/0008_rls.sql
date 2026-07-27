-- ============================================================================
-- 0008 · Row Level Security
--
-- Isolation model, in order of evaluation:
--   1. TENANT     — is_org_member(organization_id). Nothing crosses tenants.
--   2. SCOPE      — can_view_project() for project-bound data.
--   3. SENSITIVITY— guests never see internal comments / unshared files.
--   4. CAPABILITY — has_permission() for every write.
--
-- Soft-deleted rows (deleted_at IS NOT NULL) are invisible to the application;
-- they remain readable to the service role for restore and audit.
-- ============================================================================

-- Profile visibility helper (defined here as it is only used by policies).
create or replace function public.can_view_profile(p_user uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select
    p_user = auth.uid()
    or exists (
      -- internal members see everyone in organizations they share
      select 1
      from public.organization_members me
      join public.organization_members them
        on them.organization_id = me.organization_id
      where me.user_id = auth.uid()
        and me.status = 'active' and me.deleted_at is null
        and me.member_type = 'member'
        and them.user_id = p_user
        and them.status = 'active' and them.deleted_at is null
    )
    or exists (
      -- guests only see people working on projects they can see
      select 1
      from public.project_members pm
      join public.project_members mine on mine.project_id = pm.project_id
      where pm.user_id = p_user and pm.deleted_at is null
        and mine.user_id = auth.uid() and mine.deleted_at is null
    )
$$;

-- ----------------------------------------------------------------------------
-- Enable RLS everywhere
-- ----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'industries','profiles','organizations','organization_settings','permissions','roles',
    'role_permissions','organization_members','workspaces','workspace_members','teams',
    'team_members','invitations','workflows','workflow_statuses','workflow_transitions',
    'project_templates','project_template_tasks','task_templates','accounts','contacts',
    'projects','project_members','milestones','tasks','task_dependencies',
    'task_checklist_items','tags','taggables','comments','attachments','activities',
    'notifications','custom_field_definitions','custom_field_values','automation_rules',
    'automation_runs'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end;
$$;

-- ----------------------------------------------------------------------------
-- System reference data — readable by any authenticated user, writable by none
-- ----------------------------------------------------------------------------
create policy industries_read on public.industries for select
  using (auth.uid() is not null);
create policy permissions_read on public.permissions for select
  using (auth.uid() is not null);

-- System roles (organization_id IS NULL) are readable by everyone; tenant roles
-- only by that tenant's members.
create policy roles_read on public.roles for select
  using (organization_id is null or public.is_org_member(organization_id));
create policy roles_write on public.roles for all
  using (organization_id is not null
         and public.has_permission(organization_id, 'organization.role.manage'))
  with check (organization_id is not null
         and public.has_permission(organization_id, 'organization.role.manage'));

create policy role_permissions_read on public.role_permissions for select
  using (auth.uid() is not null);
create policy role_permissions_write on public.role_permissions for all
  using (exists (select 1 from public.roles r
                 where r.id = role_id and r.organization_id is not null
                   and public.has_permission(r.organization_id, 'organization.role.manage')))
  with check (exists (select 1 from public.roles r
                 where r.id = role_id and r.organization_id is not null
                   and public.has_permission(r.organization_id, 'organization.role.manage')));

-- ----------------------------------------------------------------------------
-- Profiles
-- ----------------------------------------------------------------------------
create policy profiles_read on public.profiles for select
  using (deleted_at is null and public.can_view_profile(id));
create policy profiles_update_self on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- ----------------------------------------------------------------------------
-- Organizations & settings
-- ----------------------------------------------------------------------------
create policy organizations_read on public.organizations for select
  using (deleted_at is null and public.is_org_member(id));
create policy organizations_insert on public.organizations for insert
  with check (auth.uid() is not null);   -- anyone may found an organization
create policy organizations_update on public.organizations for update
  using (public.has_permission(id, 'organization.update'))
  with check (public.has_permission(id, 'organization.update'));

create policy org_settings_read on public.organization_settings for select
  using (public.is_org_member(organization_id));
create policy org_settings_write on public.organization_settings for all
  using (public.has_permission(organization_id, 'organization.settings.update'))
  with check (public.has_permission(organization_id, 'organization.settings.update'));

-- ----------------------------------------------------------------------------
-- Membership
-- ----------------------------------------------------------------------------
create policy org_members_read on public.organization_members for select
  using (deleted_at is null and public.is_org_member(organization_id));
create policy org_members_write on public.organization_members for all
  using (public.has_permission(organization_id, 'organization.member.manage'))
  with check (public.has_permission(organization_id, 'organization.member.manage'));

create policy workspaces_read on public.workspaces for select
  using (deleted_at is null and public.is_org_member(organization_id));
create policy workspaces_insert on public.workspaces for insert
  with check (public.has_permission(organization_id, 'workspace.create'));
create policy workspaces_update on public.workspaces for update
  using (public.has_permission(organization_id, 'workspace.update', id))
  with check (public.has_permission(organization_id, 'workspace.update', id));
create policy workspaces_delete on public.workspaces for delete
  using (public.has_permission(organization_id, 'workspace.delete', id));

create policy workspace_members_read on public.workspace_members for select
  using (deleted_at is null and public.is_org_member(organization_id));
create policy workspace_members_write on public.workspace_members for all
  using (public.has_permission(organization_id, 'workspace.member.manage', workspace_id))
  with check (public.has_permission(organization_id, 'workspace.member.manage', workspace_id));

create policy teams_read on public.teams for select
  using (deleted_at is null and public.is_org_member(organization_id));
create policy teams_write on public.teams for all
  using (public.has_permission(organization_id, 'team.manage'))
  with check (public.has_permission(organization_id, 'team.manage'));

create policy team_members_read on public.team_members for select
  using (deleted_at is null and public.is_org_member(organization_id));
create policy team_members_write on public.team_members for all
  using (public.has_permission(organization_id, 'team.manage'))
  with check (public.has_permission(organization_id, 'team.manage'));

create policy invitations_read on public.invitations for select
  using (public.has_permission(organization_id, 'invitation.manage'));
create policy invitations_write on public.invitations for all
  using (public.has_permission(organization_id, 'invitation.manage'))
  with check (public.has_permission(organization_id, 'invitation.manage'));

-- ----------------------------------------------------------------------------
-- Workflows (tenant-configurable)
-- ----------------------------------------------------------------------------
create policy workflows_read on public.workflows for select
  using (deleted_at is null and public.is_org_member(organization_id));
create policy workflows_write on public.workflows for all
  using (public.has_permission(organization_id, 'workflow.manage'))
  with check (public.has_permission(organization_id, 'workflow.manage'));

create policy workflow_statuses_read on public.workflow_statuses for select
  using (deleted_at is null and public.is_org_member(organization_id));
create policy workflow_statuses_write on public.workflow_statuses for all
  using (public.has_permission(organization_id, 'workflow.manage'))
  with check (public.has_permission(organization_id, 'workflow.manage'));

create policy workflow_transitions_read on public.workflow_transitions for select
  using (deleted_at is null and public.is_org_member(organization_id));
create policy workflow_transitions_write on public.workflow_transitions for all
  using (public.has_permission(organization_id, 'workflow.manage'))
  with check (public.has_permission(organization_id, 'workflow.manage'));

-- ----------------------------------------------------------------------------
-- Templates (system templates readable by all)
-- ----------------------------------------------------------------------------
create policy project_templates_read on public.project_templates for select
  using (deleted_at is null
         and (organization_id is null or public.is_org_member(organization_id)));
create policy project_templates_write on public.project_templates for all
  using (organization_id is not null and public.has_permission(organization_id, 'template.manage'))
  with check (organization_id is not null and public.has_permission(organization_id, 'template.manage'));

create policy template_tasks_read on public.project_template_tasks for select
  using (exists (select 1 from public.project_templates pt
                 where pt.id = template_id
                   and (pt.organization_id is null or public.is_org_member(pt.organization_id))));
create policy template_tasks_write on public.project_template_tasks for all
  using (exists (select 1 from public.project_templates pt
                 where pt.id = template_id and pt.organization_id is not null
                   and public.has_permission(pt.organization_id, 'template.manage')))
  with check (exists (select 1 from public.project_templates pt
                 where pt.id = template_id and pt.organization_id is not null
                   and public.has_permission(pt.organization_id, 'template.manage')));

create policy task_templates_read on public.task_templates for select
  using (deleted_at is null
         and (organization_id is null or public.is_org_member(organization_id)));
create policy task_templates_write on public.task_templates for all
  using (organization_id is not null and public.has_permission(organization_id, 'template.manage'))
  with check (organization_id is not null and public.has_permission(organization_id, 'template.manage'));

-- ----------------------------------------------------------------------------
-- Accounts & contacts — guests only ever see their own account
-- ----------------------------------------------------------------------------
create policy accounts_read on public.accounts for select
  using (deleted_at is null and public.is_org_member(organization_id)
         and (not public.is_org_guest(organization_id)
              or id in (select account_id from public.organization_members
                        where user_id = auth.uid() and account_id is not null)));
create policy accounts_write on public.accounts for all
  using (public.has_permission(organization_id, 'account.manage'))
  with check (public.has_permission(organization_id, 'account.manage'));

create policy contacts_read on public.contacts for select
  using (deleted_at is null and public.is_org_member(organization_id)
         and not public.is_org_guest(organization_id));
create policy contacts_write on public.contacts for all
  using (public.has_permission(organization_id, 'account.manage'))
  with check (public.has_permission(organization_id, 'account.manage'));

-- ----------------------------------------------------------------------------
-- Projects and project-scoped data
-- ----------------------------------------------------------------------------
create policy projects_read on public.projects for select
  using (deleted_at is null and public.can_view_project(id));
create policy projects_insert on public.projects for insert
  with check (public.has_permission(organization_id, 'project.create', workspace_id));
create policy projects_update on public.projects for update
  using (public.has_permission(organization_id, 'project.update', workspace_id, id))
  with check (public.has_permission(organization_id, 'project.update', workspace_id, id));
create policy projects_delete on public.projects for delete
  using (public.has_permission(organization_id, 'project.delete', workspace_id, id));

create policy project_members_read on public.project_members for select
  using (deleted_at is null and public.can_view_project(project_id));
create policy project_members_write on public.project_members for all
  using (public.has_permission(organization_id, 'project.member.manage', null, project_id))
  with check (public.has_permission(organization_id, 'project.member.manage', null, project_id));

create policy milestones_read on public.milestones for select
  using (deleted_at is null and public.can_view_project(project_id));
create policy milestones_write on public.milestones for all
  using (public.has_permission(organization_id, 'milestone.manage', null, project_id))
  with check (public.has_permission(organization_id, 'milestone.manage', null, project_id));

-- ----------------------------------------------------------------------------
-- Tasks — assignees may edit their own; managers may edit any
-- ----------------------------------------------------------------------------
create policy tasks_read on public.tasks for select
  using (deleted_at is null and public.can_view_project(project_id));
create policy tasks_insert on public.tasks for insert
  with check (public.has_permission(organization_id, 'task.create', null, project_id));
create policy tasks_update on public.tasks for update
  using (
    public.has_permission(organization_id, 'task.update.any', null, project_id)
    or (assignee_id = auth.uid()
        and public.has_permission(organization_id, 'task.update.own', null, project_id))
  )
  with check (
    public.has_permission(organization_id, 'task.update.any', null, project_id)
    or (assignee_id = auth.uid()
        and public.has_permission(organization_id, 'task.update.own', null, project_id))
  );
create policy tasks_delete on public.tasks for delete
  using (public.has_permission(organization_id, 'task.delete', null, project_id));

create policy task_deps_read on public.task_dependencies for select
  using (public.is_org_member(organization_id));
create policy task_deps_write on public.task_dependencies for all
  using (public.has_permission(organization_id, 'task.update.any'))
  with check (public.has_permission(organization_id, 'task.update.any'));

create policy checklist_read on public.task_checklist_items for select
  using (deleted_at is null and public.can_view_task(task_id));
create policy checklist_write on public.task_checklist_items for all
  using (public.can_edit_task(task_id))
  with check (public.can_edit_task(task_id));

-- ----------------------------------------------------------------------------
-- Tags
-- ----------------------------------------------------------------------------
create policy tags_read on public.tags for select
  using (deleted_at is null and public.is_org_member(organization_id));
create policy tags_write on public.tags for all
  using (public.has_permission(organization_id, 'tag.manage'))
  with check (public.has_permission(organization_id, 'tag.manage'));

create policy taggables_read on public.taggables for select
  using (public.is_org_member(organization_id));
create policy taggables_write on public.taggables for all
  using (public.has_permission(organization_id, 'tag.manage'))
  with check (public.has_permission(organization_id, 'tag.manage'));

-- ----------------------------------------------------------------------------
-- Comments — internal comments are invisible to guests, full stop
-- ----------------------------------------------------------------------------
create policy comments_read on public.comments for select
  using (
    deleted_at is null
    and public.is_org_member(organization_id)
    and (project_id is null or public.can_view_project(project_id))
    and (not is_internal or public.can_see_internal(organization_id))
  );
create policy comments_insert on public.comments for insert
  with check (
    author_id = auth.uid()
    and public.has_permission(organization_id, 'comment.create', null, project_id)
  );
create policy comments_update on public.comments for update
  using (author_id = auth.uid())
  with check (author_id = auth.uid());
create policy comments_delete on public.comments for delete
  using (author_id = auth.uid()
         or public.has_permission(organization_id, 'comment.moderate', null, project_id));

-- ----------------------------------------------------------------------------
-- Attachments — guests only see explicitly shared files
-- ----------------------------------------------------------------------------
create policy attachments_read on public.attachments for select
  using (
    deleted_at is null
    and public.is_org_member(organization_id)
    and (project_id is null or public.can_view_project(project_id))
    and (is_guest_visible or public.can_see_internal(organization_id))
  );
create policy attachments_insert on public.attachments for insert
  with check (public.has_permission(organization_id, 'attachment.upload', null, project_id));
create policy attachments_update on public.attachments for update
  using (uploaded_by = auth.uid()
         or public.has_permission(organization_id, 'attachment.manage', null, project_id))
  with check (uploaded_by = auth.uid()
         or public.has_permission(organization_id, 'attachment.manage', null, project_id));
create policy attachments_delete on public.attachments for delete
  using (uploaded_by = auth.uid()
         or public.has_permission(organization_id, 'attachment.manage', null, project_id));

-- ----------------------------------------------------------------------------
-- Activities — append-only; guests see only the guest-visible subset
-- ----------------------------------------------------------------------------
create policy activities_read on public.activities for select
  using (
    public.is_org_member(organization_id)
    and (project_id is null or public.can_view_project(project_id))
    and (is_guest_visible or public.can_see_internal(organization_id))
  );
-- No INSERT/UPDATE/DELETE policies: only SECURITY DEFINER triggers write here.

-- ----------------------------------------------------------------------------
-- Notifications — strictly personal
-- ----------------------------------------------------------------------------
create policy notifications_read on public.notifications for select
  using (user_id = auth.uid());
create policy notifications_update on public.notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_delete on public.notifications for delete
  using (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- Custom fields
-- ----------------------------------------------------------------------------
create policy cfd_read on public.custom_field_definitions for select
  using (deleted_at is null and public.is_org_member(organization_id)
         and (is_guest_visible or public.can_see_internal(organization_id)));
create policy cfd_write on public.custom_field_definitions for all
  using (public.has_permission(organization_id, 'customfield.manage'))
  with check (public.has_permission(organization_id, 'customfield.manage'));

create policy cfv_read on public.custom_field_values for select
  using (public.is_org_member(organization_id)
         and (project_id is null or public.can_view_project(project_id)));
create policy cfv_write on public.custom_field_values for all
  using (public.is_org_member(organization_id)
         and (project_id is null or public.can_view_project(project_id))
         and not public.is_org_guest(organization_id))
  with check (public.is_org_member(organization_id)
         and (project_id is null or public.can_view_project(project_id))
         and not public.is_org_guest(organization_id));

-- ----------------------------------------------------------------------------
-- Automation
-- ----------------------------------------------------------------------------
create policy automation_rules_read on public.automation_rules for select
  using (deleted_at is null and public.is_org_member(organization_id)
         and public.can_see_internal(organization_id));
create policy automation_rules_write on public.automation_rules for all
  using (public.has_permission(organization_id, 'automation.manage'))
  with check (public.has_permission(organization_id, 'automation.manage'));

create policy automation_runs_read on public.automation_runs for select
  using (public.has_permission(organization_id, 'automation.manage'));

-- ----------------------------------------------------------------------------
-- Grants — privileges gate access, RLS then restricts rows. Both are required.
-- ----------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
