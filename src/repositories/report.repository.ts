import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export type ReportScope = { workspaceId?: string; projectId?: string };

export async function reportProjects(orgId: string, scope: ReportScope = {}) {
  const where: Prisma.ProjectWhereInput = {
    organizationId: orgId,
    deletedAt: null,
  };
  if (scope.projectId) where.id = scope.projectId;
  if (scope.workspaceId) where.workspaceId = scope.workspaceId;

  const data = await prisma.project.findMany({
    where,
    select: {
      id: true,
      name: true,
      progress: true,
      startDate: true,
      endDate: true,
      isArchived: true,
      workspaceId: true,
      workspace: {
        select: { name: true },
      },
    },
  });

  return data.map((d) => ({
    id: d.id,
    name: d.name,
    progress: d.progress,
    start_date: d.startDate ? d.startDate.toISOString().split("T")[0] : null,
    end_date: d.endDate ? d.endDate.toISOString().split("T")[0] : null,
    is_archived: d.isArchived,
    workspace_id: d.workspaceId,
    workspace: d.workspace,
  }));
}

export async function reportTasks(orgId: string, scope: ReportScope = {}) {
  const where: Prisma.TaskWhereInput = {
    organizationId: orgId,
    deletedAt: null,
  };
  if (scope.projectId) where.projectId = scope.projectId;
  if (scope.workspaceId) where.project = { workspaceId: scope.workspaceId };

  const data = await prisma.task.findMany({
    where,
    select: {
      id: true,
      title: true,
      dueDate: true,
      completedAt: true,
      estimatedHours: true,
      priority: true,
      assigneeId: true,
      projectId: true,
      project: {
        select: {
          name: true,
          workspaceId: true,
        },
      },
      assignee: {
        select: {
          fullName: true,
        },
      },
      status: {
        select: {
          category: true,
        },
      },
    },
  });

  return data.map((d) => ({
    id: d.id,
    title: d.title,
    due_date: d.dueDate ? d.dueDate.toISOString().split("T")[0] : null,
    completed_at: d.completedAt ? d.completedAt.toISOString() : null,
    estimated_hours: d.estimatedHours ? Number(d.estimatedHours) : null,
    priority: d.priority,
    assignee_id: d.assigneeId,
    project_id: d.projectId,
    project: d.project,
    assignee: d.assignee ? { full_name: d.assignee.fullName } : null,
    status: d.status ? { category: d.status.category } : null,
  }));
}
