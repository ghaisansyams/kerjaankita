import "server-only";
import { createClient } from "@/lib/supabase/server";

export type ScheduleFilters = {
  workspaceId?: string;
  projectId?: string;
  assigneeId?: string;
};

const TIMELINE_SELECT = `
  id, title, start_date, due_date, progress, is_blocked, priority, estimated_hours,
  assignee_id, project_id,
  project:projects!inner(id, name, color, workspace_id),
  assignee:profiles!tasks_assignee_id_fkey(id, full_name, avatar_url),
  status:workflow_statuses(category)
`;

/**
 * Org-wide tasks that have at least a start or a due date, for the Timeline.
 * `!inner` on project lets a workspace filter narrow the parent rows. RLS keeps
 * the result to tasks the caller may read.
 */
export async function listTimelineTasks(orgId: string, filters: ScheduleFilters = {}) {
  const supabase = await createClient();
  let q = supabase
    .from("tasks")
    .select(TIMELINE_SELECT)
    .eq("organization_id", orgId)
    .is("deleted_at", null)
    .or("start_date.not.is.null,due_date.not.is.null");

  if (filters.projectId) q = q.eq("project_id", filters.projectId);
  if (filters.assigneeId) q = q.eq("assignee_id", filters.assigneeId);
  if (filters.workspaceId) q = q.eq("project.workspace_id", filters.workspaceId);

  const { data, error } = await q;
  if (error) throw error;
  return data;
}

const CALENDAR_TASK_SELECT = `
  id, title, due_date, is_blocked, priority, project_id, assignee_id,
  project:projects!inner(id, name, color, workspace_id),
  status:workflow_statuses(category)
`;

/** Tasks with a due date inside [from, to] (inclusive), for the Calendar. */
export async function listCalendarTasks(
  orgId: string,
  from: string,
  to: string,
  filters: ScheduleFilters = {},
) {
  const supabase = await createClient();
  let q = supabase
    .from("tasks")
    .select(CALENDAR_TASK_SELECT)
    .eq("organization_id", orgId)
    .is("deleted_at", null)
    .not("due_date", "is", null)
    .gte("due_date", from)
    .lte("due_date", to);

  if (filters.projectId) q = q.eq("project_id", filters.projectId);
  if (filters.assigneeId) q = q.eq("assignee_id", filters.assigneeId);
  if (filters.workspaceId) q = q.eq("project.workspace_id", filters.workspaceId);

  const { data, error } = await q;
  if (error) throw error;
  return data;
}

/** Milestones with a due date inside [from, to] (inclusive), for the Calendar. */
export async function listCalendarMilestones(
  orgId: string,
  from: string,
  to: string,
  filters: ScheduleFilters = {},
) {
  const supabase = await createClient();
  let q = supabase
    .from("milestones")
    .select(`id, name, due_date, achieved_at, project_id, project:projects!inner(id, name, color, workspace_id)`)
    .eq("organization_id", orgId)
    .is("deleted_at", null)
    .not("due_date", "is", null)
    .gte("due_date", from)
    .lte("due_date", to);

  if (filters.projectId) q = q.eq("project_id", filters.projectId);
  if (filters.workspaceId) q = q.eq("project.workspace_id", filters.workspaceId);

  const { data, error } = await q;
  if (error) throw error;
  return data;
}

/** Next unachieved milestones due on/after `from`, for the dashboard widget. */
export async function listUpcomingMilestones(orgId: string, from: string, limit = 6) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("milestones")
    .select("id, name, due_date, project_id, project:projects!inner(name, color)")
    .eq("organization_id", orgId)
    .is("deleted_at", null)
    .is("achieved_at", null)
    .gte("due_date", from)
    .order("due_date", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
