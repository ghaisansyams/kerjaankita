"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/lib/auth";
import { PERMISSIONS } from "@/constants";
import { checkPermission } from "@/repositories/permission.repository";
import {
  archiveProjectSchema,
  createProjectSchema,
  deleteProjectSchema,
  updateProjectSchema,
} from "@/schemas/project.schema";
import * as projectRepo from "@/repositories/project.repository";
import { logActivity } from "@/repositories/activity.repository";
import { mapUnknownError } from "@/lib/errors";
import { toFieldErrors } from "@/lib/validation";
import { actionError, actionOk, type ActionResult } from "@/types/action";
import type { Json, TablesInsert, TablesUpdate } from "@/types/database.types";

export async function createProject(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireOrgContext();
  const parsed = createProjectSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("VALIDATION", "Please check the form.", toFieldErrors(parsed.error));
  }
  const d = parsed.data;
  // Scope-aware: workspace admins may create in their workspace.
  if (
    !(await checkPermission(ctx.organization.id, PERMISSIONS.PROJECT_CREATE, {
      workspaceId: d.workspaceId,
    }))
  ) {
    return actionError("FORBIDDEN", "You don't have permission to create projects.");
  }
  try {
    const id = crypto.randomUUID();
    const values: TablesInsert<"projects"> = {
      id,
      organization_id: ctx.organization.id,
      workspace_id: d.workspaceId,
      name: d.name,
      account_id: d.accountId ?? null,
      owner_id: d.ownerId ?? ctx.profile.id,
      visibility: d.visibility,
      color: d.color,
      key: d.key ?? null,
      description: d.description ?? null,
      start_date: d.startDate ?? null,
      end_date: d.endDate ?? null,
    };
    await projectRepo.insertProject(values);
    revalidatePath("/projects");
    return actionOk({ id });
  } catch (e) {
    return mapUnknownError(e);
  }
}

export async function updateProject(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireOrgContext();
  const parsed = updateProjectSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("VALIDATION", "Please check the form.", toFieldErrors(parsed.error));
  }
  const { id, ...d } = parsed.data;
  if (
    !(await checkPermission(ctx.organization.id, PERMISSIONS.PROJECT_UPDATE, {
      projectId: id,
    }))
  ) {
    return actionError("FORBIDDEN", "You don't have permission to edit this project.");
  }

  const patch: TablesUpdate<"projects"> = {};
  if (d.name !== undefined) patch.name = d.name;
  if (d.workspaceId !== undefined) patch.workspace_id = d.workspaceId;
  if (d.accountId !== undefined) patch.account_id = d.accountId ?? null;
  if (d.ownerId !== undefined) patch.owner_id = d.ownerId ?? null;
  if (d.visibility !== undefined) patch.visibility = d.visibility;
  if (d.color !== undefined) patch.color = d.color;
  if (d.key !== undefined) patch.key = d.key ?? null;
  if (d.description !== undefined) patch.description = d.description ?? null;
  if (d.startDate !== undefined) patch.start_date = d.startDate ?? null;
  if (d.endDate !== undefined) patch.end_date = d.endDate ?? null;

  try {
    const before = await projectRepo.getProject(id);
    if (!before) {
      return actionError("NOT_FOUND", "Project not found or you can't edit it.");
    }
    const updated = await projectRepo.updateProject(id, patch);
    if (!updated) {
      return actionError("NOT_FOUND", "Project not found or you can't edit it.");
    }
    // Audit payload: only the fields that changed, as from → to
    // (see docs/IMPLEMENTATION-NOTES.md §"Activity Log payload").
    const beforeRec = before as unknown as Record<string, Json>;
    const changes = Object.entries(patch)
      .filter(([col, val]) => beforeRec[col] !== val)
      .map(([col, val]) => ({
        field: col,
        from: (beforeRec[col] ?? null) as Json,
        to: ((val as Json | undefined) ?? null) as Json,
      }));
    await logActivity({
      organizationId: ctx.organization.id,
      projectId: id,
      entity: "project",
      entityId: id,
      action: "project.updated",
      metadata: { changes },
      guestVisible: true,
    });
    revalidatePath("/projects");
    revalidatePath(`/projects/${id}`);
    return actionOk({ id });
  } catch (e) {
    return mapUnknownError(e);
  }
}

export async function archiveProject(input: unknown): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  const parsed = archiveProjectSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("VALIDATION", "Invalid request.", toFieldErrors(parsed.error));
  }
  const { id, archived } = parsed.data;
  if (
    !(await checkPermission(ctx.organization.id, PERMISSIONS.PROJECT_UPDATE, {
      projectId: id,
    }))
  ) {
    return actionError("FORBIDDEN", "You don't have permission to do that.");
  }
  try {
    const updated = await projectRepo.setProjectArchived(id, archived);
    if (!updated) return actionError("NOT_FOUND", "Project not found.");
    await logActivity({
      organizationId: ctx.organization.id,
      projectId: id,
      entity: "project",
      entityId: id,
      action: archived ? "project.archived" : "project.unarchived",
      guestVisible: false,
    });
    revalidatePath("/projects");
    revalidatePath(`/projects/${id}`);
    return actionOk(undefined);
  } catch (e) {
    return mapUnknownError(e);
  }
}

export async function deleteProject(input: unknown): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  const parsed = deleteProjectSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("VALIDATION", "Invalid request.", toFieldErrors(parsed.error));
  }
  const { id, confirmName } = parsed.data;
  if (
    !(await checkPermission(ctx.organization.id, PERMISSIONS.PROJECT_DELETE, {
      projectId: id,
    }))
  ) {
    return actionError("FORBIDDEN", "You don't have permission to delete this project.");
  }
  try {
    const project = await projectRepo.getProject(id);
    if (!project) return actionError("NOT_FOUND", "Project not found.");
    if (project.name !== confirmName) {
      return actionError("VALIDATION", "The name you typed doesn't match.", {
        confirmName: ["Name doesn't match."],
      });
    }
    await projectRepo.softDeleteProject(id); // `project.deleted` activity via trigger
    revalidatePath("/projects");
    return actionOk(undefined);
  } catch (e) {
    return mapUnknownError(e);
  }
}
