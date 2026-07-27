"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/lib/auth";
import { PERMISSIONS } from "@/constants";
import { checkPermission } from "@/repositories/permission.repository";
import {
  getWorkspace,
  updateWorkspace as updateWorkspaceRow,
} from "@/repositories/workspace.repository";
import { logActivity } from "@/repositories/activity.repository";
import {
  archiveWorkspaceSchema,
  updateWorkspaceLogoSchema,
  updateWorkspaceSchema,
} from "@/schemas/workspace.schema";
import { mapUnknownError } from "@/lib/errors";
import { toFieldErrors } from "@/lib/validation";
import { actionError, actionOk, type ActionResult } from "@/types/action";

export async function updateWorkspace(input: unknown): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  const parsed = updateWorkspaceSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("VALIDATION", "Please check the form.", toFieldErrors(parsed.error));
  }
  if (!(await checkPermission(ctx.organization.id, PERMISSIONS.ORG_SETTINGS_UPDATE))) {
    return actionError("FORBIDDEN", "You can't change workspace settings.");
  }
  const d = parsed.data;
  try {
    // RLS also scopes the update to this org's workspaces.
    const updated = await updateWorkspaceRow(d.id, {
      name: d.name,
      description: d.description || null,
      color: d.color,
      default_workflow_id: d.defaultWorkflowId ?? null,
    });
    if (!updated) return actionError("NOT_FOUND", "Workspace not found.");
    await logActivity({
      organizationId: ctx.organization.id,
      projectId: null,
      entity: "workspace",
      entityId: d.id,
      action: "workspace.updated",
      metadata: { name: d.name },
    });
    revalidatePath("/settings/workspace");
    return actionOk(undefined);
  } catch (e) {
    return mapUnknownError(e);
  }
}

export async function archiveWorkspace(input: unknown): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  const parsed = archiveWorkspaceSchema.safeParse(input);
  if (!parsed.success) return actionError("VALIDATION", "Invalid request.");
  if (!(await checkPermission(ctx.organization.id, PERMISSIONS.ORG_SETTINGS_UPDATE))) {
    return actionError("FORBIDDEN", "You can't archive workspaces.");
  }
  try {
    const ws = await getWorkspace(parsed.data.id);
    if (!ws) return actionError("NOT_FOUND", "Workspace not found.");
    if (ws.is_default) {
      return actionError("CONFLICT", "The default workspace can't be archived.");
    }
    await updateWorkspaceRow(parsed.data.id, { is_archived: true });
    await logActivity({
      organizationId: ctx.organization.id,
      projectId: null,
      entity: "workspace",
      entityId: parsed.data.id,
      action: "workspace.archived",
      metadata: { name: ws.name },
    });
    revalidatePath("/settings/workspace");
    return actionOk(undefined);
  } catch (e) {
    return mapUnknownError(e);
  }
}

export async function updateWorkspaceLogo(input: unknown): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  const parsed = updateWorkspaceLogoSchema.safeParse(input);
  if (!parsed.success) return actionError("VALIDATION", "Invalid image.");
  if (!(await checkPermission(ctx.organization.id, PERMISSIONS.ORG_SETTINGS_UPDATE))) {
    return actionError("FORBIDDEN", "You can't change branding.");
  }
  try {
    await updateWorkspaceRow(parsed.data.id, { logo_url: parsed.data.logoUrl });
    revalidatePath("/settings/workspace");
    return actionOk(undefined);
  } catch (e) {
    return mapUnknownError(e);
  }
}
