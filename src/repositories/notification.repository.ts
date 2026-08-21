import "server-only";
import { prisma } from "@/lib/prisma";
import { getUser } from "@/lib/auth";
import type { EntityType, Prisma } from "@prisma/client";

/** Notifications for the current user. */
export async function listNotifications(limit = 50, unreadOnly = false) {
  const user = await getUser();
  if (!user) return [];

  const where: Prisma.NotificationWhereInput = {
    userId: user.id,
  };
  if (unreadOnly) where.isRead = false;

  const data = await prisma.notification.findMany({
    where,
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
  });

  return data.map((d) => ({
    id: d.id,
    organization_id: d.organizationId,
    user_id: d.userId,
    type: d.type,
    title: d.title,
    body: d.body,
    entity: d.entity,
    entity_id: d.entityId,
    action_url: d.actionUrl,
    is_read: d.isRead,
    read_at: d.readAt ? d.readAt.toISOString() : null,
    created_at: d.createdAt.toISOString(),
  }));
}

export type NotificationRow = Awaited<ReturnType<typeof listNotifications>>[number];

export async function unreadNotificationCount() {
  const user = await getUser();
  if (!user) return 0;

  const count = await prisma.notification.count({
    where: {
      userId: user.id,
      isRead: false,
    },
  });
  return count;
}

export async function listNotificationPreferences() {
  const user = await getUser();
  if (!user) return [];

  const data = await prisma.notificationPreference.findMany({
    where: {
      userId: user.id,
    },
    select: {
      type: true,
      inApp: true,
      email: true,
    },
  });

  return data.map((d) => ({
    type: d.type,
    in_app: d.inApp,
    email: d.email,
  }));
}

/**
 * Drop notifications that point at an entity which no longer exists.
 */
export async function deleteNotificationsForEntity(
  entity: EntityType | string,
  entityId: string,
) {
  await prisma.notification.deleteMany({
    where: {
      entity: entity as EntityType,
      entityId,
    },
  });
}
