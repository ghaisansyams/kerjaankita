"use server";

import { requireOrgContext } from "@/lib/auth";
import {
  addCommentSchema,
  deleteCommentSchema,
  editCommentSchema,
} from "@/schemas/comment.schema";
import * as commentRepo from "@/repositories/comment.repository";
import { getTaskRef } from "@/repositories/task.repository";
import { mapUnknownError } from "@/lib/errors";
import { toFieldErrors } from "@/lib/validation";
import { actionError, actionOk, type ActionResult } from "@/types/action";
import type { TablesInsert } from "@/types/database.types";

// The task drawer reconciles via router.refresh() after each mutation.

export async function addComment(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireOrgContext();
  const parsed = addCommentSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("VALIDATION", "Write something.", toFieldErrors(parsed.error));
  }
  const { taskId, body } = parsed.data;
  try {
    const ref = await getTaskRef(taskId); // RLS-scoped: null → can't see the task
    if (!ref) return actionError("NOT_FOUND", "Task not found.");
    const id = crypto.randomUUID();
    const values: TablesInsert<"comments"> = {
      id,
      organization_id: ref.organization_id,
      project_id: ref.project_id,
      entity: "task",
      entity_id: taskId,
      author_id: ctx.profile.id,
      body,
      is_internal: true,
    };
    // comment.created activity + @mention notifications fire from triggers.
    await commentRepo.insertComment(values);
    return actionOk({ id });
  } catch (e) {
    return mapUnknownError(e);
  }
}

export async function editComment(input: unknown): Promise<ActionResult> {
  await requireOrgContext();
  const parsed = editCommentSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("VALIDATION", "Write something.", toFieldErrors(parsed.error));
  }
  try {
    const updated = await commentRepo.updateComment(parsed.data.id, parsed.data.body);
    if (!updated) return actionError("FORBIDDEN", "You can only edit your own comments.");
    return actionOk(undefined);
  } catch (e) {
    return mapUnknownError(e);
  }
}

export async function deleteComment(input: unknown): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  const parsed = deleteCommentSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("VALIDATION", "Invalid request.", toFieldErrors(parsed.error));
  }
  try {
    const removed = await commentRepo.softDeleteComment(parsed.data.id, ctx.profile.id);
    if (!removed) return actionError("FORBIDDEN", "You can't delete this comment.");
    return actionOk(undefined);
  } catch (e) {
    return mapUnknownError(e);
  }
}
