"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/lib/auth";
import { PERMISSIONS } from "@/constants";
import { checkPermission } from "@/repositories/permission.repository";
import {
  addProjectMemberSchema,
  changeProjectMemberRoleSchema,
  removeProjectMemberSchema,
} from "@/schemas/project-member.schema";
import * as memberRepo from "@/repositories/project-member.repository";
import { logActivity } from "@/repositories/activity.repository";
import { mapUnknownError } from "@/lib/errors";
import { toFieldErrors } from "@/lib/validation";
import { actionError, actionOk, type ActionResult } from "@/types/action";

export async function addProjectMember(input: unknown): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  const parsed = addProjectMemberSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("VALIDATION", "Please check the form.", toFieldErrors(parsed.error));
  }
  const { projectId, userId, roleId, allocationPct } = parsed.data;

  // Project-scoped check so a Project Lead (not only org managers) is allowed.
  if (
    !(await checkPermission(ctx.organization.id, PERMISSIONS.PROJECT_MEMBER_MANAGE, {
      projectId,
    }))
  ) {
    return actionError("FORBIDDEN", "You can't manage this project's members.");
  }

  try {
    await memberRepo.insertProjectMember({
      organizationId: ctx.organization.id,
      projectId,
      userId,
      roleId,
      allocationPct: allocationPct ?? null,
    });
    await logActivity({
      organizationId: ctx.organization.id,
      projectId,
      entity: "project",
      entityId: projectId,
      action: "member.added",
      metadata: { user_id: userId },
      guestVisible: false,
    });
    revalidatePath(`/projects/${projectId}/members`);
    revalidatePath(`/projects/${projectId}`);
    return actionOk(undefined);
  } catch (e) {
    return mapUnknownError(e);
  }
}

export async function changeProjectMemberRole(input: unknown): Promise<ActionResult> {
  await requireOrgContext(); // auth guard; RLS + the returned row are authoritative
  const parsed = changeProjectMemberRoleSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("VALIDATION", "Invalid request.", toFieldErrors(parsed.error));
  }
  const { memberId, roleId } = parsed.data;
  try {
    // RLS (project_members_write) is authoritative; a null result = blocked.
    const updated = await memberRepo.updateProjectMemberRole(memberId, roleId);
    if (!updated) return actionError("FORBIDDEN", "You can't change this member.");
    revalidatePath(`/projects/${updated.project_id}/members`);
    return actionOk(undefined);
  } catch (e) {
    return mapUnknownError(e);
  }
}

export async function removeProjectMember(input: unknown): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  const parsed = removeProjectMemberSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("VALIDATION", "Invalid request.", toFieldErrors(parsed.error));
  }
  try {
    const removed = await memberRepo.softDeleteProjectMember(
      parsed.data.memberId,
      ctx.profile.id,
    );
    if (!removed) return actionError("FORBIDDEN", "You can't remove this member.");
    await logActivity({
      organizationId: ctx.organization.id,
      projectId: removed.project_id as string,
      entity: "project",
      entityId: removed.project_id as string,
      action: "member.removed",
      metadata: { user_id: removed.user_id },
      guestVisible: false,
    });
    revalidatePath(`/projects/${removed.project_id}/members`);
    revalidatePath(`/projects/${removed.project_id}`);
    return actionOk(undefined);
  } catch (e) {
    return mapUnknownError(e);
  }
}
