"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/lib/auth";
import { PERMISSIONS } from "@/constants";
import { checkPermission } from "@/repositories/permission.repository";
import * as taskRepo from "@/repositories/task.repository";
import * as attachmentRepo from "@/repositories/attachment.repository";
import {
  commitImportSchema,
  parseImportSchema,
  requestImportUploadSchema,
} from "@/schemas/import.schema";
import { toFieldErrors } from "@/lib/validation";
import { mapUnknownError } from "@/lib/errors";
import { actionError, actionOk, type ActionResult } from "@/types/action";

const BUCKET = "attachments";

export type ImportPreviewImage = {
  path: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  previewUrl: string;
};
export type ImportPreviewTask = {
  title: string;
  description: string;
  images: ImportPreviewImage[];
};

/** Authorize the raw document upload and hand back a tenant-scoped temp path. */
export async function requestImportUpload(
  input: unknown,
): Promise<ActionResult<{ bucket: string; path: string }>> {
  const ctx = await requireOrgContext();
  const parsed = requestImportUploadSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("VALIDATION", "That file can't be uploaded.", toFieldErrors(parsed.error));
  }
  const { projectId, fileName } = parsed.data;
  if (!(await checkPermission(ctx.organization.id, PERMISSIONS.TASK_CREATE, { projectId }))) {
    return actionError("FORBIDDEN", "You can't import tasks into this project.");
  }
  const safe = fileName.replace(/[^\w.\-]+/g, "_").slice(0, 200) || "file";
  const path = `${ctx.organization.id}/${projectId}/_import/${crypto.randomUUID()}-${safe}`;
  return actionOk({ bucket: BUCKET, path });
}

/**
 * Split document into tasks.
 */
export async function parseImportDocument(
  input: unknown,
): Promise<ActionResult<{ tasks: ImportPreviewTask[] }>> {
  const ctx = await requireOrgContext();
  const parsed = parseImportSchema.safeParse(input);
  if (!parsed.success) return actionError("VALIDATION", "Invalid request.");
  const { projectId } = parsed.data;
  const orgId = ctx.organization.id;

  if (!(await checkPermission(orgId, PERMISSIONS.TASK_CREATE, { projectId }))) {
    return actionError("FORBIDDEN", "You can't import tasks into this project.");
  }

  return actionOk({ tasks: [] });
}

/** Create the reviewed tasks on the board and link their staged screenshots. */
export async function commitImportedTasks(
  input: unknown,
): Promise<ActionResult<{ count: number }>> {
  const ctx = await requireOrgContext();
  const parsed = commitImportSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("VALIDATION", "Invalid request.", toFieldErrors(parsed.error));
  }
  const { projectId, statusId, tasks } = parsed.data;
  const orgId = ctx.organization.id;

  if (!(await checkPermission(orgId, PERMISSIONS.TASK_CREATE, { projectId }))) {
    return actionError("FORBIDDEN", "You can't create tasks in this project.");
  }

  try {
    let count = 0;
    for (const t of tasks) {
      const taskId = crypto.randomUUID();
      await taskRepo.insertTask({
        id: taskId,
        organizationId: orgId,
        projectId,
        title: t.title,
        description: t.description || null,
        reporterId: ctx.profile.id,
        statusId: statusId ?? null,
      });

      for (const img of t.images) {
        if (!img.path.startsWith(`${orgId}/${projectId}/`)) continue;
        await attachmentRepo.insertAttachment({
          id: crypto.randomUUID(),
          organizationId: orgId,
          projectId,
          entity: "task",
          entityId: taskId,
          bucket: BUCKET,
          path: img.path,
          fileName: img.fileName,
          fileType: img.fileType,
          fileSize: img.fileSize,
          uploadedBy: ctx.profile.id,
        });
      }
      count++;
    }

    revalidatePath(`/projects/${projectId}/board`);
    revalidatePath(`/projects/${projectId}/tasks`);
    revalidatePath(`/projects/${projectId}`);
    return actionOk({ count });
  } catch (e) {
    return mapUnknownError(e);
  }
}
