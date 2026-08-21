"use server";

import { requireOrgContext } from "@/lib/auth";
import { PERMISSIONS } from "@/constants";
import { checkPermission } from "@/repositories/permission.repository";
import { revalidatePath } from "next/cache";
import {
  attachmentIdSchema,
  attachmentUrlSchema,
  registerAttachmentSchema,
  requestUploadSchema,
  shareAttachmentSchema,
} from "@/schemas/attachment.schema";
import * as attachmentRepo from "@/repositories/attachment.repository";
import { getTaskRef } from "@/repositories/task.repository";
import { mapUnknownError } from "@/lib/errors";
import { toFieldErrors } from "@/lib/validation";
import { actionError, actionOk, type ActionResult } from "@/types/action";

/** Authorize an upload and return the tenant-scoped storage path. */
export async function requestUpload(
  input: unknown,
): Promise<ActionResult<{ bucket: string; path: string }>> {
  const ctx = await requireOrgContext();
  const parsed = requestUploadSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("VALIDATION", "That file can't be uploaded.", toFieldErrors(parsed.error));
  }
  const { projectId, fileName } = parsed.data;
  if (
    !(await checkPermission(ctx.organization.id, PERMISSIONS.ATTACHMENT_UPLOAD, {
      projectId,
    }))
  ) {
    return actionError("FORBIDDEN", "You can't upload files to this project.");
  }
  const safe = fileName.replace(/[^\w.\-]+/g, "_").slice(0, 200) || "file";
  const path = `${ctx.organization.id}/${projectId}/${crypto.randomUUID()}-${safe}`;
  return actionOk({ bucket: "attachments", path });
}

/** Persist the attachment metadata after the client uploads the bytes. */
export async function registerAttachment(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireOrgContext();
  const parsed = registerAttachmentSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("VALIDATION", "Invalid request.", toFieldErrors(parsed.error));
  }
  const { projectId, taskId, path, fileName, fileType, fileSize } = parsed.data;
  try {
    const ref = await getTaskRef(taskId);
    if (!ref || ref.project_id !== projectId) {
      return actionError("NOT_FOUND", "Task not found.");
    }
    const id = crypto.randomUUID();
    await attachmentRepo.insertAttachment({
      id,
      organizationId: ref.organization_id,
      projectId,
      entity: "task",
      entityId: taskId,
      bucket: "attachments",
      path,
      fileName,
      fileType,
      fileSize,
      uploadedBy: ctx.profile.id,
    });
    return actionOk({ id });
  } catch (e) {
    return mapUnknownError(e);
  }
}

/**
 * Short-lived signed URL for one attachment, for previewing or downloading.
 */
export async function getDownloadUrl(
  input: unknown,
): Promise<ActionResult<{ url: string }>> {
  await requireOrgContext();
  const parsed = attachmentUrlSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("VALIDATION", "Invalid request.");
  }
  try {
    const att = await attachmentRepo.getAttachment(parsed.data.id);
    if (!att) return actionError("NOT_FOUND", "File not found.");
    // Return path or direct URL
    return actionOk({ url: att.path });
  } catch (e) {
    return mapUnknownError(e);
  }
}

/** Share (or unshare) a file with the project's guests — manager action. */
export async function shareAttachment(input: unknown): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  const parsed = shareAttachmentSchema.safeParse(input);
  if (!parsed.success) return actionError("VALIDATION", "Invalid request.");
  const { id, projectId, shared } = parsed.data;
  if (
    !(await checkPermission(ctx.organization.id, PERMISSIONS.ATTACHMENT_MANAGE, { projectId }))
  ) {
    return actionError("FORBIDDEN", "You can't change file sharing.");
  }
  try {
    const updated = await attachmentRepo.setAttachmentGuestVisible(id, shared);
    if (!updated) return actionError("NOT_FOUND", "File not found.");
    revalidatePath(`/projects/${projectId}/tasks`);
    return actionOk(undefined);
  } catch (e) {
    return mapUnknownError(e);
  }
}

export async function deleteAttachment(input: unknown): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  const parsed = attachmentIdSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("VALIDATION", "Invalid request.");
  }
  try {
    const removed = await attachmentRepo.softDeleteAttachment(parsed.data.id, ctx.profile.id);
    if (!removed) return actionError("FORBIDDEN", "You can't delete this file.");
    return actionOk(undefined);
  } catch (e) {
    return mapUnknownError(e);
  }
}
