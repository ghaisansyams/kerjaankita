import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { TablesInsert, TablesUpdate } from "@/types/database.types";

export async function listChecklist(taskId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("task_checklist_items")
    .select("id, content, is_done, position, depth")
    .eq("task_id", taskId)
    .is("deleted_at", null)
    .order("position")
    .order("created_at");
  if (error) throw error;
  return data;
}

export type ChecklistItem = Awaited<ReturnType<typeof listChecklist>>[number];

export async function insertChecklistItem(values: TablesInsert<"task_checklist_items">) {
  const supabase = await createClient();
  const { error } = await supabase.from("task_checklist_items").insert(values);
  if (error) throw error;
}

export async function updateChecklistItem(
  id: string,
  patch: TablesUpdate<"task_checklist_items">,
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("task_checklist_items")
    .update(patch)
    .eq("id", id)
    .is("deleted_at", null)
    .select("id, task_id")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function softDeleteChecklistItem(id: string, deletedBy: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("task_checklist_items")
    .update({ deleted_at: new Date().toISOString(), deleted_by: deletedBy })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id, task_id")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function setChecklistPositions(orderedIds: string[]) {
  const supabase = await createClient();
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from("task_checklist_items")
      .update({ position: i })
      .eq("id", orderedIds[i])
      .is("deleted_at", null);
    if (error) throw error;
  }
}
