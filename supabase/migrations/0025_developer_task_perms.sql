-- Developers (org_member) get the same TASK powers as the manager/PIC: edit,
-- reassign and remove ANY task and its checklist — not just their own. In this
-- team the PIC only monitors and won't touch the setup, so the people doing the
-- work need to edit todos freely. Non-task admin (projects, members, workspace,
-- reports) stays with owner/manager.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
  from public.roles r
  cross join public.permissions p
 where r.organization_id is null
   and r.key = 'org_member'
   and p.key in ('task.update.any', 'task.delete', 'task.assign')
on conflict do nothing;
