-- ============================================================================
-- FlowDesk — core schema
-- Postgres / Supabase. Run this in the Supabase SQL editor (or `supabase db push`).
--
-- Layers of access control:
--   1. Middleware  — authenticated vs. anonymous (app layer)
--   2. Route gates — coarse role checks (app layer)
--   3. RLS (below) — the source of truth. Every table is protected.
--
-- Roles: super_admin · project_manager · developer · client
-- ============================================================================

-- gen_random_uuid() is in core Postgres 13+; no extension needed on Supabase.

-- ----------------------------------------------------------------------------
-- 1. Enums
-- ----------------------------------------------------------------------------
create type public.user_role       as enum ('super_admin', 'project_manager', 'developer', 'client');
create type public.project_status  as enum ('planning', 'active', 'on_hold', 'completed', 'cancelled');
create type public.project_health  as enum ('on_track', 'at_risk', 'delayed');
create type public.task_status     as enum ('todo', 'in_progress', 'review', 'testing', 'done', 'blocked');
create type public.task_priority   as enum ('low', 'medium', 'high', 'critical');
create type public.activity_type   as enum (
  'task_created', 'task_updated', 'status_changed', 'progress_updated',
  'file_uploaded', 'comment_added', 'task_assigned',
  'project_created', 'project_updated', 'member_added'
);
create type public.notification_type as enum (
  'task_assigned', 'deadline_today', 'deadline_tomorrow',
  'task_completed', 'project_completed', 'mentioned'
);

-- ----------------------------------------------------------------------------
-- 2. Tables
-- ----------------------------------------------------------------------------

