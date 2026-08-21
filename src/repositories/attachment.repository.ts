import "server-only";
import { prisma } from "@/lib/prisma";
import type { EntityType } from "@prisma/client";

export async function listAttachments(entity: EntityType | string, entityId: string) {
  const data = await prisma.attachment.findMany({
    where: {
      entity: entity as EntityType,
      entityId,
      deletedAt: null,
    },
    select: {
      id: true,
      path: true,
      fileName: true,
      fileType: true,
      fileSize: true,
      isGuestVisible: true,
      uploadedBy: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  // Get uploaders
  const uploaderIds = data.map((d) => d.uploadedBy).filter(Boolean) as string[];
  const uploaders = uploaderIds.length > 0
    ? await prisma.profile.findMany({
        where: { id: { in: uploaderIds } },
        select: { id: true, fullName: true },
      })
    : [];
  const uploaderMap = new Map(uploaders.map((u) => [u.id, u]));

  return data.map((d) => ({
    id: d.id,
    path: d.path,
    file_name: d.fileName,
    file_type: d.fileType,
    file_size: d.fileSize ? Number(d.fileSize) : null,
    is_guest_visible: d.isGuestVisible,
    uploaded_by: d.uploadedBy,
    created_at: d.createdAt.toISOString(),
    uploader: d.uploadedBy && uploaderMap.has(d.uploadedBy)
      ? {
          id: uploaderMap.get(d.uploadedBy)!.id,
          full_name: uploaderMap.get(d.uploadedBy)!.fullName,
        }
      : null,
  }));
}

export type AttachmentRow = Awaited<ReturnType<typeof listAttachments>>[number];

/**
 * All attachments in a project.
 */
export async function listProjectAttachments(projectId: string) {
  const data = await prisma.attachment.findMany({
    where: {
      projectId,
      deletedAt: null,
    },
    select: {
      id: true,
      entity: true,
      entityId: true,
      fileName: true,
      fileType: true,
      fileSize: true,
      isGuestVisible: true,
      uploadedBy: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const uploaderIds = data.map((d) => d.uploadedBy).filter(Boolean) as string[];
  const uploaders = uploaderIds.length > 0
    ? await prisma.profile.findMany({
        where: { id: { in: uploaderIds } },
        select: { id: true, fullName: true },
      })
    : [];
  const uploaderMap = new Map(uploaders.map((u) => [u.id, u]));

  return data.map((d) => ({
    id: d.id,
    entity: d.entity,
    entity_id: d.entityId,
    file_name: d.fileName,
    file_type: d.fileType,
    file_size: d.fileSize ? Number(d.fileSize) : null,
    is_guest_visible: d.isGuestVisible,
    uploaded_by: d.uploadedBy,
    created_at: d.createdAt.toISOString(),
    uploader: d.uploadedBy && uploaderMap.has(d.uploadedBy)
      ? {
          id: uploaderMap.get(d.uploadedBy)!.id,
          full_name: uploaderMap.get(d.uploadedBy)!.fullName,
        }
      : null,
  }));
}

export async function insertAttachment(values: {
  id?: string;
  organization_id?: string;
  organizationId?: string;
  project_id?: string | null;
  projectId?: string | null;
  entity: EntityType | string;
  entity_id?: string;
  entityId?: string;
  bucket?: string;
  path: string;
  file_name?: string;
  fileName?: string;
  file_type?: string | null;
  fileType?: string | null;
  file_size?: number | bigint | null;
  fileSize?: number | bigint | null;
  checksum?: string | null;
  is_guest_visible?: boolean;
  isGuestVisible?: boolean;
  uploaded_by?: string | null;
  uploadedBy?: string | null;
}) {
  await prisma.attachment.create({
    data: {
      id: values.id,
      organizationId: values.organizationId || values.organization_id!,
      projectId: values.projectId !== undefined ? values.projectId : values.project_id,
      entity: (values.entityId || values.entity_id ? values.entity : "task") as EntityType,
      entityId: values.entityId || values.entity_id!,
      bucket: values.bucket || "attachments",
      path: values.path,
      fileName: values.fileName || values.file_name!,
      fileType: values.fileType !== undefined ? values.fileType : values.file_type,
      fileSize: values.fileSize !== undefined ? (values.fileSize ? BigInt(values.fileSize) : null) : (values.file_size ? BigInt(values.file_size) : null),
      checksum: values.checksum,
      isGuestVisible: values.isGuestVisible ?? values.is_guest_visible ?? false,
      uploadedBy: values.uploadedBy || values.uploaded_by,
    },
  });
}

export async function getAttachment(id: string) {
  const data = await prisma.attachment.findFirst({
    where: {
      id,
      deletedAt: null,
    },
    select: {
      id: true,
      bucket: true,
      path: true,
      fileName: true,
      uploadedBy: true,
    },
  });
  if (!data) return null;
  return {
    id: data.id,
    bucket: data.bucket,
    path: data.path,
    file_name: data.fileName,
    uploaded_by: data.uploadedBy,
  };
}

/** Toggle whether a file is visible to guests. */
export async function setAttachmentGuestVisible(id: string, visible: boolean) {
  const data = await prisma.attachment.update({
    where: { id },
    data: { isGuestVisible: visible },
    select: {
      id: true,
      projectId: true,
    },
  });
  return {
    id: data.id,
    project_id: data.projectId,
  };
}

export async function softDeleteAttachment(id: string, deletedBy: string) {
  const data = await prisma.attachment.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      deletedBy,
    },
    select: {
      id: true,
      path: true,
      bucket: true,
    },
  });
  return {
    id: data.id,
    path: data.path,
    bucket: data.bucket,
  };
}
