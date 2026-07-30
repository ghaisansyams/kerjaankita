import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// roadmaps / modules / import_jobs are not in the generated Database types yet,
// so we use a permissively-typed client (same pattern as the MOM module).
async function db(): Promise<SupabaseClient> {
  return (await createClient()) as unknown as SupabaseClient;
}
function admin(): SupabaseClient {
  return createAdminClient() as unknown as SupabaseClient;
}

// ----- roadmaps -----------------------------------------------------------
export async function insertRoadmap(values: Record<string, unknown>): Promise<string> {
  const supabase = await db();
  const { data, error } = await supabase.from("roadmaps").insert(values).select("id").single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function listRoadmaps(projectId: string) {
  const supabase = await db();
  const { data, error } = await supabase
    .from("roadmaps")
    .select("id, name, description, color, position")
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .order("position", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// ----- modules ------------------------------------------------------------
export async function insertModule(values: Record<string, unknown>): Promise<string> {
  const supabase = await db();
  const { data, error } = await supabase.from("modules").insert(values).select("id").single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function listModules(projectId: string) {
  const supabase = await db();
  const { data, error } = await supabase
    .from("modules")
    .select("id, roadmap_id, name, description, position")
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .order("position", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// ----- import_jobs --------------------------------------------------------
export async function insertImportJob(values: Record<string, unknown>): Promise<string> {
  const supabase = await db();
  const { data, error } = await supabase.from("import_jobs").insert(values).select("id").single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function updateImportJob(id: string, patch: Record<string, unknown>) {
  const supabase = await db();
  const { error } = await supabase
    .from("import_jobs")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function getImportJobRow(id: string) {
  const supabase = await db();
  const { data, error } = await supabase.from("import_jobs").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Record<string, unknown> | null;
}

/** Admin-client insert used by the pipeline to persist the attachment rows for
 *  extracted images (bypasses RLS after the action has authorized the caller). */
export async function insertAttachmentAdmin(values: Record<string, unknown>) {
  const { error } = await admin().from("attachments").insert(values);
  if (error) throw error;
}

/** Existing (non-deleted) task titles in a project — for duplicate detection. */
export async function listTaskTitles(projectId: string): Promise<{ id: string; title: string }[]> {
  const supabase = await db();
  const { data, error } = await supabase
    .from("tasks")
    .select("id, title")
    .eq("project_id", projectId)
    .is("deleted_at", null);
  if (error) throw error;
  return (data as { id: string; title: string }[]) ?? [];
}

// ----- project / workflow helpers (for creating a project on commit) ------
export async function getDefaultWorkspaceId(orgId: string): Promise<string | null> {
  const supabase = await db();
  const { data } = await supabase
    .from("workspaces")
    .select("id")
    .eq("organization_id", orgId)
    .eq("is_default", true)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

/** Create the project via admin client (caller must authorize project.create
 *  first). The 0018 provision trigger clones the default workflow. */
export async function insertProjectRow(values: Record<string, unknown>): Promise<void> {
  const { error } = await admin().from("projects").insert(values);
  if (error) throw error;
}

export async function getInitialStatusId(projectId: string): Promise<string | null> {
  const supabase = await db();
  const { data: proj } = await supabase
    .from("projects")
    .select("workflow_id")
    .eq("id", projectId)
    .maybeSingle();
  const workflowId = (proj as { workflow_id: string | null } | null)?.workflow_id;
  if (!workflowId) return null;
  const { data } = await supabase
    .from("workflow_statuses")
    .select("id")
    .eq("workflow_id", workflowId)
    .eq("is_initial", true)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

/** Task insert via the permissive client so we can set the new
 *  roadmap_id/module_id columns (not in the generated types). RLS + the task
 *  triggers (number, workflow, initial status, activity) still apply. */
export async function insertTaskRow(values: Record<string, unknown>): Promise<string> {
  const supabase = await db();
  const { data, error } = await supabase.from("tasks").insert(values).select("id").single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function insertChecklistItems(rows: Record<string, unknown>[]): Promise<void> {
  if (!rows.length) return;
  const supabase = await db();
  const { error } = await supabase.from("task_checklist_items").insert(rows);
  if (error) throw error;
}
