import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { TablesInsert, TablesUpdate } from "@/types/database.types";

export async function listMilestones(projectId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("milestones")
    .select("id, name, description, due_date, achieved_at, position, created_at")
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .order("position")
    .order("created_at");
  if (error) throw error;
  return data;
}

export type MilestoneRow = Awaited<ReturnType<typeof listMilestones>>[number];

export async function insertMilestone(values: TablesInsert<"milestones">) {
  const supabase = await createClient();
  const { error } = await supabase.from("milestones").insert(values);
  if (error) throw error;
}

export async function updateMilestone(
  id: string,
  patch: TablesUpdate<"milestones">,
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("milestones")
    .update(patch)
    .eq("id", id)
    .is("deleted_at", null)
    .select("id, project_id")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function softDeleteMilestone(id: string, deletedBy: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("milestones")
    .update({ deleted_at: new Date().toISOString(), deleted_by: deletedBy })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id, project_id")
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Persist a new order (position = index). Milestones are few per project. */
export async function setMilestonePositions(orderedIds: string[]) {
  const supabase = await createClient();
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from("milestones")
      .update({ position: i })
      .eq("id", orderedIds[i])
      .is("deleted_at", null);
    if (error) throw error;
  }
}
