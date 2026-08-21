import "server-only";
import { prisma } from "@/lib/prisma";

/** Statuses for a specific workflow (drives the status select and the board). */
export async function getWorkflowStatuses(workflowId: string) {
  const data = await prisma.workflowStatus.findMany({
    where: {
      workflowId,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      color: true,
      category: true,
      position: true,
      isInitial: true,
      isFinal: true,
      autoProgress: true,
    },
    orderBy: {
      position: "asc",
    },
  });

  return data.map((d) => ({
    id: d.id,
    name: d.name,
    color: d.color,
    category: d.category,
    position: d.position,
    is_initial: d.isInitial,
    is_final: d.isFinal,
    auto_progress: d.autoProgress,
  }));
}

/**
 * The task workflow a project's board uses.
 */
export async function getProjectWorkflowId(projectId: string, orgId: string) {
  const proj = await prisma.project.findUnique({
    where: { id: projectId },
    select: { workflowId: true },
  });
  if (proj?.workflowId) return proj.workflowId;
  return getDefaultTaskWorkflowId(orgId);
}

export type WorkflowStatus = Awaited<ReturnType<typeof getWorkflowStatuses>>[number];

/** The stable category of a status. */
export async function getStatusCategory(statusId: string) {
  const status = await prisma.workflowStatus.findUnique({
    where: { id: statusId },
    select: { category: true },
  });
  return status?.category ?? null;
}

/** All task workflows in the org. */
export async function listTaskWorkflows(orgId: string) {
  const data = await prisma.workflow.findMany({
    where: {
      organizationId: orgId,
      entity: "task",
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      isDefault: true,
    },
    orderBy: [
      { isDefault: "desc" },
      { name: "asc" },
    ],
  });

  return data.map((d) => ({
    id: d.id,
    name: d.name,
    is_default: d.isDefault,
  }));
}

/** The organization's default task workflow id. */
export async function getDefaultTaskWorkflowId(orgId: string) {
  const wf = await prisma.workflow.findFirst({
    where: {
      organizationId: orgId,
      entity: "task",
      isDefault: true,
      deletedAt: null,
    },
    select: { id: true },
  });
  return wf?.id ?? null;
}
