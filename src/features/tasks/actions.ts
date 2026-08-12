"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/lib/auth";
import { PERMISSIONS } from "@/constants";
import { checkPermission } from "@/repositories/permission.repository";
import {
  createTaskSchema,
  deleteTaskSchema,
  moveTaskSchema,
  rescheduleTaskSchema,
  updateTaskProgressSchema,
  updateTaskSchema,
  updateTaskStatusSchema,
} from "@/schemas/task.schema";
import * as taskRepo from "@/repositories/task.repository";
import * as notificationRepo from "@/repositories/notification.repository";
import { getStatusCategory } from "@/repositories/workflow.repository";
import { mapUnknownError } from "@/lib/errors";
import { toFieldErrors } from "@/lib/validation";
import { actionError, actionOk, type ActionResult } from "@/types/action";
import type { TablesInsert, TablesUpdate } from "@/types/database.types";
import { buildTaskDrawerData } from "./task-drawer-data";
import type { TaskDrawerData } from "./components/task-drawer";

/**
 * Read action: loads the full task-drawer bundle so the board can open the
 * drawer in place without a route navigation (no board re-fetch, no loading
 * fallback). Authorization mirrors the server loader (RLS + permission checks).
 */
export async function loadTaskDrawer(
  projectId: string,
  taskId: string,
): Promise<ActionResult<TaskDrawerData>> {
  try {
    const data = await buildTaskDrawerData(projectId, taskId);
    if (!data) return actionError("NOT_FOUND", "This task is no longer available.");
    return actionOk(data);
  } catch (e) {
    return mapUnknownError(e);
  }
}

function revalidateTasks(projectId: string) {
  revalidatePath(`/projects/${projectId}/tasks`);
  revalidatePath(`/projects/${projectId}/board`);
  revalidatePath(`/projects/${projectId}`);
}

export async function createTask(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireOrgContext();
  const parsed = createTaskSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("VALIDATION", "Please check the form.", toFieldErrors(parsed.error));
  }
  const d = parsed.data;
  if (
    !(await checkPermission(ctx.organization.id, PERMISSIONS.TASK_CREATE, {
      projectId: d.projectId,
    }))
  ) {
    return actionError("FORBIDDEN", "You can't create tasks in this project.");
  }
  try {
    const id = crypto.randomUUID();
    const values: TablesInsert<"tasks"> = {
      id,
      organization_id: ctx.organization.id,
      project_id: d.projectId,
      title: d.title,
      description: d.description ?? null,
      priority: d.priority ?? "medium",
      assignee_id: d.assigneeId ?? null,
      reporter_id: ctx.profile.id,
      start_date: d.startDate ?? null,
      due_date: d.dueDate ?? null,
      estimated_hours: d.estimatedHours ?? null,
      // When created from a specific board column, land there; otherwise the
      // trigger picks the workflow's initial status.
      status_id: d.statusId ?? null,
    };
    // number, workflow, initial status (when null), org, activity + assignment
    // notification are all set by triggers.
    await taskRepo.insertTask(values);
    revalidateTasks(d.projectId);
    return actionOk({ id });
  } catch (e) {
    return mapUnknownError(e);
  }
}

export async function updateTask(input: unknown): Promise<ActionResult> {
  await requireOrgContext();
  const parsed = updateTaskSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("VALIDATION", "Please check the form.", toFieldErrors(parsed.error));
  }
  const { id, ...d } = parsed.data;
  const patch: TablesUpdate<"tasks"> = {};
  if (d.title !== undefined) patch.title = d.title;
  if (d.description !== undefined) patch.description = d.description ?? null;
  if (d.priority !== undefined) patch.priority = d.priority;
  if (d.assigneeId !== undefined) patch.assignee_id = d.assigneeId ?? null;
  if (d.startDate !== undefined) patch.start_date = d.startDate ?? null;
  if (d.dueDate !== undefined) patch.due_date = d.dueDate ?? null;
  if (d.estimatedHours !== undefined) patch.estimated_hours = d.estimatedHours ?? null;
  if (d.actualHours !== undefined) patch.actual_hours = d.actualHours ?? null;
  if (d.githubPrUrl !== undefined) patch.github_pr_url = d.githubPrUrl ?? null;
  if (d.figmaUrl !== undefined) patch.figma_url = d.figmaUrl ?? null;
  if (d.stagingUrl !== undefined) patch.staging_url = d.stagingUrl ?? null;
  if (d.productionUrl !== undefined) patch.production_url = d.productionUrl ?? null;
  if (d.evidenceNotes !== undefined) patch.evidence_notes = d.evidenceNotes ?? null;

  try {
    // RLS (task.update.any OR assignee+own) + the column-guard trigger are
    // authoritative; a null result means the caller couldn't edit the task.
    const updated = await taskRepo.updateTask(id, patch);
    if (!updated) return actionError("FORBIDDEN", "You can't edit this task.");
    revalidateTasks(updated.project_id as string);
    return actionOk(undefined);
  } catch (e) {
    return mapUnknownError(e);
  }
}

