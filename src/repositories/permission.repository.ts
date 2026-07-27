import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { PermissionKey } from "@/constants";

/**
 * Authoritative, scope-aware permission check (mirrors the RLS `has_permission`).
 * Use for project/workspace-scoped permissions so project-scoped roles (e.g. a
 * Project Lead) are recognised, not just organization-role grants.
 */
export async function checkPermission(
  orgId: string,
  permission: PermissionKey,
  scope?: { workspaceId?: string; projectId?: string },
): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("has_permission", {
    p_org: orgId,
    p_permission: permission,
    p_workspace: scope?.workspaceId,
    p_project: scope?.projectId,
  });
  return data ?? false;
}
