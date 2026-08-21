"use server";

import { requireOrgContext } from "@/lib/auth";
import {
  addChecklistItemSchema,
  deleteChecklistItemSchema,
  reorderChecklistSchema,
  toggleChecklistItemSchema,
  updateChecklistItemSchema,
} from "@/schemas/checklist.schema";
import * as checklistRepo from "@/repositories/checklist.repository";
import { mapUnknownError } from "@/lib/errors";
import { toFieldErrors } from "@/lib/validation";
import { actionError, actionOk, type ActionResult } from "@/types/action";

// Checklist changes come from the task drawer, which reconciles optimistically
// and calls router.refresh() — no revalidatePath needed here.

export async function addChecklistItem(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireOrgContext();
  const parsed = addChecklistItemSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("VALIDATION", "Invalid request.", toFieldErrors(parsed.error));
  }
  try {
    const id = crypto.randomUUID();
    await checklistRepo.insertChecklistItem({
      id,
      organizationId: ctx.organization.id,
      taskId: parsed.data.taskId,
      content: parsed.data.content,
    });
    return actionOk({ id });
  } catch (e) {
    return mapUnknownError(e);
  }
}

export async function toggleChecklistItem(input: unknown): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  const parsed = toggleChecklistItemSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("VALIDATION", "Invalid request.", toFieldErrors(parsed.error));
  }
  try {
    const updated = await checklistRepo.updateChecklistItem(parsed.data.id, {
      is_done: parsed.data.isDone,
      done_at: parsed.data.isDone ? new Date().toISOString() : null,
      done_by: parsed.data.isDone ? ctx.profile.id : null,
    });
    if (!updated) return actionError("FORBIDDEN", "You can't change this checklist.");
    return actionOk(undefined);
  } catch (e) {
    return mapUnknownError(e);
  }
}

export async function updateChecklistItem(input: unknown): Promise<ActionResult> {
  await requireOrgContext();
  const parsed = updateChecklistItemSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("VALIDATION", "Invalid request.", toFieldErrors(parsed.error));
  }
  try {
    const updated = await checklistRepo.updateChecklistItem(parsed.data.id, {
      content: parsed.data.content,
    });
    if (!updated) return actionError("FORBIDDEN", "You can't edit this checklist.");
    return actionOk(undefined);
  } catch (e) {
    return mapUnknownError(e);
  }
}

export async function deleteChecklistItem(input: unknown): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  const parsed = deleteChecklistItemSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("VALIDATION", "Invalid request.", toFieldErrors(parsed.error));
  }
  try {
    const removed = await checklistRepo.softDeleteChecklistItem(
      parsed.data.id,
      ctx.profile.id,
    );
    if (!removed) return actionError("FORBIDDEN", "You can't delete this item.");
    return actionOk(undefined);
  } catch (e) {
    return mapUnknownError(e);
  }
}

export async function reorderChecklist(input: unknown): Promise<ActionResult> {
  await requireOrgContext();
  const parsed = reorderChecklistSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("VALIDATION", "Invalid request.", toFieldErrors(parsed.error));
  }
  try {
    await checklistRepo.setChecklistPositions(parsed.data.orderedIds);
    return actionOk(undefined);
  } catch (e) {
    return mapUnknownError(e);
  }
}
