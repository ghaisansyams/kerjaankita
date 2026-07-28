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

/** Tasks completed on/after `fromIso` (start of the current week). */
export async function countCompletedSince(orgId: string, fromIso: string) {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("tasks")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .is("deleted_at", null)
    .gte("completed_at", fromIso);
  if (error) throw error;
  return count ?? 0;
}

/** The current user's open assigned tasks, for the "My Tasks" widget (RLS-scoped). */
export async function listMyOpenTasks(orgId: string, userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select(
      `id, number, title, due_date, progress, project_id,
       status:workflow_statuses(name, color, category),
       project:projects(name)`,
    )
    .eq("organization_id", orgId)
    .eq("assignee_id", userId)
    .is("deleted_at", null)
    .is("completed_at", null)
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(60);
  if (error) throw error;
  return data ?? [];
}

/** Open task load per member (assignee), for the Team Workload widget. */
export async function listTeamWorkload(orgId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("assignee_id, assignee:profiles!tasks_assignee_id_fkey(full_name, avatar_url)")
    .eq("organization_id", orgId)
    .is("deleted_at", null)
    .is("completed_at", null)
    .not("assignee_id", "is", null);
  if (error) throw error;
  return data ?? [];
}
