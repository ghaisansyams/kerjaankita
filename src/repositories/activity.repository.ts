import "server-only";
import { prisma } from "@/lib/prisma";
import { getUser } from "@/lib/auth";
import type { EntityType, Prisma } from "@prisma/client";

/**
 * Append an activity entry to the audit trail.
 */
export async function logActivity(params: {
  organizationId: string;
  projectId: string | null;
  entity: EntityType | "organization" | "workspace" | "team" | "account" | "contact" | "project" | "milestone" | "task" | "mom";
  entityId: string;
  action: string;
  metadata?: Prisma.InputJsonValue;
  guestVisible?: boolean;
  actorId?: string | null;
}) {
  try {
    let actorId = params.actorId;
    if (actorId === undefined) {
      const user = await getUser();
      actorId = user?.id ?? null;
    }
    await prisma.activity.create({
      data: {
        organizationId: params.organizationId,
        projectId: params.projectId,
        entity: params.entity as EntityType,
        entityId: params.entityId,
        action: params.action,
        metadata: params.metadata ?? {},
        isGuestVisible: params.guestVisible ?? false,
        actorId,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[log_activity]", msg);
  }
}

/** All activity for a task (drives the Activity Timeline). */
export async function listTaskActivities(taskId: string, limit = 100) {
  const data = await prisma.activity.findMany({
    where: {
      entity: "task",
      entityId: taskId,
    },
    select: {
      id: true,
      action: true,
      metadata: true,
      actorId: true,
      createdAt: true,
      actor: {
        select: {
          id: true,
          fullName: true,
          avatarUrl: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
  });

  return data.map((d) => ({
    id: d.id,
    action: d.action,
    metadata: d.metadata,
    actor_id: d.actorId,
    created_at: d.createdAt.toISOString(),
    actor: d.actor
      ? {
          id: d.actor.id,
          full_name: d.actor.fullName,
          avatar_url: d.actor.avatarUrl,
        }
      : null,
  }));
}

export type ActivityRow = Awaited<ReturnType<typeof listTaskActivities>>[number];

/** Most recent org-wide activity for the dashboard feed. */
export async function listRecentActivities(orgId: string, limit = 12) {
  const data = await prisma.activity.findMany({
    where: {
      organizationId: orgId,
    },
    select: {
      id: true,
      action: true,
      entity: true,
      entityId: true,
      metadata: true,
      createdAt: true,
      actor: {
        select: {
          id: true,
          fullName: true,
          avatarUrl: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
  });

  return data.map((d) => ({
    id: d.id,
    action: d.action,
    entity: d.entity,
    entity_id: d.entityId,
    metadata: d.metadata,
    created_at: d.createdAt.toISOString(),
    actor: d.actor
      ? {
          id: d.actor.id,
          full_name: d.actor.fullName,
          avatar_url: d.actor.avatarUrl,
        }
      : null,
  }));
}

export type RecentActivityRow = Awaited<ReturnType<typeof listRecentActivities>>[number];

/**
 * Recent activity for a single project.
 */
export async function listProjectActivities(projectId: string, limit = 20) {
  const data = await prisma.activity.findMany({
    where: {
      projectId,
    },
    select: {
      id: true,
      action: true,
      entity: true,
      entityId: true,
      metadata: true,
      createdAt: true,
      actor: {
        select: {
          id: true,
          fullName: true,
          avatarUrl: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
  });

  return data.map((d) => ({
    id: d.id,
    action: d.action,
    entity: d.entity,
    entity_id: d.entityId,
    metadata: d.metadata,
    created_at: d.createdAt.toISOString(),
    actor: d.actor
      ? {
          id: d.actor.id,
          full_name: d.actor.fullName,
          avatar_url: d.actor.avatarUrl,
        }
      : null,
  }));
}