export async function updateTaskStatus(input: unknown): Promise<ActionResult> {
  await requireOrgContext();
  const parsed = updateTaskStatusSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("VALIDATION", "Invalid request.", toFieldErrors(parsed.error));
  }
  const { id, statusId, reason } = parsed.data;
  try {
    const category = await getStatusCategory(statusId);
    if (category === "blocked" && !reason?.trim()) {
      return actionError("VALIDATION", "A reason is required to block a task.", {
        reason: ["Please say why this is blocked."],
      });
    }
    const patch: TablesUpdate<"tasks"> = {
      status_id: statusId,
      blocked_reason: category === "blocked" ? (reason?.trim() ?? null) : null,
    };
    // The workflow-transition trigger rejects illegal moves (→ check_violation
    // → TRANSITION_NOT_ALLOWED). status_changed/blocked/done side-effects,
    // activity and notifications all fire from triggers.
    const updated = await taskRepo.updateTask(id, patch);
    if (!updated) return actionError("FORBIDDEN", "You can't change this task's status.");
    revalidateTasks(updated.project_id as string);
    return actionOk(undefined);
  } catch (e) {
    return mapUnknownError(e);
  }
}

export async function updateTaskProgress(input: unknown): Promise<ActionResult> {
  await requireOrgContext();
  const parsed = updateTaskProgressSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("VALIDATION", "Invalid request.", toFieldErrors(parsed.error));
  }
  try {
    const updated = await taskRepo.updateTask(parsed.data.id, {
      progress: parsed.data.progress,
    });
    if (!updated) return actionError("FORBIDDEN", "You can't update this task.");
    revalidateTasks(updated.project_id as string);
    return actionOk(undefined);
  } catch (e) {
    return mapUnknownError(e);
  }
}

/**
 * Kanban move — sets the task's column (status) and its fractional board
 * position in one update. The workflow-transition trigger validates the status
 * move; the column-guard trigger keeps assignees from touching manager fields
 * (status_id + position aren't guarded, so an assignee can move their own card).
 * RLS decides which cards the caller may move at all.
 */
export async function moveTask(input: unknown): Promise<ActionResult> {
  await requireOrgContext();
  const parsed = moveTaskSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("VALIDATION", "Invalid request.", toFieldErrors(parsed.error));
  }
  const { id, statusId, position } = parsed.data;
  try {
    const category = await getStatusCategory(statusId);
    const patch: TablesUpdate<"tasks"> = { status_id: statusId, position };
    // Leaving the blocked column clears the reason; entering it from the board
    // keeps whatever reason exists (the drawer is where reasons are captured).
    if (category !== "blocked") patch.blocked_reason = null;
    const updated = await taskRepo.updateTask(id, patch);
    if (!updated) return actionError("FORBIDDEN", "You can't move this task.");
    revalidateTasks(updated.project_id as string);
    return actionOk(undefined);
  } catch (e) {
    return mapUnknownError(e);
  }
}

/**
 * Calendar drag-to-reschedule — moving a due date is a manager action
 * (task.update.any); the column guard would silently revert it for an assignee,
 * so we check explicitly and return FORBIDDEN for a clear, revertible UI signal.
 */
export async function rescheduleTaskDue(input: unknown): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  const parsed = rescheduleTaskSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("VALIDATION", "Invalid request.", toFieldErrors(parsed.error));
  }
  const { id, dueDate } = parsed.data;
  try {
    const ref = await taskRepo.getTaskRef(id);
    if (!ref) return actionError("NOT_FOUND", "That task no longer exists.");
    if (
      !(await checkPermission(ctx.organization.id, PERMISSIONS.TASK_UPDATE_ANY, {
        projectId: ref.project_id as string,
      }))
    ) {
      return actionError("FORBIDDEN", "You can't reschedule this task.");
    }
    const updated = await taskRepo.updateTask(id, { due_date: dueDate });
    if (!updated) return actionError("FORBIDDEN", "You can't reschedule this task.");
    revalidateTasks(updated.project_id as string);
    revalidatePath("/calendar");
    revalidatePath("/timeline");
    return actionOk(undefined);
  } catch (e) {
    return mapUnknownError(e);
  }
}

export async function deleteTask(input: unknown): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  const parsed = deleteTaskSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("VALIDATION", "Invalid request.", toFieldErrors(parsed.error));
  }
  try {
    const removed = await taskRepo.softDeleteTask(parsed.data.id, ctx.profile.id);
    if (!removed) return actionError("FORBIDDEN", "You can't delete this task.");
    // Otherwise the "assigned to you" notices stay in everyone's tray pointing
    // at a task that no longer resolves. Best-effort: cleanup failing is no
    // reason to fail the delete the user actually asked for.
    try {
      await notificationRepo.deleteNotificationsForEntity("task", parsed.data.id);
    } catch {
      /* leave the stale rows; the deep-link resolver handles them gracefully */
    }
    revalidateTasks(removed.project_id as string);
    return actionOk(undefined);
  } catch (e) {
    return mapUnknownError(e);
  }
}
