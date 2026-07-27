import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Lean project rows for health/progress rollups (RLS-scoped). */
export async function listProjectHealthRows(orgId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id, progress, start_date, end_date, is_archived")
    .eq("organization_id", orgId)
    .is("deleted_at", null);
  if (error) throw error;
  return data ?? [];
}

export type ProjectHealthRow = Awaited<ReturnType<typeof listProjectHealthRows>>[number];

export async function countActiveMembers(orgId: string) {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("organization_members")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("status", "active");
  if (error) throw error;
  return count ?? 0;
}

/** Open (not completed, not deleted) task counts by due-date window. */
export async function getTaskDueCounts(orgId: string, todayIso: string, weekEndIso: string) {
  const supabase = await createClient();
  const openTasks = () =>
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .is("completed_at", null);

  const [dueToday, dueThisWeek, overdue, openAssigned] = await Promise.all([
    openTasks().eq("due_date", todayIso),
    openTasks().gte("due_date", todayIso).lte("due_date", weekEndIso),
    openTasks().lt("due_date", todayIso),
    openTasks().not("assignee_id", "is", null),
  ]);

  for (const r of [dueToday, dueThisWeek, overdue, openAssigned]) {
    if (r.error) throw r.error;
  }
  return {
    dueToday: dueToday.count ?? 0,
    dueThisWeek: dueThisWeek.count ?? 0,
    overdue: overdue.count ?? 0,
    openAssigned: openAssigned.count ?? 0,
  };
}
