import { createClient } from "@/lib/supabase/client";

/** One card on the Kanban board (RLS-scoped, browser-fetched). */
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
};

const BOARD_SELECT = `
  id, number, title, status_id, priority, assignee_id, due_date, progress, is_blocked, position,
  assignee:profiles!tasks_assignee_id_fkey(id, full_name, avatar_url)
`;

type Row = {
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
  assignee: { full_name: string | null; avatar_url: string | null } | null;
};

function toBoardTask(r: Row): BoardTask {
  return {
    id: r.id,
    number: r.number,
    title: r.title,
    status_id: r.status_id,
    priority: r.priority,
    assignee_id: r.assignee_id,
    assignee_name: r.assignee?.full_name ?? null,
    assignee_avatar: r.assignee?.avatar_url ?? null,
    due_date: r.due_date,
    progress: r.progress,
    is_blocked: r.is_blocked,
    position: r.position ?? 0,
  };
}

/** Re-fetch the whole board (used by realtime sync + optimistic rollback). */
export async function fetchBoardTasks(projectId: string): Promise<BoardTask[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select(BOARD_SELECT)
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .order("position")
    .order("number");
  if (error) throw error;
  return ((data ?? []) as unknown as Row[]).map(toBoardTask);
}
