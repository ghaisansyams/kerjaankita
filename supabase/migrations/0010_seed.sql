-- ============================================================================
-- 0010 · Seed data
--
-- SYSTEM reference data only — industries, the permission catalogue, system
-- roles and starter templates. No tenant data, no fake users, no demo projects.
-- Every row here is required for the platform to function.
--
-- Idempotent: safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Industries
-- ----------------------------------------------------------------------------
insert into public.industries (key, name, description) values
  ('general',       'General',            'Industry-neutral defaults'),
  ('it_services',   'IT Services',        'Software houses, consultancies, agencies'),
  ('marketing',     'Marketing Agency',   'Campaigns, content, creative delivery'),
  ('construction',  'Construction',       'Sites, work orders, inspections, handover'),
  ('education',     'Education',          'Courses, cohorts, assignments, grading'),
  ('healthcare',    'Healthcare',         'Cases, treatment plans, follow-ups'),
  ('manufacturing', 'Manufacturing',      'Production batches, QC, maintenance'),
  ('logistics',     'Logistics',          'Shipments, routes, fleet operations'),
  ('property',      'Property',           'Developments, units, handover, maintenance'),
  ('government',    'Government',         'Programmes, public works, compliance'),
  ('startup',       'Startup',            'Product squads, roadmap, iteration')
on conflict (key) do nothing;

-- ----------------------------------------------------------------------------
-- Permission catalogue
-- ----------------------------------------------------------------------------
insert into public.permissions (key, category, name, description) values
  -- organization
  ('organization.update',          'organization', 'Update organization',      'Edit organization profile'),
  ('organization.delete',          'organization', 'Delete organization',      'Permanently remove the organization'),
  ('organization.settings.update', 'organization', 'Manage settings',          'Edit settings, terminology, business rules'),
  ('organization.member.manage',   'organization', 'Manage members',           'Add, remove and change member roles'),
  ('organization.role.manage',     'organization', 'Manage roles',             'Create and edit custom roles'),
  ('invitation.manage',            'organization', 'Manage invitations',       'Invite and revoke invitations'),
  -- workspace
  ('workspace.create',             'workspace',    'Create workspace',         null),
  ('workspace.update',             'workspace',    'Update workspace',         null),
  ('workspace.delete',             'workspace',    'Delete workspace',         null),
  ('workspace.member.manage',      'workspace',    'Manage workspace members', null),
  -- team
  ('team.manage',                  'team',         'Manage teams',             'Create teams and manage membership'),
  -- accounts (clients/customers/patients/…)
  ('account.manage',               'account',      'Manage accounts',          'Create and edit accounts and contacts'),
  -- project
  ('project.create',               'project',      'Create project',           null),
  ('project.update',               'project',      'Update project',           null),
  ('project.delete',               'project',      'Delete project',           null),
  ('project.member.manage',        'project',      'Manage project members',   null),
  ('project.view.all',             'project',      'View all projects',        'See every project regardless of membership'),
  ('milestone.manage',             'project',      'Manage milestones',        null),
  -- task
  ('task.create',                  'task',         'Create task',              null),
  ('task.update.any',              'task',         'Update any task',          'Edit any task, including transitions'),
  ('task.update.own',              'task',         'Update assigned task',     'Edit only tasks assigned to you'),
  ('task.delete',                  'task',         'Delete task',              null),
  ('task.assign',                  'task',         'Assign task',              null),
  -- collaboration
  ('comment.create',               'comment',      'Comment',                  null),
  ('comment.moderate',             'comment',      'Moderate comments',        'Delete anyone''s comment'),
  ('attachment.upload',            'attachment',   'Upload files',             null),
  ('attachment.manage',            'attachment',   'Manage files',             'Delete or edit any file'),
  ('attachment.share_guest',       'attachment',   'Share files with guests',  'Expose a file in the guest portal'),
  -- configuration
  ('workflow.manage',              'config',       'Manage workflows',         'Define statuses and transitions'),
  ('customfield.manage',           'config',       'Manage custom fields',     null),
  ('template.manage',              'config',       'Manage templates',         null),
  ('automation.manage',            'config',       'Manage automation',        null),
  ('tag.manage',                   'config',       'Manage tags',              null),
  -- reporting
  ('report.view',                  'reporting',    'View reports',             null),
  ('report.export',                'reporting',    'Export reports',           null)
