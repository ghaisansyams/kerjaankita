"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { updateProfile as updateProfileRow } from "@/repositories/profile.repository";
import {
  changePasswordSchema,
  updateAvatarSchema,
  updateEmailSchema,
  updateProfileSchema,
} from "@/schemas/profile.schema";
import { mapUnknownError } from "@/lib/errors";
import { toFieldErrors } from "@/lib/validation";
import { actionError, actionOk, type ActionResult } from "@/types/action";

export async function updateProfile(input: unknown): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("VALIDATION", "Please check the form.", toFieldErrors(parsed.error));
  }
  const d = parsed.data;
  try {
    await updateProfileRow(ctx.profile.id, {
      full_name: d.fullName,
      title: d.title || null,
      timezone: d.timezone,
      locale: d.locale,
      date_format: d.dateFormat,
    });
    revalidatePath("/settings/profile");
    return actionOk(undefined);
  } catch (e) {
    return mapUnknownError(e);
  }
}

export async function updateAvatar(input: unknown): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  const parsed = updateAvatarSchema.safeParse(input);
  if (!parsed.success) return actionError("VALIDATION", "Invalid image.");
  try {
    await updateProfileRow(ctx.profile.id, { avatar_url: parsed.data.avatarUrl });
    revalidatePath("/settings/profile");
    return actionOk(undefined);
  } catch (e) {
    return mapUnknownError(e);
  }
}

export async function changeEmail(input: unknown): Promise<ActionResult> {
  await requireOrgContext();
  const parsed = updateEmailSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("VALIDATION", "Please check the form.", toFieldErrors(parsed.error));
  }
  try {
    const supabase = await createClient();
    // Supabase sends a confirmation link to the new address before switching.
    const { error } = await supabase.auth.updateUser({ email: parsed.data.email });
    if (error) return actionError("VALIDATION", error.message);
    return actionOk(undefined);
  } catch (e) {
    return mapUnknownError(e);
  }
}

export async function changePassword(input: unknown): Promise<ActionResult> {
  await requireOrgContext();
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("VALIDATION", "Please check the form.", toFieldErrors(parsed.error));
  }
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    if (error) return actionError("VALIDATION", error.message);
    return actionOk(undefined);
  } catch (e) {
    return mapUnknownError(e);
  }
}
