-- ============================================================================
-- FlowDesk — Storage buckets + policies
-- Run AFTER 0001_init.sql. (Supabase-specific: uses the storage schema.)
--
-- Buckets:
--   avatars      (public)  — profile pictures, client/company logos
--   attachments  (private) — task/project files; served via signed URLs
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars', 'avatars', true, 5242880,
  array['image/png','image/jpeg','image/gif','image/webp','image/svg+xml']
)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'attachments', 'attachments', false, 26214400,
  array[
    'image/png','image/jpeg','image/gif','image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip','application/x-zip-compressed',
    'text/plain'
  ]
)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- avatars — public read, users manage files under their own {uid}/ folder
-- ----------------------------------------------------------------------------
create policy "avatars public read"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars owner insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars owner update"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and owner = auth.uid());

create policy "avatars owner delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and owner = auth.uid());

-- ----------------------------------------------------------------------------
-- attachments — private. Internal users upload/read; downloads for clients go
-- through server-generated signed URLs (service role). Uploader or managers
-- may modify/remove.
-- ----------------------------------------------------------------------------
create policy "attachments internal read"
  on storage.objects for select to authenticated
  using (bucket_id = 'attachments' and public.is_internal());

create policy "attachments internal insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments' and public.is_internal());

create policy "attachments modify own or manager"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'attachments'
    and (owner = auth.uid() or public.is_manager_or_admin())
  );

create policy "attachments delete own or manager"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'attachments'
    and (owner = auth.uid() or public.is_manager_or_admin())
  );
