"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
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
  const ctx = await requireOrgContext();
  const parsed = updateEmailSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("VALIDATION", "Please check the form.", toFieldErrors(parsed.error));
  }
  try {
    await prisma.profile.update({
      where: { id: ctx.profile.id },
      data: { email: parsed.data.email.toLowerCase().trim() },
    });
    revalidatePath("/settings/profile");
    return actionOk(undefined);
  } catch (e) {
    return mapUnknownError(e);
  }
}

export async function changePassword(input: unknown): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("VALIDATION", "Please check the form.", toFieldErrors(parsed.error));
  }
  try {
    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    await prisma.profile.update({
      where: { id: ctx.profile.id },
      data: { passwordHash },
    });
    revalidatePath("/settings/profile");
    return actionOk(undefined);
  } catch (e) {
    return mapUnknownError(e);
  }
}
