-- ============================================================================
-- 0022 · AI Meeting Assistant
--
-- Upload a meeting recording → transcribe → (later) summary / MoM / action
-- items → (later) tasks. Sprint 1 uses meeting_records + meeting_transcripts;
-- meeting_summaries + meeting_action_items are created now for a future-ready
-- schema. Everything is org-scoped with RLS mirroring the rest of the app.
-- ============================================================================

-- Audio bucket (private). Served via short-lived signed URLs after an access
-- check, same pattern as attachments.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'meeting-recordings', 'meeting-recordings', false, 209715200,  -- 200 MB ceiling
  array[
    'audio/mpeg','audio/mp3','audio/wav','audio/x-wav','audio/wave','audio/vnd.wave',
    'audio/mp4','audio/x-m4a','audio/m4a','audio/aac','audio/ogg','audio/opus','audio/webm',
    'video/mp4','video/webm'
  ]
) on conflict (id) do nothing;

create policy "meeting-rec tenant read" on storage.objects for select to authenticated
  using (
    bucket_id = 'meeting-recordings'
    and public.is_org_member((storage.foldername(name))[1]::uuid)
    and public.can_see_internal((storage.foldername(name))[1]::uuid)
  );
create policy "meeting-rec tenant upload" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'meeting-recordings'
    and public.is_org_member((storage.foldername(name))[1]::uuid)
    and public.can_see_internal((storage.foldername(name))[1]::uuid)
  );
create policy "meeting-rec owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'meeting-recordings' and owner = auth.uid());

-- ----------------------------------------------------------------------------
-- meeting_records — one recording + its metadata and pipeline status.
-- ----------------------------------------------------------------------------
create table if not exists public.meeting_records (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  workspace_id     uuid references public.workspaces (id) on delete set null,
  project_id       uuid references public.projects (id) on delete set null,
  title            text not null,
  description      text,
  meeting_date     date,
  meeting_time     text,
  location         text,
  meeting_type     text,
  audio_bucket     text not null default 'meeting-recordings',
  audio_path       text,
  audio_file_name  text,
  audio_mime_type  text,
  audio_size_bytes bigint,
  duration_seconds integer,
  status           text not null default 'uploaded',   -- uploaded|transcribing|transcribed|failed
  error            text,
  is_private       boolean not null default false,
  created_at       timestamptz not null default now(),
  created_by       uuid references public.profiles (id),
  updated_at       timestamptz not null default now(),
  updated_by       uuid references public.profiles (id),
  deleted_at       timestamptz,
  deleted_by       uuid references public.profiles (id)
);
create index if not exists idx_meeting_records_org on public.meeting_records (organization_id, created_at desc) where deleted_at is null;
create index if not exists idx_meeting_records_project on public.meeting_records (project_id) where deleted_at is null;

-- ----------------------------------------------------------------------------
-- meeting_transcripts — one editable transcript per meeting (auto-saved).
-- ----------------------------------------------------------------------------
create table if not exists public.meeting_transcripts (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  meeting_id      uuid not null references public.meeting_records (id) on delete cascade,
  content         text not null default '',   -- edited/clean transcript
  raw_content     text,                        -- original STT output
  provider        text,
  model           text,
  language        text,
  segments        jsonb,                       -- optional speaker/timestamp data
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  updated_by      uuid references public.profiles (id)
);
create unique index if not exists idx_meeting_transcripts_meeting on public.meeting_transcripts (meeting_id);

-- ----------------------------------------------------------------------------
-- meeting_summaries — future-ready (Section 4).
-- ----------------------------------------------------------------------------
create table if not exists public.meeting_summaries (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations (id) on delete cascade,
  meeting_id        uuid not null references public.meeting_records (id) on delete cascade,
  objective         text,
  discussion        text,
  decisions         jsonb,
  risks             jsonb,
  pending_questions jsonb,
  conclusion        text,
  raw               jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create unique index if not exists idx_meeting_summaries_meeting on public.meeting_summaries (meeting_id);

-- ----------------------------------------------------------------------------
-- meeting_action_items — future-ready (Section 6/7). task_id links a converted
-- FlowDesk task (reuses the existing task pipeline; never bypassed).
-- ----------------------------------------------------------------------------
create table if not exists public.meeting_action_items (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  meeting_id      uuid not null references public.meeting_records (id) on delete cascade,
  task            text not null,
  responsible     text,
  priority        text,
  deadline        date,
  status          text not null default 'open',
  task_id         uuid references public.tasks (id) on delete set null,
  position        integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_meeting_action_items_meeting on public.meeting_action_items (meeting_id, position);

-- ----------------------------------------------------------------------------
-- RLS — internal org members only; private meetings visible only to their
-- creator. Children gated through the parent via SECURITY DEFINER helpers.
-- ----------------------------------------------------------------------------
alter table public.meeting_records      enable row level security;
alter table public.meeting_transcripts  enable row level security;
alter table public.meeting_summaries    enable row level security;
alter table public.meeting_action_items enable row level security;

create policy mr_read on public.meeting_records for select
  using (
    deleted_at is null
    and public.is_org_member(organization_id)
    and public.can_see_internal(organization_id)
    and (not is_private or created_by = auth.uid())
  );
create policy mr_insert on public.meeting_records for insert
  with check (public.is_org_member(organization_id) and public.can_see_internal(organization_id));
create policy mr_update on public.meeting_records for update
  using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy mr_delete on public.meeting_records for delete
  using (created_by = auth.uid());

create or replace function public.meeting_can_read(p_meeting uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.meeting_records m
    where m.id = p_meeting and m.deleted_at is null
      and public.is_org_member(m.organization_id) and public.can_see_internal(m.organization_id)
      and (not m.is_private or m.created_by = auth.uid())
  );
$$;
create or replace function public.meeting_can_write(p_meeting uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.meeting_records m
    where m.id = p_meeting and m.deleted_at is null
      and public.is_org_member(m.organization_id) and public.can_see_internal(m.organization_id)
  );
$$;

create policy mt_read  on public.meeting_transcripts  for select using (public.meeting_can_read(meeting_id));
create policy mt_write on public.meeting_transcripts  for all
  using (public.meeting_can_write(meeting_id)) with check (public.meeting_can_write(meeting_id));
create policy ms_read  on public.meeting_summaries    for select using (public.meeting_can_read(meeting_id));
create policy ms_write on public.meeting_summaries    for all
  using (public.meeting_can_write(meeting_id)) with check (public.meeting_can_write(meeting_id));
create policy mai_read  on public.meeting_action_items for select using (public.meeting_can_read(meeting_id));
create policy mai_write on public.meeting_action_items for all
  using (public.meeting_can_write(meeting_id)) with check (public.meeting_can_write(meeting_id));
