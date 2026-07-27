import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { TablesInsert, TablesUpdate } from "@/types/database.types";

const LIST_SELECT = `
  id, name, key, description, color, status_id, workspace_id, account_id,
  owner_id, visibility, start_date, end_date, progress, is_archived,
  created_at, updated_at,
  account:accounts(id, name),
  owner:profiles!projects_owner_id_fkey(id, full_name, avatar_url),
  status:workflow_statuses(id, name, color, category),
  workspace:workspaces(id, name, color)
`;

export type ProjectListFilters = {
  search?: string;
  workspaceId?: string;
  includeArchived?: boolean;
};

export async function listProjects(orgId: string, filters: ProjectListFilters = {}) {
  const supabase = await createClient();
  let query = supabase
    .from("projects")
    .select(LIST_SELECT)
    .eq("organization_id", orgId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (!filters.includeArchived) query = query.eq("is_archived", false);
  if (filters.workspaceId) query = query.eq("workspace_id", filters.workspaceId);
  if (filters.search) query = query.ilike("name", `%${filters.search}%`);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getProject(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select(
      `${LIST_SELECT}, created_by, updated_at,
       creator:profiles!projects_created_by_fkey(id, full_name, avatar_url)`,
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export type ProjectDetail = NonNullable<Awaited<ReturnType<typeof getProject>>>;
export type ProjectListItem = Awaited<ReturnType<typeof listProjects>>[number];

export async function insertProject(values: TablesInsert<"projects">) {
  const supabase = await createClient();
  // No RETURNING: the id is supplied by the caller, so we don't couple creation
  // to the SELECT policy. A thrown error means RLS/constraints rejected it.
  const { error } = await supabase.from("projects").insert(values);
  if (error) throw error;
}

export async function updateProject(id: string, patch: TablesUpdate<"projects">) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .update(patch)
    .eq("id", id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return data; // null → RLS blocked or not found
}

export async function setProjectArchived(id: string, archived: boolean) {
  return updateProject(id, { is_archived: archived });
}

export async function softDeleteProject(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("soft_delete_project", { p_project: id });
  if (error) throw error;
}
