import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export type ScheduleFilters = {
  workspaceId?: string;
  projectId?: string;
  assigneeId?: string;
};

/**
 * Org-wide tasks that have at least a start or a due date, for the Timeline.
 */
export async function listTimelineTasks(orgId: string, filters: ScheduleFilters = {}) {
  const where: Prisma.TaskWhereInput = {
    organizationId: orgId,
    deletedAt: null,
    OR: [
      { startDate: { not: null } },
      { dueDate: { not: null } },
    ],
  };

  if (filters.projectId) where.projectId = filters.projectId;
  if (filters.assigneeId) where.assigneeId = filters.assigneeId;
  if (filters.workspaceId) where.project = { workspaceId: filters.workspaceId };

  const data = await prisma.task.findMany({
    where,
    select: {
      id: true,
      title: true,
      startDate: true,
      dueDate: true,
      progress: true,
      isBlocked: true,
      priority: true,
      estimatedHours: true,
      assigneeId: true,
      projectId: true,
      project: {
        select: {
          id: true,
          name: true,
          color: true,
          workspaceId: true,
        },
      },
      assignee: {
        select: {
          id: true,
          fullName: true,
          avatarUrl: true,
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
    start_date: d.startDate ? d.startDate.toISOString().split("T")[0] : null,
    due_date: d.dueDate ? d.dueDate.toISOString().split("T")[0] : null,
    progress: d.progress,
    is_blocked: d.isBlocked,
    priority: d.priority,
    estimated_hours: d.estimatedHours ? Number(d.estimatedHours) : null,
    assignee_id: d.assigneeId,
    project_id: d.projectId,
    project: d.project ? {
      id: d.project.id,
      name: d.project.name,
      color: d.project.color,
      workspace_id: d.project.workspaceId,
      workspaceId: d.project.workspaceId,
    } : null,
    assignee: d.assignee ? {
      id: d.assignee.id,
      full_name: d.assignee.fullName,
      avatar_url: d.assignee.avatarUrl,
    } : null,
    status: d.status ? {
      category: d.status.category,
    } : null,
  }));
}

/** Tasks with a due date inside [from, to] (inclusive), for the Calendar. */
export async function listCalendarTasks(
  orgId: string,
  from: string,
  to: string,
  filters: ScheduleFilters = {},
) {
  const where: Prisma.TaskWhereInput = {
    organizationId: orgId,
    deletedAt: null,
    dueDate: {
      gte: new Date(from),
      lte: new Date(to),
    },
  };

  if (filters.projectId) where.projectId = filters.projectId;
  if (filters.assigneeId) where.assigneeId = filters.assigneeId;
  if (filters.workspaceId) where.project = { workspaceId: filters.workspaceId };

  const data = await prisma.task.findMany({
    where,
    select: {
      id: true,
      title: true,
      dueDate: true,
      isBlocked: true,
      priority: true,
      projectId: true,
      assigneeId: true,
      project: {
        select: {
          id: true,
          name: true,
          color: true,
          workspaceId: true,
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
    is_blocked: d.isBlocked,
    priority: d.priority,
    project_id: d.projectId,
    assignee_id: d.assigneeId,
    project: d.project ? {
      id: d.project.id,
      name: d.project.name,
      color: d.project.color,
      workspace_id: d.project.workspaceId,
      workspaceId: d.project.workspaceId,
    } : null,
    status: d.status ? {
      category: d.status.category,
    } : null,
  }));
}
