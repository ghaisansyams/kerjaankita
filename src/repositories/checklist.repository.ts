import "server-only";
import { prisma } from "@/lib/prisma";

export async function listChecklist(taskId: string) {
  const data = await prisma.taskChecklistItem.findMany({
    where: {
      taskId,
      deletedAt: null,
    },
    select: {
      id: true,
      content: true,
      isDone: true,
      position: true,
      depth: true,
    },
    orderBy: [
      { position: "asc" },
      { createdAt: "asc" },
    ],
  });

  return data.map((d) => ({
    id: d.id,
    content: d.content,
    is_done: d.isDone,
    position: d.position,
    depth: d.depth,
  }));
}

export type ChecklistItem = Awaited<ReturnType<typeof listChecklist>>[number];

export async function insertChecklistItem(values: {
  id?: string;
  organization_id?: string;
  organizationId?: string;
  task_id?: string;
  taskId?: string;
  content: string;
  is_done?: boolean;
  isDone?: boolean;
  position?: number;
  depth?: number;
  created_by?: string | null;
  createdBy?: string | null;
}) {
  await prisma.taskChecklistItem.create({
    data: {
      id: values.id,
      organizationId: values.organizationId || values.organization_id!,
      taskId: values.taskId || values.task_id!,
      content: values.content,
      isDone: values.isDone ?? values.is_done ?? false,
      position: values.position ?? 0,
      depth: values.depth ?? 0,
      createdBy: values.createdBy || values.created_by,
    },
  });
}

export interface UpdateChecklistItemInput {
  content?: string;
  is_done?: boolean;
  isDone?: boolean;
  done_at?: string | Date | null;
  doneAt?: string | Date | null;
  done_by?: string | null;
  doneBy?: string | null;
  position?: number;
  depth?: number;
  updated_by?: string | null;
  updatedBy?: string | null;
  [key: string]: unknown;
}

export async function updateChecklistItem(
  id: string,
  patch: UpdateChecklistItemInput,
) {
  const data = await prisma.taskChecklistItem.update({
    where: { id },
    data: {
      content: patch.content,
      isDone: patch.isDone ?? patch.is_done,
      position: patch.position,
      depth: patch.depth,
      updatedBy: patch.updatedBy || patch.updated_by,
    },
    select: {
      id: true,
      taskId: true,
    },
  });
  return {
    id: data.id,
    task_id: data.taskId,
  };
}

export async function softDeleteChecklistItem(id: string, deletedBy: string) {
  const data = await prisma.taskChecklistItem.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      deletedBy,
    },
    select: {
      id: true,
      taskId: true,
    },
  });
  return {
    id: data.id,
    task_id: data.taskId,
  };
}

export async function setChecklistPositions(orderedIds: string[]) {
  for (let i = 0; i < orderedIds.length; i++) {
    await prisma.taskChecklistItem.update({
      where: { id: orderedIds[i] },
      data: { position: i },
    });
  }
}
