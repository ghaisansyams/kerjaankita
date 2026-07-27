import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { TablesInsert, TablesUpdate } from "@/types/database.types";

const LIST_SELECT = `
  id, number, title, status_id, priority, assignee_id, due_date, progress, is_blocked, position,
  status:workflow_statuses(id, name, color, category),
  assignee:profiles!tasks_assignee_id_fkey(id, full_name, avatar_url)
`;

export async function listTasks(projectId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select(LIST_SELECT)
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .order("position")
    .order("number");
  if (error) throw error;
  return data;
}

export type TaskListItem = Awaited<ReturnType<typeof listTasks>>[number];

export async function getTask(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select(
      `*,
       status:workflow_statuses(id, name, color, category),
       assignee:profiles!tasks_assignee_id_fkey(id, full_name, avatar_url, email),
       reporter:profiles!tasks_reporter_id_fkey(id, full_name, avatar_url)`,
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export type TaskDetail = NonNullable<Awaited<ReturnType<typeof getTask>>>;

export async function insertTask(values: TablesInsert<"tasks">) {
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").insert(values);
  if (error) throw error;
}

export async function updateTask(id: string, patch: TablesUpdate<"tasks">) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .update(patch)
    .eq("id", id)
    .is("deleted_at", null)
    .select("id, project_id")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function softDeleteTask(id: string, deletedBy: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .update({ deleted_at: new Date().toISOString(), deleted_by: deletedBy })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id, project_id")
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Lightweight tenancy reference for a task (RLS-scoped). */
export async function getTaskRef(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tasks")
    .select("project_id, organization_id")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  return data;
}

/** Is this user the assignee of the task? (For scope-aware own-task edits.) */
export async function isTaskAssignee(id: string, userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tasks")
    .select("assignee_id")
    .eq("id", id)
    .maybeSingle();
  return data?.assignee_id === userId;
}
