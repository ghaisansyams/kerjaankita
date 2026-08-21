import "server-only";
import { prisma } from "@/lib/prisma";

/** Lean project rows for health/progress rollups. */
export async function listProjectHealthRows(orgId: string) {
  const data = await prisma.project.findMany({
    where: {
      organizationId: orgId,
      deletedAt: null,
    },
    select: {
      id: true,
      progress: true,
      startDate: true,
      endDate: true,
      isArchived: true,
    },
  });

  return data.map((d) => ({
    id: d.id,
    progress: d.progress,
    start_date: d.startDate ? d.startDate.toISOString().split("T")[0] : null,
    end_date: d.endDate ? d.endDate.toISOString().split("T")[0] : null,
    is_archived: d.isArchived,
  }));
}

export type ProjectHealthRow = Awaited<ReturnType<typeof listProjectHealthRows>>[number];

export async function countActiveMembers(orgId: string) {
  const count = await prisma.organizationMember.count({
    where: {
      organizationId: orgId,
      status: "active",
      deletedAt: null,
    },
  });
  return count;
}

/** Open (not completed, not deleted) task counts by due-date window. */
export async function getTaskDueCounts(orgId: string, todayIso: string, weekEndIso: string) {
  const baseWhere = {
    organizationId: orgId,
    deletedAt: null,
    completedAt: null,
  };

  const [dueToday, dueThisWeek, overdue, openAssigned] = await Promise.all([
    prisma.task.count({
      where: {
        ...baseWhere,
        dueDate: {
          gte: new Date(`${todayIso}T00:00:00.000Z`),
          lte: new Date(`${todayIso}T23:59:59.999Z`),
        },
      },
    }),
    prisma.task.count({
      where: {
        ...baseWhere,
        dueDate: {
          gte: new Date(`${todayIso}T00:00:00.000Z`),
          lte: new Date(`${weekEndIso}T23:59:59.999Z`),
        },
      },
    }),
    prisma.task.count({
      where: {
        ...baseWhere,
        dueDate: {
          lt: new Date(`${todayIso}T00:00:00.000Z`),
        },
      },
    }),
    prisma.task.count({
      where: {
        ...baseWhere,
        assigneeId: { not: null },
      },
    }),
  ]);

  return {
    dueToday,
    dueThisWeek,
    overdue,
    openAssigned,
  };
}

/** Tasks completed on/after `fromIso` (start of the current week). */
export async function countCompletedSince(orgId: string, fromIso: string) {
  const count = await prisma.task.count({
    where: {
      organizationId: orgId,
      deletedAt: null,
      completedAt: {
        gte: new Date(fromIso),
      },
    },
  });
  return count;
}

/** The current user's open assigned tasks, for the "My Tasks" widget. */
export async function listMyOpenTasks(orgId: string, userId: string) {
  const data = await prisma.task.findMany({
    where: {
      organizationId: orgId,
      assigneeId: userId,
      deletedAt: null,
      completedAt: null,
    },
    select: {
      id: true,
      number: true,
      title: true,
      dueDate: true,
      progress: true,
      projectId: true,
      status: {
        select: {
          name: true,
          color: true,
          category: true,
        },
      },
      project: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      dueDate: "asc",
    },
    take: 60,
  });

  return data.map((d) => ({
    id: d.id,
    number: d.number,
    title: d.title,
    due_date: d.dueDate ? d.dueDate.toISOString().split("T")[0] : null,
    progress: d.progress,
    project_id: d.projectId,
    status: d.status
      ? {
          name: d.status.name,
          color: d.status.color,
          category: d.status.category,
        }
      : null,
    project: d.project
      ? {
          name: d.project.name,
        }
      : null,
  }));
}

/** Open task load per member (assignee), for the Team Workload widget. */
export async function listTeamWorkload(orgId: string) {
  const data = await prisma.task.findMany({
    where: {
      organizationId: orgId,
      deletedAt: null,
      completedAt: null,
      assigneeId: { not: null },
    },
    select: {
      assigneeId: true,
      assignee: {
        select: {
          fullName: true,
          avatarUrl: true,
        },
      },
    },
  });

  return data.map((d) => ({
    assignee_id: d.assigneeId,
    assignee: d.assignee
      ? {
          full_name: d.assignee.fullName,
          avatar_url: d.assignee.avatarUrl,
        }
      : null,
  }));
}
