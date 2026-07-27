-- ============================================================================
-- 0009 · Storage buckets and policies
--
-- Path convention (enforced by policy, relied on by the app):
--   attachments : {organization_id}/{project_id}/{uuid}-{filename}
--   avatars     : {user_id}/{uuid}-{filename}
--   branding    : {organization_id}/{uuid}-{filename}
--   exports     : {organization_id}/{uuid}-{filename}
--
-- The FIRST path segment is the tenant key. Every private-bucket policy checks
-- membership of that organization, so a leaked object path from one tenant is
-- unusable by another.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars', 'avatars', true, 5242880,
  array['image/png','image/jpeg','image/gif','image/webp','image/svg+xml']
) on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'branding', 'branding', true, 5242880,
  array['image/png','image/jpeg','image/gif','image/webp','image/svg+xml']
) on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'attachments', 'attachments', false, 52428800,
  array[
    'image/png','image/jpeg','image/gif','image/webp','image/svg+xml',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/zip','application/x-zip-compressed',
    'text/plain','text/csv','application/json'
  ]
) on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'exports', 'exports', false, 104857600,
  array['text/csv','application/pdf','application/json',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
) on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- avatars — public read; users write only inside their own {user_id}/ folder
-- ----------------------------------------------------------------------------
create policy "avatars public read" on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars owner write" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars owner update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ----------------------------------------------------------------------------
-- branding — public read; org admins write inside their {organization_id}/
-- ----------------------------------------------------------------------------
create policy "branding public read" on storage.objects for select
  using (bucket_id = 'branding');

create policy "branding admin write" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'branding'
    and public.has_permission((storage.foldername(name))[1]::uuid, 'organization.settings.update')
  );

create policy "branding admin delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'branding'
    and public.has_permission((storage.foldername(name))[1]::uuid, 'organization.settings.update')
  );

-- ----------------------------------------------------------------------------
-- attachments — PRIVATE. Tenant-scoped by the first path segment.
-- Guest downloads are served by short-lived signed URLs generated server-side
-- after the `attachments` row (is_guest_visible) has been checked.
-- ----------------------------------------------------------------------------
create policy "attachments tenant read" on storage.objects for select to authenticated
  using (
    bucket_id = 'attachments'
    and public.is_org_member((storage.foldername(name))[1]::uuid)
    and public.can_see_internal((storage.foldername(name))[1]::uuid)
  );

create policy "attachments tenant upload" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'attachments'
    and public.has_permission((storage.foldername(name))[1]::uuid, 'attachment.upload')
  );

create policy "attachments owner or manager update" on storage.objects for update to authenticated
  using (
    bucket_id = 'attachments'
    and (owner = auth.uid()
         or public.has_permission((storage.foldername(name))[1]::uuid, 'attachment.manage'))
  );

create policy "attachments owner or manager delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'attachments'
    and (owner = auth.uid()
         or public.has_permission((storage.foldername(name))[1]::uuid, 'attachment.manage'))
  );

-- ----------------------------------------------------------------------------
-- exports — PRIVATE, generated reports. Read requires the export permission.
-- ----------------------------------------------------------------------------
create policy "exports read" on storage.objects for select to authenticated
  using (
    bucket_id = 'exports'
    and public.has_permission((storage.foldername(name))[1]::uuid, 'report.export')
  );

create policy "exports write" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'exports'
    and public.has_permission((storage.foldername(name))[1]::uuid, 'report.export')
  );

create policy "exports delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'exports'
    and public.has_permission((storage.foldername(name))[1]::uuid, 'report.export')
  );
