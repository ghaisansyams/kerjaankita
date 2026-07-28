import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Statuses for a specific workflow (drives the status select and the board). */
export async function getWorkflowStatuses(workflowId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workflow_statuses")
    .select("id, name, color, category, position, is_initial, is_final, auto_progress")
    .eq("workflow_id", workflowId)
    .is("deleted_at", null)
    .order("position");
  if (error) throw error;
  return data;
}

/**
 * The task workflow a project's board uses — its own per-project workflow, or
 * the org default task workflow as a fallback for any not-yet-provisioned project.
 */
export async function getProjectWorkflowId(projectId: string, orgId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("projects")
    .select("workflow_id")
    .eq("id", projectId)
    .maybeSingle();
  if (data?.workflow_id) return data.workflow_id;
  return getDefaultTaskWorkflowId(orgId);
}

export type WorkflowStatus = Awaited<ReturnType<typeof getWorkflowStatuses>>[number];

/** The stable category of a status (used to detect done/blocked transitions). */
export async function getStatusCategory(statusId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("workflow_statuses")
    .select("category")
    .eq("id", statusId)
    .maybeSingle();
  return data?.category ?? null;
}

/** All task workflows in the org (for the workspace default-workflow picker). */
export async function listTaskWorkflows(orgId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workflows")
    .select("id, name, is_default")
    .eq("organization_id", orgId)
    .eq("entity", "task")
    .is("deleted_at", null)
    .order("is_default", { ascending: false })
    .order("name");
  if (error) throw error;
  return data ?? [];
}

/** The organization's default task workflow id (used by the create form). */
export async function getDefaultTaskWorkflowId(orgId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("workflows")
    .select("id")
    .eq("organization_id", orgId)
    .eq("entity", "task")
    .eq("is_default", true)
    .is("deleted_at", null)
    .maybeSingle();
  return data?.id ?? null;
}
