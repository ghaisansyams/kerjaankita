"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  markNotificationReadSchema,
  setNotificationPreferenceSchema,
} from "@/schemas/notification.schema";
import { mapUnknownError } from "@/lib/errors";
import { toFieldErrors } from "@/lib/validation";
import { actionError, actionOk, type ActionResult } from "@/types/action";

export async function markNotificationRead(input: unknown): Promise<ActionResult> {
  await requireOrgContext();
  const parsed = markNotificationReadSchema.safeParse(input);
  if (!parsed.success) return actionError("VALIDATION", "Invalid request.");
  try {
    const supabase = await createClient();
    // RLS restricts the update to the caller's own notifications.
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("id", parsed.data.id);
    if (error) throw error;
    revalidatePath("/notifications");
    return actionOk(undefined);
  } catch (e) {
    return mapUnknownError(e);
  }
}

export async function markAllNotificationsRead(): Promise<ActionResult> {
  await requireOrgContext();
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("is_read", false);
    if (error) throw error;
    revalidatePath("/notifications");
    return actionOk(undefined);
  } catch (e) {
    return mapUnknownError(e);
  }
}

export async function setNotificationPreference(input: unknown): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  const parsed = setNotificationPreferenceSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("VALIDATION", "Invalid request.", toFieldErrors(parsed.error));
  }
  const { type, inApp, email } = parsed.data;
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("notification_preferences").upsert(
      {
        organization_id: ctx.organization.id,
        user_id: ctx.profile.id,
        type,
        in_app: inApp,
        email: email ?? false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,user_id,type" },
    );
    if (error) throw error;
    revalidatePath("/notifications");
    return actionOk(undefined);
  } catch (e) {
    return mapUnknownError(e);
  }
}
