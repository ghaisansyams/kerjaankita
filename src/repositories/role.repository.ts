import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { DbEnums } from "@/types/database.types";

/** Roles available for a given scope: system roles + the tenant's own. */
export async function listRoles(
  orgId: string,
  scope: DbEnums<"role_scope">,
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("roles")
    .select("id, key, name, description, rank, organization_id")
    .eq("scope", scope)
    .or(`organization_id.is.null,organization_id.eq.${orgId}`)
    .is("deleted_at", null)
    .order("rank");
  if (error) throw error;
  return data;
}

export type RoleOption = Awaited<ReturnType<typeof listRoles>>[number];