on conflict (key) do nothing;

-- ----------------------------------------------------------------------------
-- System roles (organization_id IS NULL — shared by every tenant).
-- Tenants may additionally define their own roles at any scope.
-- ----------------------------------------------------------------------------
insert into public.roles (organization_id, key, name, description, scope, is_system, is_default, rank) values
  (null, 'org_owner',        'Owner',            'Full control of the organization',            'organization', true, false,  0),
  (null, 'org_admin',        'Admin',            'Administers the organization',                'organization', true, false, 10),
  (null, 'org_manager',      'Manager',          'Runs projects, accounts and reporting',       'organization', true, false, 20),
  (null, 'org_member',       'Member',           'Standard internal contributor',               'organization', true, true,  30),
  (null, 'org_guest',        'Guest',            'External collaborator — read-only',           'organization', true, false, 90),
  (null, 'ws_admin',         'Workspace Admin',  'Administers a workspace',                     'workspace',    true, false, 10),
  (null, 'ws_member',        'Workspace Member', 'Works inside a workspace',                    'workspace',    true, true,  30),
  (null, 'proj_lead',        'Project Lead',     'Leads delivery of a project',                 'project',      true, false, 10),
  (null, 'proj_contributor', 'Contributor',      'Delivers assigned work',                      'project',      true, true,  30),
  (null, 'proj_reviewer',    'Reviewer / QA',    'Reviews and approves work',                   'project',      true, false, 20),
  (null, 'proj_viewer',      'Viewer',           'Read-only access to a project',               'project',      true, false, 80)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Role → permission grants
-- ---------------------------------------------------------------------------

-- Owner: everything
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
  from public.roles r cross join public.permissions p
 where r.organization_id is null and r.key = 'org_owner'
on conflict do nothing;

-- Admin: everything except deleting the organization
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
  from public.roles r cross join public.permissions p
 where r.organization_id is null and r.key = 'org_admin'
   and p.key <> 'organization.delete'
on conflict do nothing;

-- Manager: delivery + reporting, no organization administration
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
  from public.roles r cross join public.permissions p
 where r.organization_id is null and r.key = 'org_manager'
   and p.key in (
     'workspace.create','workspace.update','workspace.member.manage',
     'team.manage','account.manage',
     'project.create','project.update','project.delete','project.member.manage',
     'project.view.all','milestone.manage',
     'task.create','task.update.any','task.update.own','task.delete','task.assign',
     'comment.create','comment.moderate',
     'attachment.upload','attachment.manage','attachment.share_guest',
     'workflow.manage','customfield.manage','template.manage','tag.manage',
     'report.view','report.export','invitation.manage'
   )
on conflict do nothing;

-- Member: contribute, never administer
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
  from public.roles r cross join public.permissions p
 where r.organization_id is null and r.key = 'org_member'
   and p.key in (
     'task.create','task.update.own',
     'comment.create','attachment.upload','report.view'
   )
on conflict do nothing;

-- Guest: NO write permissions at all. Read access comes solely from RLS
-- (project membership / account linkage). Intentionally left with none.

-- Workspace admin
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
  from public.roles r cross join public.permissions p
 where r.organization_id is null and r.key = 'ws_admin'
   and p.key in (
     'workspace.update','workspace.member.manage',
     'project.create','project.update','project.member.manage','project.view.all',
     'milestone.manage','task.create','task.update.any','task.assign',
     'comment.create','attachment.upload','attachment.manage','report.view'
   )
on conflict do nothing;

