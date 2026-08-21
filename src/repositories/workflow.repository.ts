import "server-only";
import { prisma } from "@/lib/prisma";
import type { StatusCategory } from "@prisma/client";

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
  let wf = await prisma.workflow.findFirst({
    where: {
      organizationId: orgId,
      entity: "task",
      isDefault: true,
      deletedAt: null,
    },
    select: { id: true },
  });

  if (!wf) {
    wf = await prisma.workflow.findFirst({
      where: {
        organizationId: orgId,
        entity: "task",
        deletedAt: null,
      },
      select: { id: true },
    });
  }

  if (!wf) {
    try {
      const newWf = await prisma.workflow.create({
        data: {
          organizationId: orgId,
          name: "Default Workflow",
          entity: "task",
          isDefault: true,
          isSystem: true,
        },
      });

      const defaultStatuses: {
        key: string;
        name: string;
        category: StatusCategory;
        color: string;
        position: number;
        isInitial: boolean;
        isFinal: boolean;
        autoProgress: number;
      }[] = [
        { key: "backlog", name: "Backlog", category: "backlog", color: "#94A3B8", position: 0, isInitial: true, isFinal: false, autoProgress: 0 },
        { key: "todo", name: "To Do", category: "todo", color: "#64748B", position: 1, isInitial: false, isFinal: false, autoProgress: 0 },
        { key: "in_progress", name: "In Progress", category: "in_progress", color: "#3B82F6", position: 2, isInitial: false, isFinal: false, autoProgress: 50 },
        { key: "review", name: "In Review", category: "review", color: "#F59E0B", position: 3, isInitial: false, isFinal: false, autoProgress: 80 },
        { key: "done", name: "Done", category: "done", color: "#10B981", position: 4, isInitial: false, isFinal: true, autoProgress: 100 },
      ];

      for (const st of defaultStatuses) {
        await prisma.workflowStatus.create({
          data: {
            organizationId: orgId,
            workflowId: newWf.id,
            key: `${st.key}_${Date.now().toString(36)}`,
            name: st.name,
            category: st.category,
            color: st.color,
            position: st.position,
            isInitial: st.isInitial,
            isFinal: st.isFinal,
            autoProgress: st.autoProgress,
          },
        });
      }

      return newWf.id;
    } catch {
      return null;
    }
  }

  return wf.id;
}
