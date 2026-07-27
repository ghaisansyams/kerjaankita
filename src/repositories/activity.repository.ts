import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { DbEnums, Json } from "@/types/database.types";

/**
 * Append an activity entry via the SECURITY DEFINER `log_activity` function.
 * The activities table has no INSERT policy — only this function (and triggers)
 * may write to the audit trail.
 */
export async function logActivity(params: {
  organizationId: string;
  projectId: string | null;
  entity: DbEnums<"entity_type">;
  entityId: string;
  action: string;
  metadata?: Json;
  guestVisible?: boolean;
}) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("log_activity", {
    p_org: params.organizationId,
    p_project: params.projectId,
    p_entity: params.entity,
    p_entity_id: params.entityId,
    p_action: params.action,
    p_metadata: (params.metadata ?? {}) as Json,
    p_guest_visible: params.guestVisible ?? false,
  });
  // Audit failures must never break the user's action — log and move on.
  if (error) console.error("[log_activity]", error.message);
}

/** All activity for a task (drives the Activity Timeline). RLS-scoped. */
export async function listTaskActivities(taskId: string, limit = 100) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activities")
    .select(
      "id, action, metadata, actor_id, created_at, actor:profiles(id, full_name, avatar_url)",
    )
    .eq("entity", "task")
    .eq("entity_id", taskId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export type ActivityRow = Awaited<ReturnType<typeof listTaskActivities>>[number];

/** Most recent org-wide activity for the dashboard feed (RLS-scoped). */
export async function listRecentActivities(orgId: string, limit = 12) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activities")
    .select(
      "id, action, entity, entity_id, metadata, created_at, actor:profiles(id, full_name, avatar_url)",
    )
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export type RecentActivityRow = Awaited<ReturnType<typeof listRecentActivities>>[number];

/**
 * Recent activity for a single project (RLS-scoped). Guests receive only the
 * `is_guest_visible` subset, so this doubles as the portal's "recent updates".
 */
export async function listProjectActivities(projectId: string, limit = 20) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activities")
    .select("id, action, entity, entity_id, metadata, created_at, actor:profiles(id, full_name, avatar_url)")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
