import "server-only";
import { createClient } from "@/lib/supabase/server";

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
