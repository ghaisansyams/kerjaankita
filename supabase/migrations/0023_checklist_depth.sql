-- Nested checklists: a checklist item can be a sub-item of the one above it.
-- depth 0 = top-level item, depth 1 = sub-item. Ordering stays by `position`,
-- so a parent is immediately followed by its children in the flat list.
alter table public.task_checklist_items
  add column if not exists depth smallint not null default 0;
