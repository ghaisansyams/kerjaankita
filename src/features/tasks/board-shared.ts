// Shared board types + assembly — imported by BOTH the browser query (queries.ts)
// and the server repository (task.repository.ts), so it must stay free of any
// Supabase client import. Pure data shaping only.

export type BoardTask = {
  id: string;
  number: number;
  title: string;
  status_id: string | null;
  priority: string;
  assignee_id: string | null;
  assignee_name: string | null;
  assignee_avatar: string | null;
  due_date: string | null;
  progress: number;
  is_blocked: boolean;
  position: number;
  est_hours: number | null;
  checklist_done: number;
  checklist_total: number;
  attachments: number;
  comments: number;
};

/** Task columns the board query selects (base fields; counts fetched separately). */
export const BOARD_TASK_SELECT = `
  id, number, title, status_id, priority, assignee_id, due_date, progress, is_blocked, position, estimated_hours,
  assignee:profiles!tasks_assignee_id_fkey(full_name, avatar_url)
`;

export type RawBoardTask = {
  id: string;
  number: number;
  title: string;
  status_id: string | null;
  priority: string;
  assignee_id: string | null;
  due_date: string | null;
  progress: number;
  is_blocked: boolean;
  position: number | null;
  estimated_hours: number | null;
  assignee: { full_name: string | null; avatar_url: string | null } | null;
};

function tally(rows: { entity_id?: string | null; task_id?: string | null }[], key: "entity_id" | "task_id") {
  const m = new Map<string, number>();
  for (const r of rows) {
    const id = r[key];
    if (id) m.set(id, (m.get(id) ?? 0) + 1);
  }
  return m;
}

/** Merge the base task rows with the three count queries into board cards. */
export function assembleBoard(
  tasks: RawBoardTask[],
  checklist: { task_id: string; is_done: boolean }[],
  attachments: { entity_id: string }[],
  comments: { entity_id: string }[],
): BoardTask[] {
  const clTotal = tally(checklist, "task_id");
  const clDone = tally(checklist.filter((c) => c.is_done), "task_id");
  const att = tally(attachments, "entity_id");
  const com = tally(comments, "entity_id");

  return tasks.map((t) => ({
    id: t.id,
    number: t.number,
    title: t.title,
    status_id: t.status_id,
    priority: t.priority,
    assignee_id: t.assignee_id,
    assignee_name: t.assignee?.full_name ?? null,
    assignee_avatar: t.assignee?.avatar_url ?? null,
    due_date: t.due_date,
    progress: t.progress,
    is_blocked: t.is_blocked,
    position: t.position ?? 0,
    est_hours: t.estimated_hours,
    checklist_done: clDone.get(t.id) ?? 0,
    checklist_total: clTotal.get(t.id) ?? 0,
    attachments: att.get(t.id) ?? 0,
    comments: com.get(t.id) ?? 0,
  }));
}
