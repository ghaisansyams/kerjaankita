"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/lib/auth";
import { PERMISSIONS } from "@/constants";
import { checkPermission } from "@/repositories/permission.repository";
import {
  createMilestoneSchema,
  deleteMilestoneSchema,
  reorderMilestonesSchema,
  updateMilestoneSchema,
} from "@/schemas/milestone.schema";
import * as milestoneRepo from "@/repositories/milestone.repository";
import { logActivity } from "@/repositories/activity.repository";
import { mapUnknownError } from "@/lib/errors";
import { toFieldErrors } from "@/lib/validation";
import { actionError, actionOk, type ActionResult } from "@/types/action";
import type { TablesInsert, TablesUpdate } from "@/types/database.types";

function revalidateProject(projectId: string) {
  revalidatePath(`/projects/${projectId}/milestones`);
  revalidatePath(`/projects/${projectId}`);
}

export async function createMilestone(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireOrgContext();
  const parsed = createMilestoneSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("VALIDATION", "Please check the form.", toFieldErrors(parsed.error));
  }
  const { projectId, name, description, dueDate } = parsed.data;
  if (
    !(await checkPermission(ctx.organization.id, PERMISSIONS.MILESTONE_MANAGE, {
      projectId,
    }))
  ) {
    return actionError("FORBIDDEN", "You can't manage this project's milestones.");
  }
  try {
    const id = crypto.randomUUID();
    const values: TablesInsert<"milestones"> = {
      id,
      organization_id: ctx.organization.id,
      project_id: projectId,
      name,
      description: description ?? null,
      due_date: dueDate ?? null,
    };
    await milestoneRepo.insertMilestone(values);
    await logActivity({
      organizationId: ctx.organization.id,
      projectId,
      entity: "milestone",
      entityId: id,
      action: "milestone.created",
      metadata: { name },
      guestVisible: true,
    });
    revalidateProject(projectId);
    return actionOk({ id });
  } catch (e) {
    return mapUnknownError(e);
  }
}

export async function updateMilestone(input: unknown): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  const parsed = updateMilestoneSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("VALIDATION", "Please check the form.", toFieldErrors(parsed.error));
  }
  const { id, name, description, dueDate, achieved } = parsed.data;
  const patch: TablesUpdate<"milestones"> = {};
  if (name !== undefined) patch.name = name;
  if (description !== undefined) patch.description = description ?? null;
  if (dueDate !== undefined) patch.due_date = dueDate ?? null;
  if (achieved !== undefined) patch.achieved_at = achieved ? new Date().toISOString() : null;

  try {
    const updated = await milestoneRepo.updateMilestone(id, patch);
    if (!updated) return actionError("FORBIDDEN", "You can't edit this milestone.");
    if (achieved === true) {
      await logActivity({
        organizationId: ctx.organization.id,
        projectId: updated.project_id as string,
        entity: "milestone",
        entityId: id,
        action: "milestone.reached",
        metadata: { name: name ?? null },
        guestVisible: true,
      });
    }
    revalidateProject(updated.project_id as string);
    return actionOk(undefined);
  } catch (e) {
    return mapUnknownError(e);
  }
}

export async function deleteMilestone(input: unknown): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  const parsed = deleteMilestoneSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("VALIDATION", "Invalid request.", toFieldErrors(parsed.error));
  }
  try {
    const removed = await milestoneRepo.softDeleteMilestone(
      parsed.data.id,
      ctx.profile.id,
    );
    if (!removed) return actionError("FORBIDDEN", "You can't delete this milestone.");
    revalidateProject(removed.project_id as string);
    return actionOk(undefined);
  } catch (e) {
    return mapUnknownError(e);
  }
}

export async function reorderMilestones(input: unknown): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  const parsed = reorderMilestonesSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("VALIDATION", "Invalid request.", toFieldErrors(parsed.error));
  }
  const { projectId, orderedIds } = parsed.data;
  if (
    !(await checkPermission(ctx.organization.id, PERMISSIONS.MILESTONE_MANAGE, {
      projectId,
    }))
  ) {
    return actionError("FORBIDDEN", "You can't reorder these milestones.");
  }
  try {
    await milestoneRepo.setMilestonePositions(orderedIds);
    revalidateProject(projectId);
    return actionOk(undefined);
  } catch (e) {
    return mapUnknownError(e);
  }
}
