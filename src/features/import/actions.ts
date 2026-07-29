"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/lib/auth";
import { PERMISSIONS } from "@/constants";
import { checkPermission } from "@/repositories/permission.repository";
import { createAdminClient } from "@/lib/supabase/admin";
import * as taskRepo from "@/repositories/task.repository";
import { parseDocument } from "./parse";
import {
  commitImportSchema,
  parseImportSchema,
  requestImportUploadSchema,
} from "@/schemas/import.schema";
import { toFieldErrors } from "@/lib/validation";
import { mapUnknownError } from "@/lib/errors";
import { actionError, actionOk, type ActionResult } from "@/types/action";
import type { TablesInsert } from "@/types/database.types";

const BUCKET = "attachments";
const PREVIEW_TTL = 1800; // 30 min — long enough to review before committing

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
 * Download the uploaded document, split it into tasks, stage each screenshot in
 * storage, and return the proposal (with signed preview URLs) for review. The
 * raw source file is deleted afterwards — only the extracted images remain.
 */
export async function parseImportDocument(
  input: unknown,
): Promise<ActionResult<{ tasks: ImportPreviewTask[] }>> {
  const ctx = await requireOrgContext();
  const parsed = parseImportSchema.safeParse(input);
  if (!parsed.success) return actionError("VALIDATION", "Invalid request.");
  const { projectId, path, fileName } = parsed.data;
  const orgId = ctx.organization.id;

  if (!(await checkPermission(orgId, PERMISSIONS.TASK_CREATE, { projectId }))) {
    return actionError("FORBIDDEN", "You can't import tasks into this project.");
  }
  // The path is client-supplied — pin it to this org/project before touching storage.
  if (!path.startsWith(`${orgId}/${projectId}/`)) {
    return actionError("FORBIDDEN", "Invalid file path.");
  }

  const admin = createAdminClient();
  try {
    const dl = await admin.storage.from(BUCKET).download(path);
    if (dl.error || !dl.data) return actionError("NOT_FOUND", "Uploaded file not found.");
    const buffer = Buffer.from(await dl.data.arrayBuffer());

    const parsedTasks = await parseDocument(buffer, fileName);
    if (parsedTasks.length === 0) {
      await admin.storage.from(BUCKET).remove([path]);
      return actionError(
        "VALIDATION",
        "No tasks found. Make sure the document is a numbered list of items.",
      );
    }

    const tasks: ImportPreviewTask[] = [];
    for (const t of parsedTasks) {
      const images: ImportPreviewImage[] = [];
      for (const img of t.images) {
        const imgPath = `${orgId}/${projectId}/${crypto.randomUUID()}.${img.ext}`;
        const up = await admin.storage
          .from(BUCKET)
          .upload(imgPath, img.data, { contentType: img.contentType, upsert: false });
        if (up.error) continue;
        const signed = await admin.storage.from(BUCKET).createSignedUrl(imgPath, PREVIEW_TTL);
        const safeTitle = t.title.slice(0, 40).replace(/[^\w.\-]+/g, "_") || "image";
        images.push({
          path: imgPath,
          fileName: `${safeTitle}.${img.ext}`,
          fileType: img.contentType,
          fileSize: img.data.length,
          previewUrl: signed.data?.signedUrl ?? "",
        });
      }
      tasks.push({ title: t.title, description: t.description, images });
    }

    await admin.storage.from(BUCKET).remove([path]); // temp source no longer needed
    return actionOk({ tasks });
  } catch (e) {
    return mapUnknownError(e);
  }
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

  const admin = createAdminClient();
  try {
    let count = 0;
    for (const t of tasks) {
      const taskId = crypto.randomUUID();
      const values: TablesInsert<"tasks"> = {
        id: taskId,
        organization_id: orgId,
        project_id: projectId,
        title: t.title,
        description: t.description || null,
        reporter_id: ctx.profile.id,
        // land in the chosen column, else the trigger picks the initial status
        status_id: statusId ?? null,
      };
      // RLS + triggers (number, workflow, initial status, activity) run here.
      await taskRepo.insertTask(values);

      for (const img of t.images) {
        // defence in depth: only accept image paths inside this org/project
        if (!img.path.startsWith(`${orgId}/${projectId}/`)) continue;
        const attachment: TablesInsert<"attachments"> = {
          id: crypto.randomUUID(),
          organization_id: orgId,
          project_id: projectId,
          entity: "task",
          entity_id: taskId,
          bucket: BUCKET,
          path: img.path,
          file_name: img.fileName,
          file_type: img.fileType,
          file_size: img.fileSize,
          uploaded_by: ctx.profile.id,
        };
        await admin.from("attachments").insert(attachment);
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
