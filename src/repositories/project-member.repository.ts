import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { TablesInsert } from "@/types/database.types";

export async function listProjectMembers(projectId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_members")
    .select(
      `id, user_id, role_id, allocation_pct, created_at,
       profile:profiles!project_members_user_id_fkey(id, full_name, avatar_url, email),
       role:roles(id, name, key)`,
    )
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .order("created_at");
  if (error) throw error;
  return data;
}

export type ProjectMemberRow = Awaited<
  ReturnType<typeof listProjectMembers>
>[number];

export async function insertProjectMember(
  values: TablesInsert<"project_members">,
) {
  const supabase = await createClient();
  const { error } = await supabase.from("project_members").insert(values);
  if (error) throw error;
}

export async function updateProjectMemberRole(memberId: string, roleId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_members")
    .update({ role_id: roleId })
    .eq("id", memberId)
    .is("deleted_at", null)
    .select("id, project_id")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function softDeleteProjectMember(memberId: string, deletedBy: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_members")
    .update({ deleted_at: new Date().toISOString(), deleted_by: deletedBy })
    .eq("id", memberId)
    .is("deleted_at", null)
    .select("id, project_id, user_id")
    .maybeSingle();
  if (error) throw error;
  return data;
}
