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
import { createAdminClient } from "@/lib/supabase/admin";
import { mapUnknownError } from "@/lib/errors";
import { toFieldErrors } from "@/lib/validation";
import { actionError, actionOk, type ActionResult } from "@/types/action";
import type { TablesInsert } from "@/types/database.types";

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
  // First path segment = organization id → drives the storage RLS tenant check.
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
    const values: TablesInsert<"attachments"> = {
      id,
      organization_id: ref.organization_id,
      project_id: projectId,
      entity: "task",
      entity_id: taskId,
      bucket: "attachments",
      path,
      file_name: fileName,
      file_type: fileType,
      file_size: fileSize,
      uploaded_by: ctx.profile.id,
    };
    // attachment.uploaded activity fires from a trigger.
    await attachmentRepo.insertAttachment(values);
    return actionOk({ id });
  } catch (e) {
    return mapUnknownError(e);
  }
}

/**
 * Short-lived signed URL for one attachment, for previewing or downloading.
 *
 * Authorization is the RLS-scoped read below — getAttachment returns null when
 * the caller can't see the file, which for a portal guest means anything not
 * flagged guest-visible. The `download` flag only decides the
 * Content-Disposition header, so a preview can never reach a file a download
 * couldn't. The bucket stays private; nothing here mints a public URL.
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
    const att = await attachmentRepo.getAttachment(parsed.data.id); // null if not visible
    if (!att) return actionError("NOT_FOUND", "File not found.");
    const admin = createAdminClient();
    const { data, error } = await admin.storage
      .from(att.bucket)
      // Longer than the 60s a click-through needs: a preview stays open while
      // the client reads, and an expired src leaves a broken frame behind.
      .createSignedUrl(att.path, 300, parsed.data.download ? { download: att.file_name } : undefined);
    if (error || !data) return actionError("INTERNAL", "Couldn't create a download link.");
    return actionOk({ url: data.signedUrl });
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
    // Toggling to visible fires the guest_file_shared notification (0016 trigger).
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
    // Remove the bytes best-effort (metadata is retained soft-deleted for audit).
    const admin = createAdminClient();
    await admin.storage.from(removed.bucket).remove([removed.path]);
    return actionOk(undefined);
  } catch (e) {
    return mapUnknownError(e);
  }
}
