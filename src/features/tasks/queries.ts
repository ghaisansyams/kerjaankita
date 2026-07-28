import { createClient } from "@/lib/supabase/client";
import { assembleBoard, BOARD_TASK_SELECT, type BoardTask, type RawBoardTask } from "./board-shared";

export type { BoardTask } from "./board-shared";

/** Re-fetch the whole enriched board (used by realtime sync + optimistic rollback). */
export async function fetchBoardTasks(projectId: string): Promise<BoardTask[]> {
  const supabase = createClient();

  const { data: taskData, error } = await supabase
    .from("tasks")
    .select(BOARD_TASK_SELECT)
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .order("position")
    .order("number");
  if (error) throw error;
  const tasks = (taskData ?? []) as unknown as RawBoardTask[];
  const ids = tasks.map((t) => t.id);

  const [checklist, attachments, comments] = await Promise.all([
    ids.length
      ? supabase.from("task_checklist_items").select("task_id, is_done").in("task_id", ids).is("deleted_at", null)
      : Promise.resolve({ data: [] as { task_id: string; is_done: boolean }[] }),
    supabase.from("attachments").select("entity_id").eq("entity", "task").eq("project_id", projectId).is("deleted_at", null),
    supabase.from("comments").select("entity_id").eq("entity", "task").eq("project_id", projectId).is("deleted_at", null),
  ]);

  return assembleBoard(
    tasks,
    (checklist.data ?? []) as { task_id: string; is_done: boolean }[],
    (attachments.data ?? []) as { entity_id: string }[],
    (comments.data ?? []) as { entity_id: string }[],
  );
}