create table public.company_settings (
  id            uuid primary key default gen_random_uuid(),
  name          text not null default 'My Company',
  logo_url      text,
  primary_color text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.clients (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  contact_name  text,
  contact_email text,
  contact_phone text,
  logo_url      text,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Extends auth.users. One row per authenticated user.
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text,
  full_name  text,
  avatar_url text,
  title      text,
  role       public.user_role not null default 'developer',
  -- Only set for client users: which client organisation they belong to.
  client_id  uuid references public.clients (id) on delete set null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  key         text,                    -- short code e.g. "WEB" → WEB-12
  description text,
  client_id   uuid references public.clients (id) on delete set null,
  pic_id      uuid references public.profiles (id) on delete set null, -- person in charge
  color       text not null default '#4f46e5',
  status      public.project_status not null default 'planning',
  start_date  date,
  end_date    date,
  progress    int not null default 0 check (progress between 0 and 100),
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.project_members (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  role       text,                     -- optional per-project label (e.g. "Lead", "QA")
  created_at timestamptz not null default now(),
  unique (project_id, user_id)
);

create table public.tasks (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects (id) on delete cascade,
  task_number     int not null default 0,       -- per-project running number
  title           text not null,
  description     text,
  status          public.task_status not null default 'todo',
  priority        public.task_priority not null default 'medium',
  assignee_id     uuid references public.profiles (id) on delete set null,
  reporter_id     uuid references public.profiles (id) on delete set null,
  start_date      date,
  due_date        date,
  estimated_hours numeric(6, 2),
  actual_hours    numeric(6, 2),
  progress        int not null default 0 check (progress between 0 and 100),
  position        double precision not null default 0,  -- kanban ordering
  -- Evidence fields
  github_pr_url   text,
  figma_url       text,
  staging_url     text,
  production_url  text,
  evidence_notes  text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (project_id, task_number)
);

create table public.task_checklist_items (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks (id) on delete cascade,
  content    text not null,
  is_done    boolean not null default false,
  position   double precision not null default 0,
  created_at timestamptz not null default now()
);

create table public.task_comments (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks (id) on delete cascade,
  author_id  uuid references public.profiles (id) on delete set null,
  parent_id  uuid references public.task_comments (id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.attachments (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.projects (id) on delete cascade,
  task_id           uuid references public.tasks (id) on delete cascade,
  uploaded_by       uuid references public.profiles (id) on delete set null,
  bucket            text not null default 'attachments',
  path              text not null,
  file_name         text not null,
  file_type         text,
  file_size         bigint,
  is_client_visible boolean not null default false,
  created_at        timestamptz not null default now()
);

create table public.activities (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  task_id    uuid references public.tasks (id) on delete cascade,
  actor_id   uuid references public.profiles (id) on delete set null,
  type       public.activity_type not null,
  metadata   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  type        public.notification_type not null,
  title       text not null,
  body        text,
  entity_type text,
  entity_id   uuid,
  is_read     boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 3. Indexes
-- ----------------------------------------------------------------------------
create index idx_profiles_role            on public.profiles (role);
create index idx_profiles_client          on public.profiles (client_id);
create index idx_projects_client          on public.projects (client_id);
create index idx_projects_pic             on public.projects (pic_id);
create index idx_projects_status          on public.projects (status);
create index idx_project_members_project  on public.project_members (project_id);
create index idx_project_members_user     on public.project_members (user_id);
create index idx_tasks_project            on public.tasks (project_id);
create index idx_tasks_assignee           on public.tasks (assignee_id);
create index idx_tasks_status             on public.tasks (status);
create index idx_tasks_due_date           on public.tasks (due_date);
create index idx_tasks_project_status     on public.tasks (project_id, status);
create index idx_checklist_task           on public.task_checklist_items (task_id);
create index idx_comments_task            on public.task_comments (task_id);
create index idx_comments_parent          on public.task_comments (parent_id);
create index idx_attachments_project      on public.attachments (project_id);
create index idx_attachments_task         on public.attachments (task_id);
create index idx_activities_project       on public.activities (project_id, created_at desc);
create index idx_activities_task          on public.activities (task_id);
create index idx_activities_actor         on public.activities (actor_id);
create index idx_notifications_user       on public.notifications (user_id, is_read, created_at desc);

-- ----------------------------------------------------------------------------
-- 4. Helper functions (SECURITY DEFINER — read the caller's role without
--    triggering RLS recursion inside policies)
-- ----------------------------------------------------------------------------

create or replace function public.auth_role()
returns public.user_role
language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.auth_client_id()
returns uuid
language sql stable security definer set search_path = public
as $$ select client_id from public.profiles where id = auth.uid() $$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$ select public.auth_role() = 'super_admin' $$;

create or replace function public.is_internal()
returns boolean
language sql stable security definer set search_path = public
as $$ select public.auth_role() in ('super_admin', 'project_manager', 'developer') $$;

create or replace function public.is_manager_or_admin()
returns boolean
language sql stable security definer set search_path = public
as $$ select public.auth_role() in ('super_admin', 'project_manager') $$;

create or replace function public.can_view_project(p_project_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.projects pr
    where pr.id = p_project_id
      and (
        public.is_manager_or_admin()
        or (
          public.auth_role() = 'developer' and (
            pr.pic_id = auth.uid()
            or exists (select 1 from public.project_members pm
                       where pm.project_id = pr.id and pm.user_id = auth.uid())
            or exists (select 1 from public.tasks t
                       where t.project_id = pr.id and t.assignee_id = auth.uid())
          )
        )
        or (public.auth_role() = 'client' and pr.client_id = public.auth_client_id())
      )
  )
$$;

create or replace function public.can_view_task(p_task_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.can_view_project((select project_id from public.tasks where id = p_task_id))
$$;

create or replace function public.can_edit_task(p_task_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_manager_or_admin()
      or (public.auth_role() = 'developer'
          and exists (select 1 from public.tasks
                      where id = p_task_id and assignee_id = auth.uid()))
$$;

create or replace function public.shares_project_with_client(p_profile_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.project_members pm
    join public.projects pr on pr.id = pm.project_id
    where pm.user_id = p_profile_id
      and pr.client_id = public.auth_client_id()
  )
$$;

-- Project health derived from progress vs. schedule.
create or replace function public.compute_project_health(
  p_progress int, p_start date, p_end date, p_status public.project_status
) returns public.project_health
language plpgsql stable
as $$
declare
  v_expected int;
begin
  if p_status in ('completed', 'cancelled') then
    return 'on_track';
  end if;
  if p_end is null then
    return 'on_track';
  end if;
  if current_date > p_end and p_progress < 100 then
    return 'delayed';
  end if;
  if p_start is null or p_end <= p_start then
    return 'on_track';
  end if;
  v_expected := greatest(0, least(100,
    round((current_date - p_start)::numeric / nullif((p_end - p_start), 0) * 100)::int));
  if p_progress < v_expected - 15 then
    return 'at_risk';
  end if;
  return 'on_track';
end;
$$;

-- Insert a notification, skipping null targets and self-notifications.
create or replace function public.notify_user(
  p_target uuid, p_actor uuid, p_type public.notification_type,
  p_title text, p_body text, p_entity_type text, p_entity_id uuid
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_target is null or p_target = p_actor then
    return;
  end if;
  insert into public.notifications (user_id, type, title, body, entity_type, entity_id)
  values (p_target, p_type, p_title, p_body, p_entity_type, p_entity_id);
end;
$$;

-- ----------------------------------------------------------------------------
-- 5. Trigger functions
-- ----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Create a profile row when a new auth user signs up. First user = super_admin.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_role  public.user_role;
  v_count int;
begin
  select count(*) into v_count from public.profiles;
  if v_count = 0 then
    v_role := 'super_admin';
  else
    begin
      v_role := coalesce(nullif(new.raw_user_meta_data ->> 'role', '')::public.user_role, 'developer');
    exception when others then
      v_role := 'developer';
    end;
  end if;

  insert into public.profiles (id, email, full_name, avatar_url, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name',
             new.raw_user_meta_data ->> 'name',
             split_part(coalesce(new.email, ''), '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url',
    v_role
  );
  return new;
end;
$$;

-- Non-admins may not change their own role / client link / active flag.
create or replace function public.enforce_profile_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    new.role      := old.role;
    new.client_id := old.client_id;
    new.is_active := old.is_active;
  end if;
  return new;
end;
$$;

-- Assign a per-project running task number on insert.
create or replace function public.set_task_number()
returns trigger language plpgsql as $$
begin
  if new.task_number is null or new.task_number = 0 then
    select coalesce(max(task_number), 0) + 1 into new.task_number
    from public.tasks where project_id = new.project_id;
  end if;
  return new;
end;
$$;

-- Keep task progress consistent with status; clamp to 0..100.
create or replace function public.sync_task_progress()
returns trigger language plpgsql as $$
begin
  if new.status = 'done' then
    new.progress := 100;
  end if;
  if new.progress < 0 then
    new.progress := 0;
  elsif new.progress > 100 then
    new.progress := 100;
  end if;
  return new;
end;
$$;

-- Developers may only edit a whitelist of columns on their own tasks.
create or replace function public.enforce_task_update_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_manager_or_admin() then
    return new;
  end if;
  if public.auth_role() = 'developer' then
    -- Preserve manager-owned fields; developers keep status/progress/hours/evidence.
    new.project_id      := old.project_id;
    new.task_number     := old.task_number;
    new.title           := old.title;
    new.description     := old.description;
    new.priority        := old.priority;
    new.assignee_id     := old.assignee_id;
    new.reporter_id     := old.reporter_id;
    new.start_date      := old.start_date;
    new.due_date        := old.due_date;
    new.estimated_hours := old.estimated_hours;
  end if;
  return new;
end;
$$;

-- Recompute project.progress as the average of its tasks' progress.
create or replace function public.recompute_project_progress()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_project uuid;
  v_avg     int;
begin
  v_project := coalesce(new.project_id, old.project_id);
  select coalesce(round(avg(progress)), 0) into v_avg
  from public.tasks where project_id = v_project;
  update public.projects set progress = v_avg where id = v_project;
  return null;
end;
$$;

-- Activity + notification logging for tasks.
create or replace function public.log_task_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_pic   uuid;
begin
  if tg_op = 'INSERT' then
    insert into public.activities (project_id, task_id, actor_id, type, metadata)
    values (new.project_id, new.id, v_actor, 'task_created',
            jsonb_build_object('title', new.title));
    if new.assignee_id is not null then
      insert into public.activities (project_id, task_id, actor_id, type, metadata)
      values (new.project_id, new.id, v_actor, 'task_assigned',
              jsonb_build_object('assignee_id', new.assignee_id));
      perform public.notify_user(new.assignee_id, v_actor, 'task_assigned',
              'New task assigned', new.title, 'task', new.id);
    end if;
    return new;
  end if;

  -- UPDATE
  if new.status is distinct from old.status then
    insert into public.activities (project_id, task_id, actor_id, type, metadata)
    values (new.project_id, new.id, v_actor, 'status_changed',
            jsonb_build_object('from', old.status, 'to', new.status));
    if new.status = 'done' then
      select pic_id into v_pic from public.projects where id = new.project_id;
      perform public.notify_user(new.reporter_id, v_actor, 'task_completed',
              'Task completed', new.title, 'task', new.id);
      perform public.notify_user(v_pic, v_actor, 'task_completed',
              'Task completed', new.title, 'task', new.id);
    end if;
  end if;

  if new.progress is distinct from old.progress then
    insert into public.activities (project_id, task_id, actor_id, type, metadata)
    values (new.project_id, new.id, v_actor, 'progress_updated',
            jsonb_build_object('from', old.progress, 'to', new.progress));
  end if;

  if new.assignee_id is distinct from old.assignee_id then
    insert into public.activities (project_id, task_id, actor_id, type, metadata)
    values (new.project_id, new.id, v_actor, 'task_assigned',
            jsonb_build_object('assignee_id', new.assignee_id));
    perform public.notify_user(new.assignee_id, v_actor, 'task_assigned',
            'Task assigned to you', new.title, 'task', new.id);
  end if;

  return new;
end;
$$;

create or replace function public.log_comment_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_task  record;
begin
  select project_id, assignee_id, title into v_task
  from public.tasks where id = new.task_id;

  insert into public.activities (project_id, task_id, actor_id, type, metadata)
  values (v_task.project_id, new.task_id, v_actor, 'comment_added',
          jsonb_build_object('comment_id', new.id));

  perform public.notify_user(v_task.assignee_id, v_actor, 'mentioned',
          'New comment on your task', v_task.title, 'task', new.task_id);
  return new;
end;
$$;

create or replace function public.log_attachment_activity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.activities (project_id, task_id, actor_id, type, metadata)
  values (new.project_id, new.task_id, auth.uid(), 'file_uploaded',
          jsonb_build_object('file_name', new.file_name));
  return new;
end;
$$;

create or replace function public.log_project_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    insert into public.activities (project_id, actor_id, type, metadata)
    values (new.id, v_actor, 'project_created',
            jsonb_build_object('name', new.name));
    return new;
  end if;
  if new.status is distinct from old.status then
    insert into public.activities (project_id, actor_id, type, metadata)
    values (new.id, v_actor, 'project_updated',
            jsonb_build_object('status', new.status));
    if new.status = 'completed' then
      perform public.notify_user(new.pic_id, v_actor, 'project_completed',
              'Project completed', new.name, 'project', new.id);
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.log_member_activity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.activities (project_id, actor_id, type, metadata)
  values (new.project_id, auth.uid(), 'member_added',
          jsonb_build_object('user_id', new.user_id));
  return new;
end;
$$;

-- Deadline notifications — run on a schedule (e.g. Supabase cron / pg_cron).
create or replace function public.generate_deadline_notifications()
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, type, title, body, entity_type, entity_id)
  select t.assignee_id, 'deadline_today', 'Task due today', t.title, 'task', t.id
  from public.tasks t
  where t.assignee_id is not null and t.due_date = current_date and t.status <> 'done'
    and not exists (
      select 1 from public.notifications n
      where n.user_id = t.assignee_id and n.entity_id = t.id
        and n.type = 'deadline_today' and n.created_at::date = current_date);

  insert into public.notifications (user_id, type, title, body, entity_type, entity_id)
  select t.assignee_id, 'deadline_tomorrow', 'Task due tomorrow', t.title, 'task', t.id
  from public.tasks t
  where t.assignee_id is not null and t.due_date = current_date + 1 and t.status <> 'done'
    and not exists (
      select 1 from public.notifications n
      where n.user_id = t.assignee_id and n.entity_id = t.id
        and n.type = 'deadline_tomorrow' and n.created_at::date = current_date);
end;
$$;

-- ----------------------------------------------------------------------------
-- 6. Triggers
-- ----------------------------------------------------------------------------
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create trigger trg_company_updated  before update on public.company_settings
  for each row execute function public.set_updated_at();
create trigger trg_clients_updated   before update on public.clients
  for each row execute function public.set_updated_at();

create trigger trg_profiles_updated  before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger trg_profiles_guard    before update on public.profiles
  for each row execute function public.enforce_profile_guard();

create trigger trg_projects_updated  before update on public.projects
  for each row execute function public.set_updated_at();
create trigger trg_projects_activity after insert or update on public.projects
  for each row execute function public.log_project_activity();

create trigger trg_members_activity  after insert on public.project_members
  for each row execute function public.log_member_activity();

create trigger trg_tasks_number      before insert on public.tasks
  for each row execute function public.set_task_number();
create trigger trg_tasks_progress    before insert or update on public.tasks
  for each row execute function public.sync_task_progress();
create trigger trg_tasks_guard       before update on public.tasks
  for each row execute function public.enforce_task_update_guard();
create trigger trg_tasks_updated     before update on public.tasks
  for each row execute function public.set_updated_at();
create trigger trg_tasks_activity    after insert or update on public.tasks
  for each row execute function public.log_task_activity();
create trigger trg_tasks_rollup      after insert or update or delete on public.tasks
  for each row execute function public.recompute_project_progress();

create trigger trg_comments_updated  before update on public.task_comments
  for each row execute function public.set_updated_at();
create trigger trg_comments_activity after insert on public.task_comments
  for each row execute function public.log_comment_activity();

create trigger trg_attachments_activity after insert on public.attachments
  for each row execute function public.log_attachment_activity();

-- ----------------------------------------------------------------------------
-- 7. Views
-- ----------------------------------------------------------------------------
create or replace view public.project_overview
with (security_invoker = true) as
select
  p.*,
  c.name       as client_name,
  c.logo_url   as client_logo_url,
  prof.full_name  as pic_name,
  prof.avatar_url as pic_avatar_url,
  public.compute_project_health(p.progress, p.start_date, p.end_date, p.status) as health,
  (select count(*) from public.tasks t where t.project_id = p.id) as task_count,
  (select count(*) from public.tasks t where t.project_id = p.id and t.status = 'done') as done_task_count,
  (select count(*) from public.project_members m where m.project_id = p.id) as member_count
from public.projects p
left join public.clients  c    on c.id = p.client_id
left join public.profiles prof on prof.id = p.pic_id;

-- ----------------------------------------------------------------------------
-- 8. Row Level Security
-- ----------------------------------------------------------------------------
alter table public.company_settings     enable row level security;
alter table public.clients               enable row level security;
alter table public.profiles              enable row level security;
alter table public.projects              enable row level security;
alter table public.project_members       enable row level security;
alter table public.tasks                 enable row level security;
alter table public.task_checklist_items  enable row level security;
alter table public.task_comments         enable row level security;
alter table public.attachments           enable row level security;
alter table public.activities            enable row level security;
alter table public.notifications         enable row level security;

-- company_settings
create policy company_select on public.company_settings for select
  using (auth.uid() is not null);
create policy company_insert on public.company_settings for insert
  with check (public.is_admin());
create policy company_update on public.company_settings for update
  using (public.is_admin()) with check (public.is_admin());

-- clients
create policy clients_select on public.clients for select
  using (public.is_internal() or id = public.auth_client_id());
create policy clients_insert on public.clients for insert
  with check (public.is_manager_or_admin());
create policy clients_update on public.clients for update
  using (public.is_manager_or_admin()) with check (public.is_manager_or_admin());
create policy clients_delete on public.clients for delete
  using (public.is_manager_or_admin());

-- profiles
create policy profiles_select on public.profiles for select
  using (
    public.is_internal()
    or id = auth.uid()
    or public.shares_project_with_client(id)
  );
create policy profiles_insert on public.profiles for insert
  with check (public.is_admin());
create policy profiles_update on public.profiles for update
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());
create policy profiles_delete on public.profiles for delete
  using (public.is_admin());

-- projects
create policy projects_select on public.projects for select
  using (public.can_view_project(id));
create policy projects_insert on public.projects for insert
  with check (public.is_manager_or_admin());
create policy projects_update on public.projects for update
  using (public.is_manager_or_admin()) with check (public.is_manager_or_admin());
create policy projects_delete on public.projects for delete
  using (public.is_manager_or_admin());

-- project_members
create policy members_select on public.project_members for select
  using (public.can_view_project(project_id));
create policy members_insert on public.project_members for insert
  with check (public.is_manager_or_admin());
create policy members_update on public.project_members for update
  using (public.is_manager_or_admin()) with check (public.is_manager_or_admin());
create policy members_delete on public.project_members for delete
  using (public.is_manager_or_admin());

-- tasks
create policy tasks_select on public.tasks for select
  using (public.can_view_project(project_id));
create policy tasks_insert on public.tasks for insert
  with check (public.is_manager_or_admin());
create policy tasks_update on public.tasks for update
  using (
    public.is_manager_or_admin()
    or (public.auth_role() = 'developer' and assignee_id = auth.uid())
  )
  with check (
    public.is_manager_or_admin()
    or (public.auth_role() = 'developer' and assignee_id = auth.uid())
  );
create policy tasks_delete on public.tasks for delete
  using (public.is_manager_or_admin());

-- task_checklist_items
create policy checklist_select on public.task_checklist_items for select
  using (public.can_view_task(task_id));
create policy checklist_insert on public.task_checklist_items for insert
  with check (public.can_edit_task(task_id));
create policy checklist_update on public.task_checklist_items for update
  using (public.can_edit_task(task_id)) with check (public.can_edit_task(task_id));
create policy checklist_delete on public.task_checklist_items for delete
  using (public.can_edit_task(task_id));

-- task_comments (internal only — clients never see the discussion thread)
create policy comments_select on public.task_comments for select
  using (public.is_internal() and public.can_view_task(task_id));
create policy comments_insert on public.task_comments for insert
  with check (public.is_internal() and public.can_view_task(task_id) and author_id = auth.uid());
create policy comments_update on public.task_comments for update
  using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy comments_delete on public.task_comments for delete
  using (author_id = auth.uid() or public.is_manager_or_admin());

-- attachments (clients only see client-visible files on their projects)
create policy attachments_select on public.attachments for select
  using (public.can_view_project(project_id) and (public.is_internal() or is_client_visible));
create policy attachments_insert on public.attachments for insert
  with check (public.is_internal() and public.can_view_project(project_id));
create policy attachments_update on public.attachments for update
  using (public.is_manager_or_admin() or uploaded_by = auth.uid())
  with check (public.is_manager_or_admin() or uploaded_by = auth.uid());
create policy attachments_delete on public.attachments for delete
  using (public.is_manager_or_admin() or uploaded_by = auth.uid());

-- activities (clients see their projects' activity, except internal comments)
create policy activities_select on public.activities for select
  using (public.can_view_project(project_id) and (public.is_internal() or type <> 'comment_added'));
create policy activities_insert on public.activities for insert
  with check (public.is_internal() and public.can_view_project(project_id));
create policy activities_delete on public.activities for delete
  using (public.is_admin());

-- notifications (own only)
create policy notifications_select on public.notifications for select
  using (user_id = auth.uid());
create policy notifications_insert on public.notifications for insert
  with check (public.is_internal());
create policy notifications_update on public.notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_delete on public.notifications for delete
  using (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 9. Grants (privileges gate access; RLS then restricts rows)
-- ----------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.project_overview to authenticated;
grant execute on all functions in schema public to authenticated;
