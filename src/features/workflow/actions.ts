"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/lib/auth";
import { toFieldErrors } from "@/lib/validation";
import { mapUnknownError } from "@/lib/errors";
import { actionError, actionOk, type ActionResult, type ApiError } from "@/types/action";
import {
  createColumn,
  updateColumn,
  reorderColumns,
  deleteColumn,
  setDefaultColumn,
  setCompletedColumn,
  type RpcError,
} from "@/repositories/workflow-column.repository";
import { getProjectWorkflowId } from "@/repositories/workflow.repository";
import {
  createColumnSchema,
  updateColumnSchema,
  reorderColumnsSchema,
  deleteColumnSchema,
  setDefaultColumnSchema,
  setCompletedColumnSchema,
} from "@/schemas/workflow.schema";

/** Map an RPC's SQLSTATE to the app's typed error envelope, keeping the DB's friendly message. */
function mapRpcError(error: NonNullable<RpcError>): { ok: false; error: ApiError } {
  switch (error.code) {
    case "42501":
      return actionError("FORBIDDEN", error.message);
    case "23505":
      return actionError("CONFLICT", error.message);
    case "23514":
    case "22023":
      return actionError("VALIDATION", error.message);
    case "02000":
    case "P0002":
      return actionError("NOT_FOUND", error.message);
    default:
      return mapUnknownError(error);
  }
}

function revalidateBoard(projectId: string) {
  revalidatePath(`/projects/${projectId}/board`);
  revalidatePath(`/projects/${projectId}/tasks`);
  revalidatePath(`/projects/${projectId}`);
}

export async function createBoardColumn(input: unknown): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  const raw = typeof input === "object" && input !== null ? { ...(input as Record<string, unknown>) } : {};
  if ((!raw.workflowId || typeof raw.workflowId !== "string" || !raw.workflowId.trim()) && typeof raw.projectId === "string") {
    const wfId = await getProjectWorkflowId(raw.projectId, ctx.organization.id);
    if (wfId) raw.workflowId = wfId;
  }
  const parsed = createColumnSchema.safeParse(raw);
  if (!parsed.success) return actionError("VALIDATION", "Please check the column.", toFieldErrors(parsed.error));
  const d = parsed.data;
  const error = await createColumn(d.workflowId, d.name, d.color, d.weight);
  if (error) return mapRpcError(error);
  revalidateBoard(d.projectId);
  return actionOk(undefined);
}

export async function updateBoardColumn(input: unknown): Promise<ActionResult> {
  await requireOrgContext();
  const parsed = updateColumnSchema.safeParse(input);
  if (!parsed.success) return actionError("VALIDATION", "Please check the column.", toFieldErrors(parsed.error));
  const d = parsed.data;
  const error = await updateColumn(d.statusId, d.name ?? null, d.color ?? null, d.weight ?? null);
  if (error) return mapRpcError(error);
  revalidateBoard(d.projectId);
  return actionOk(undefined);
}

export async function reorderBoardColumns(input: unknown): Promise<ActionResult> {
  await requireOrgContext();
  const parsed = reorderColumnsSchema.safeParse(input);
  if (!parsed.success) return actionError("VALIDATION", "Invalid order.", toFieldErrors(parsed.error));
  const d = parsed.data;
  const error = await reorderColumns(d.workflowId, d.ids);
  if (error) return mapRpcError(error);
  revalidateBoard(d.projectId);
  return actionOk(undefined);
}

export async function deleteBoardColumn(input: unknown): Promise<ActionResult> {
  await requireOrgContext();
  const parsed = deleteColumnSchema.safeParse(input);
  if (!parsed.success) return actionError("VALIDATION", "Invalid request.", toFieldErrors(parsed.error));
  const d = parsed.data;
  const error = await deleteColumn(d.statusId, d.reassignTo);
  if (error) return mapRpcError(error);
  revalidateBoard(d.projectId);
  return actionOk(undefined);
}

export async function setDefaultBoardColumn(input: unknown): Promise<ActionResult> {
  await requireOrgContext();
  const parsed = setDefaultColumnSchema.safeParse(input);
  if (!parsed.success) return actionError("VALIDATION", "Invalid request.", toFieldErrors(parsed.error));
  const d = parsed.data;
  const error = await setDefaultColumn(d.statusId);
  if (error) return mapRpcError(error);
  revalidateBoard(d.projectId);
  return actionOk(undefined);
}

export async function setCompletedBoardColumn(input: unknown): Promise<ActionResult> {
  await requireOrgContext();
  const parsed = setCompletedColumnSchema.safeParse(input);
  if (!parsed.success) return actionError("VALIDATION", "Invalid request.", toFieldErrors(parsed.error));
  const d = parsed.data;
  const error = await setCompletedColumn(d.statusId, d.completed);
  if (error) return mapRpcError(error);
  revalidateBoard(d.projectId);
  return actionOk(undefined);
}
