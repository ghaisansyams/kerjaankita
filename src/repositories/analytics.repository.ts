import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Lean task rows for analytics time-series (RLS-scoped). */
export async function analyticsTasks(orgId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select(
      `created_at, completed_at, due_date, assignee_id,
       assignee:profiles!tasks_assignee_id_fkey(full_name),
       status:workflow_statuses(category)`,
    )
    .eq("organization_id", orgId)
    .is("deleted_at", null);
  if (error) throw error;
  return data ?? [];
}
