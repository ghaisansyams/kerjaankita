-- "Hak Akses": which roles (and platform, e.g. WEB/APP) may access the area a
-- task represents. Populated by AI import from a role → module → feature map,
-- shown as chips on the board card and task detail.
alter table public.tasks
  add column if not exists access_roles text[] not null default '{}';
