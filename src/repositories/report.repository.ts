import "server-only";
import { createClient } from "@/lib/supabase/server";

export type ReportScope = { workspaceId?: string; projectId?: string };

export async function reportProjects(orgId: string, scope: ReportScope = {}) {
  const supabase = await createClient();
  let q = supabase
    .from("projects")
    .select("id, name, progress, start_date, end_date, is_archived, workspace_id, workspace:workspaces(name)")
    .eq("organization_id", orgId)
    .is("deleted_at", null);
  if (scope.projectId) q = q.eq("id", scope.projectId);
  if (scope.workspaceId) q = q.eq("workspace_id", scope.workspaceId);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function reportTasks(orgId: string, scope: ReportScope = {}) {
  const supabase = await createClient();
  let q = supabase
    .from("tasks")
    .select(
      `id, title, due_date, completed_at, estimated_hours, priority, assignee_id, project_id,
       project:projects!inner(name, workspace_id),
       assignee:profiles!tasks_assignee_id_fkey(full_name),
       status:workflow_statuses(category)`,
    )
    .eq("organization_id", orgId)
    .is("deleted_at", null);
  if (scope.projectId) q = q.eq("project_id", scope.projectId);
  if (scope.workspaceId) q = q.eq("project.workspace_id", scope.workspaceId);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function reportMilestones(orgId: string, scope: ReportScope = {}) {
  const supabase = await createClient();
  let q = supabase
    .from("milestones")
    .select("id, name, due_date, achieved_at, project_id, project:projects!inner(workspace_id)")
    .eq("organization_id", orgId)
    .is("deleted_at", null);
  if (scope.projectId) q = q.eq("project_id", scope.projectId);
  if (scope.workspaceId) q = q.eq("project.workspace_id", scope.workspaceId);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}