-- Workspace member
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
  from public.roles r cross join public.permissions p
 where r.organization_id is null and r.key = 'ws_member'
   and p.key in ('task.create','task.update.own','comment.create','attachment.upload')
on conflict do nothing;

-- Project lead
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
  from public.roles r cross join public.permissions p
 where r.organization_id is null and r.key = 'proj_lead'
   and p.key in (
     'project.update','project.member.manage','milestone.manage',
     'task.create','task.update.any','task.delete','task.assign',
     'comment.create','comment.moderate',
     'attachment.upload','attachment.manage','attachment.share_guest','report.view'
   )
on conflict do nothing;

-- Project reviewer / QA: may move any task through the workflow (approval gate)
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
  from public.roles r cross join public.permissions p
 where r.organization_id is null and r.key = 'proj_reviewer'
   and p.key in (
     'task.update.any','task.update.own','comment.create','attachment.upload'
   )
on conflict do nothing;

-- Project contributor
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
  from public.roles r cross join public.permissions p
 where r.organization_id is null and r.key = 'proj_contributor'
   and p.key in ('task.create','task.update.own','comment.create','attachment.upload')
on conflict do nothing;

-- Project viewer: read-only, no grants.

-- ----------------------------------------------------------------------------
-- Starter system project templates (organization_id IS NULL → available to all)
-- ----------------------------------------------------------------------------
insert into public.project_templates (organization_id, industry_id, name, description, default_duration_days, is_system)
select null, i.id, v.name, v.description, v.duration, true
from (values
  ('Software Delivery',      'it_services',  'Discovery → build → QA → launch', 60),
  ('Marketing Campaign',     'marketing',    'Brief → creative → approval → publish', 30),
  ('Construction Handover',  'construction', 'Site prep → build → inspection → handover', 120)
) as v(name, industry_key, description, duration)
join public.industries i on i.key = v.industry_key
where not exists (
  select 1 from public.project_templates pt
  where pt.organization_id is null and pt.name = v.name
);

insert into public.project_template_tasks (template_id, title, description, priority, position, start_offset_days, duration_days, estimated_hours)
select pt.id, v.title, v.description, v.priority::public.priority_level, v.position, v.start_offset, v.duration, v.hours
from (values
  ('Software Delivery', 'Requirements & discovery', 'Gather and document scope',       'high',   0,  0,  5, 24),
  ('Software Delivery', 'Technical design',         'Architecture and data model',      'high',   1,  5,  5, 20),
  ('Software Delivery', 'Implementation',           'Build the agreed scope',           'medium', 2, 10, 30, 160),
  ('Software Delivery', 'QA & UAT',                 'Test and fix defects',             'high',   3, 40, 10, 40),
  ('Software Delivery', 'Launch',                   'Deploy and hand over',             'critical',4, 50, 5, 16),
  ('Marketing Campaign','Campaign brief',           'Objectives, audience, budget',     'high',   0,  0,  3,  8),
  ('Marketing Campaign','Creative production',      'Copy, design, assets',             'medium', 1,  3, 12, 48),
  ('Marketing Campaign','Client approval',          'Review and sign-off',              'high',   2, 15,  5, 10),
  ('Marketing Campaign','Publish & monitor',        'Schedule, publish, report',        'medium', 3, 20, 10, 20),
  ('Construction Handover','Site preparation',      'Permits, survey, mobilisation',    'high',   0,  0, 14, 80),
  ('Construction Handover','Main works',            'Primary construction phase',       'critical',1, 14, 75, 600),
  ('Construction Handover','Inspection',            'Quality and compliance checks',    'high',   2, 89, 14, 60),
  ('Construction Handover','Snagging & handover',   'Defect list and client handover',  'high',   3,103, 17, 60)
) as v(template_name, title, description, priority, position, start_offset, duration, hours)
join public.project_templates pt
  on pt.name = v.template_name and pt.organization_id is null
where not exists (
  select 1 from public.project_template_tasks tt
  where tt.template_id = pt.id and tt.title = v.title
);
