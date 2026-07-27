import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function listWorkspaces(orgId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspaces")
    .select("id, name, color, is_default")
    .eq("organization_id", orgId)
    .eq("is_archived", false)
    .is("deleted_at", null)
    .order("is_default", { ascending: false })
    .order("name");
  if (error) throw error;
  return data;
}

export type WorkspaceOption = Awaited<ReturnType<typeof listWorkspaces>>[number];

/** Full record for the workspace settings screen. */
export async function getWorkspace(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspaces")
    .select("id, name, description, color, icon, logo_url, default_workflow_id, is_default")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateWorkspace(
  id: string,
  patch: import("@/types/database.types").TablesUpdate<"workspaces">,
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspaces")
    .update(patch)
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return data;
}
