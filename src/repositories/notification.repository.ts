import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DbEnums } from "@/types/database.types";

/** Notifications for the current user (RLS scopes to auth.uid()). */
export async function listNotifications(limit = 50, unreadOnly = false) {
  const supabase = await createClient();
  let q = supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (unreadOnly) q = q.eq("is_read", false);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export type NotificationRow = Awaited<ReturnType<typeof listNotifications>>[number];

export async function unreadNotificationCount() {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("is_read", false);
  if (error) throw error;
  return count ?? 0;
}

export async function listNotificationPreferences() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notification_preferences")
    .select("type, in_app, email");
  if (error) throw error;
  return data ?? [];
}

/**
 * Drop notifications that point at an entity which no longer exists, so the
 * tray stops offering links that resolve to nothing.
 *
 * Uses the service role on purpose: the RLS delete policy is
 * `user_id = auth.uid()`, but these rows belong to whoever was notified, not to
 * whoever did the deleting.
 */
export async function deleteNotificationsForEntity(
  entity: DbEnums<"entity_type">,
  entityId: string,
) {
  const admin = createAdminClient();
  await admin.from("notifications").delete().eq("entity", entity).eq("entity_id", entityId);
}
