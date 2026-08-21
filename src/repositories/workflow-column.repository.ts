import "server-only";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/utils/format";
import type { Prisma } from "@prisma/client";

export type RpcError = { code: string; message: string } | null;

export async function createColumn(
  workflowId: string,
  name: string,
  color: string,
  weight: number,
): Promise<RpcError> {
  try {
    const wf = await prisma.workflow.findUnique({
      where: { id: workflowId },
      select: { organizationId: true },
    });
    if (!wf) return { code: "NOT_FOUND", message: "Workflow not found" };

    const key = `${slugify(name) || "column"}_${Date.now().toString(36)}`;
    await prisma.workflowStatus.create({
      data: {
        organizationId: wf.organizationId,
        workflowId,
        key,
        name,
        color: color || "#64748B",
        position: weight,
        category: "in_progress",
      },
    });
    return null;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Could not create column";
    return { code: "ERROR", message: msg };
  }
}

export async function updateColumn(
  statusId: string,
  name: string | null,
  color: string | null,
  weight: number | null,
): Promise<RpcError> {
  try {
    const data: Prisma.WorkflowStatusUpdateInput = {};
    if (name) data.name = name;
    if (color) data.color = color;
    if (weight !== null) data.position = weight;

    await prisma.workflowStatus.update({
      where: { id: statusId },
      data,
    });
    return null;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Could not update column";
    return { code: "ERROR", message: msg };
  }
}

export async function reorderColumns(workflowId: string, ids: string[]): Promise<RpcError> {
  try {
    await prisma.$transaction(
      ids.map((id, index) =>
        prisma.workflowStatus.update({
          where: { id },
          data: { position: index },
        }),
      ),
    );
    return null;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Could not reorder columns";
    return { code: "ERROR", message: msg };
  }
}

export async function deleteColumn(
  statusId: string,
  reassignTo: string | null,
): Promise<RpcError> {
  try {
    await prisma.$transaction(async (tx) => {
      if (reassignTo) {
        await tx.task.updateMany({
          where: { statusId },
          data: { statusId: reassignTo },
        });
      }
      await tx.workflowStatus.update({
        where: { id: statusId },
        data: { deletedAt: new Date() },
      });
    });
    return null;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Could not delete column";
    return { code: "ERROR", message: msg };
  }
}

export async function setDefaultColumn(statusId: string): Promise<RpcError> {
  try {
    const current = await prisma.workflowStatus.findUnique({
      where: { id: statusId },
      select: { workflowId: true },
    });
    if (!current) return { code: "NOT_FOUND", message: "Column not found" };

    await prisma.$transaction([
      prisma.workflowStatus.updateMany({
        where: { workflowId: current.workflowId },
        data: { isInitial: false },
      }),
      prisma.workflowStatus.update({
        where: { id: statusId },
        data: { isInitial: true },
      }),
    ]);
    return null;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Could not set default column";
    return { code: "ERROR", message: msg };
  }
}

export async function setCompletedColumn(statusId: string, completed: boolean): Promise<RpcError> {
  try {
    await prisma.workflowStatus.update({
      where: { id: statusId },
      data: {
        isFinal: completed,
        category: completed ? "done" : "in_progress",
        autoProgress: completed ? 100 : null,
      },
    });
    return null;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Could not set completed status";
    return { code: "ERROR", message: msg };
  }
}
