"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  markNotificationReadSchema,
  setNotificationPreferenceSchema,
} from "@/schemas/notification.schema";
import { listNotifications } from "@/repositories/notification.repository";
import { mapUnknownError } from "@/lib/errors";
import { toFieldErrors } from "@/lib/validation";
import { actionError, actionOk, type ActionResult } from "@/types/action";

export async function fetchNotifications(limit = 15, unreadOnly = false) {
  return await listNotifications(limit, unreadOnly);
}

export async function markNotificationRead(input: unknown): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  const parsed = markNotificationReadSchema.safeParse(input);
  if (!parsed.success) return actionError("VALIDATION", "Invalid request.");
  try {
    await prisma.notification.updateMany({
      where: {
        id: parsed.data.id,
        userId: ctx.profile.id,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
    revalidatePath("/notifications");
    return actionOk(undefined);
  } catch (e) {
    return mapUnknownError(e);
  }
}

export async function markAllNotificationsRead(): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  try {
    await prisma.notification.updateMany({
      where: {
        userId: ctx.profile.id,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
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
    await prisma.notificationPreference.upsert({
      where: {
        organizationId_userId_type: {
          organizationId: ctx.organization.id,
          userId: ctx.profile.id,
          type,
        },
      },
      update: {
        inApp,
        email: email ?? false,
      },
      create: {
        organizationId: ctx.organization.id,
        userId: ctx.profile.id,
        type,
        inApp,
        email: email ?? false,
      },
    });
    revalidatePath("/notifications");
    return actionOk(undefined);
  } catch (e) {
    return mapUnknownError(e);
  }
}
