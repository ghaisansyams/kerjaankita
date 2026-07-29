"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/lib/auth";
import { PERMISSIONS } from "@/constants";
import { checkPermission } from "@/repositories/permission.repository";
import * as momRepo from "@/repositories/mom.repository";
import { createTask } from "@/features/tasks/actions";
import { logActivity } from "@/repositories/activity.repository";
import {
  createMomSchema,
  updateMomSchema,
  deleteMomSchema,
  createTaskFromNoteSchema,
  logMomExportSchema,
} from "@/schemas/mom.schema";
import { mapUnknownError } from "@/lib/errors";
import { toFieldErrors } from "@/lib/validation";
import { actionError, actionOk, type ActionResult } from "@/types/action";

const orNull = (v?: string) => {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
};

function revalidateMom(projectId: string) {
  revalidatePath("/mom");
  revalidatePath(`/projects/${projectId}/mom`);
}

export async function createMom(input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireOrgContext();
  const parsed = createMomSchema.safeParse(input);
  if (!parsed.success) return actionError("VALIDATION", "Please check the form.", toFieldErrors(parsed.error));
  const d = parsed.data;
  if (!(await checkPermission(ctx.organization.id, PERMISSIONS.MOM_CREATE, { projectId: d.projectId })))
    return actionError("FORBIDDEN", "You can't create meeting minutes in this project.");
  try {
    const workspaceId = await momRepo.getProjectWorkspace(d.projectId);
    const { id } = await momRepo.insertMom({
      organization_id: ctx.organization.id,
      workspace_id: workspaceId,
      project_id: d.projectId,
      title: d.title,
      meeting_date: d.meetingDate,
      meeting_time: orNull(d.meetingTime),
      location: orNull(d.location),
      pic_id: orNull(d.picId),
      prepared_by: ctx.profile.id,
      approved_by_name: orNull(d.approvedByName) ?? "Galih Aldio Putra",
      approved_by_role: orNull(d.approvedByRole) ?? "Director",
      created_by: ctx.profile.id,
    });
    await momRepo.replaceParticipants(id, d.participants.map((p) => ({ name: p.name, role: orNull(p.role), company: orNull(p.company) })));
    await momRepo.replaceDistribution(id, d.distribution);
    await momRepo.reconcileNotes(id, d.notes.map((n) => ({ category: n.category, content: n.content })));
    await logActivity({ organizationId: ctx.organization.id, projectId: d.projectId, entity: "mom", entityId: id, action: "mom.created", metadata: { title: d.title } });
    revalidateMom(d.projectId);
    return actionOk({ id });
  } catch (e) {
    return mapUnknownError(e);
  }
}

export async function updateMom(input: unknown): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  const parsed = updateMomSchema.safeParse(input);
  if (!parsed.success) return actionError("VALIDATION", "Please check the form.", toFieldErrors(parsed.error));
  const d = parsed.data;
  if (!(await checkPermission(ctx.organization.id, PERMISSIONS.MOM_UPDATE, { projectId: d.projectId })))
    return actionError("FORBIDDEN", "You can't edit this meeting minutes.");
  try {
    await momRepo.updateMomRow(d.id, {
      title: d.title,
      meeting_date: d.meetingDate,
      meeting_time: orNull(d.meetingTime),
      location: orNull(d.location),
      pic_id: orNull(d.picId),
      approved_by_name: orNull(d.approvedByName) ?? "Galih Aldio Putra",
      approved_by_role: orNull(d.approvedByRole) ?? "Director",
      updated_by: ctx.profile.id,
      updated_at: new Date().toISOString(),
    });
    await momRepo.replaceParticipants(d.id, d.participants.map((p) => ({ name: p.name, role: orNull(p.role), company: orNull(p.company) })));
    await momRepo.replaceDistribution(d.id, d.distribution);
    await momRepo.reconcileNotes(d.id, d.notes.map((n) => ({ id: n.id, category: n.category, content: n.content })));
    await logActivity({ organizationId: ctx.organization.id, projectId: d.projectId, entity: "mom", entityId: d.id, action: "mom.updated", metadata: { title: d.title } });
    revalidateMom(d.projectId);
    return actionOk(undefined);
  } catch (e) {
    return mapUnknownError(e);
  }
}

export async function deleteMom(input: unknown): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  const parsed = deleteMomSchema.safeParse(input);
  if (!parsed.success) return actionError("VALIDATION", "Invalid request.");
  const context = await momRepo.getMomProjectContext(parsed.data.id);
  if (!context) return actionError("NOT_FOUND", "This meeting minutes no longer exists.");
  if (!(await checkPermission(ctx.organization.id, PERMISSIONS.MOM_DELETE, { projectId: context.projectId })))
    return actionError("FORBIDDEN", "You can't delete meeting minutes.");
  try {
    await momRepo.softDeleteMom(parsed.data.id);
    await logActivity({ organizationId: ctx.organization.id, projectId: context.projectId, entity: "mom", entityId: parsed.data.id, action: "mom.deleted", metadata: {} });
    revalidateMom(context.projectId);
    return actionOk(undefined);
  } catch (e) {
    return mapUnknownError(e);
  }
}

/** Turn a meeting note into a real Task (reuses the Task module) and link them. */
export async function createTaskFromNote(input: unknown): Promise<ActionResult<{ taskId: string }>> {
  const ctx = await requireOrgContext();
  const parsed = createTaskFromNoteSchema.safeParse(input);
  if (!parsed.success) return actionError("VALIDATION", "Please check the form.", toFieldErrors(parsed.error));
  const d = parsed.data;
  const note = await momRepo.getNote(d.noteId);
  if (!note) return actionError("NOT_FOUND", "This note no longer exists.");
  const context = await momRepo.getMomProjectContext(note.momId);
  if (!context) return actionError("NOT_FOUND", "This meeting minutes no longer exists.");
  if (!(await checkPermission(ctx.organization.id, PERMISSIONS.MOM_UPDATE, { projectId: context.projectId })))
    return actionError("FORBIDDEN", "You can't create tasks from this meeting.");
  if (note.taskId) return actionError("CONFLICT", "This note already has a linked task.");

  const created = await createTask({
    projectId: context.projectId,
    title: d.title,
    assigneeId: d.assigneeId || undefined,
    dueDate: d.dueDate || undefined,
  });
  if (!created.ok) return created;
  try {
    await momRepo.linkNoteTask(d.noteId, created.data.id);
    await logActivity({ organizationId: ctx.organization.id, projectId: context.projectId, entity: "mom", entityId: note.momId, action: "mom.task_created", metadata: { taskId: created.data.id } });
    revalidateMom(context.projectId);
    return actionOk({ taskId: created.data.id });
  } catch (e) {
    return mapUnknownError(e);
  }
}

/** Record that a MOM was exported (called from the print/export button). */
export async function logMomExport(input: unknown): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  const parsed = logMomExportSchema.safeParse(input);
  if (!parsed.success) return actionError("VALIDATION", "Invalid request.");
  const context = await momRepo.getMomProjectContext(parsed.data.id);
  if (!context) return actionError("NOT_FOUND", "This meeting minutes no longer exists.");
  if (!(await checkPermission(ctx.organization.id, PERMISSIONS.MOM_EXPORT, { projectId: context.projectId })))
    return actionError("FORBIDDEN", "You can't export meeting minutes.");
  try {
    await logActivity({ organizationId: ctx.organization.id, projectId: context.projectId, entity: "mom", entityId: parsed.data.id, action: "mom.exported", metadata: {} });
    return actionOk(undefined);
  } catch (e) {
    return mapUnknownError(e);
  }
}
