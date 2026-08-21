import "server-only";
import { prisma } from "@/lib/prisma";
import type { EntityType } from "@prisma/client";

export async function listComments(entity: EntityType | string, entityId: string) {
  const data = await prisma.comment.findMany({
    where: {
      entity: entity as EntityType,
      entityId,
      deletedAt: null,
    },
    select: {
      id: true,
      body: true,
      authorId: true,
      parentId: true,
      isInternal: true,
      isEdited: true,
      createdAt: true,
      updatedAt: true,
      author: {
        select: {
          id: true,
          fullName: true,
          avatarUrl: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  return data.map((d) => ({
    id: d.id,
    body: d.body,
    author_id: d.authorId,
    parent_id: d.parentId,
    is_internal: d.isInternal,
    is_edited: d.isEdited,
    created_at: d.createdAt.toISOString(),
    updated_at: d.updatedAt.toISOString(),
    author: d.author
      ? {
          id: d.author.id,
          full_name: d.author.fullName,
          avatar_url: d.author.avatarUrl,
        }
      : null,
  }));
}

export type CommentRow = Awaited<ReturnType<typeof listComments>>[number];

export async function insertComment(values: {
  id?: string;
  organization_id?: string;
  organizationId?: string;
  project_id?: string | null;
  projectId?: string | null;
  entity: EntityType | string;
  entity_id?: string;
  entityId?: string;
  parent_id?: string | null;
  parentId?: string | null;
  author_id?: string | null;
  authorId?: string | null;
  body: string;
  is_internal?: boolean;
  isInternal?: boolean;
  mentions?: string[];
  created_by?: string | null;
  createdBy?: string | null;
}) {
  await prisma.comment.create({
    data: {
      id: values.id,
      organizationId: values.organizationId || values.organization_id!,
      projectId: values.projectId !== undefined ? values.projectId : values.project_id,
      entity: values.entity as EntityType,
      entityId: values.entityId || values.entity_id!,
      parentId: values.parentId !== undefined ? values.parentId : values.parent_id,
      authorId: values.authorId !== undefined ? values.authorId : values.author_id,
      body: values.body,
      isInternal: values.isInternal ?? values.is_internal ?? true,
      mentions: values.mentions ?? [],
      createdBy: values.createdBy || values.created_by,
    },
  });
}

export async function updateComment(id: string, body: string) {
  const data = await prisma.comment.update({
    where: { id },
    data: {
      body,
      isEdited: true,
    },
    select: {
      id: true,
      entityId: true,
    },
  });
  return {
    id: data.id,
    entity_id: data.entityId,
  };
}

export async function softDeleteComment(id: string, deletedBy: string) {
  const data = await prisma.comment.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      deletedBy,
    },
    select: {
      id: true,
      entityId: true,
    },
  });
  return {
    id: data.id,
    entity_id: data.entityId,
  };
}
