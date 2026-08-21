import "server-only";
import { prisma } from "@/lib/prisma";

/** Lean task rows for analytics time-series. */
export async function analyticsTasks(orgId: string) {
  const data = await prisma.task.findMany({
    where: {
      organizationId: orgId,
      deletedAt: null,
    },
    select: {
      createdAt: true,
      completedAt: true,
      dueDate: true,
      assigneeId: true,
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
    created_at: d.createdAt.toISOString(),
    completed_at: d.completedAt ? d.completedAt.toISOString() : null,
    due_date: d.dueDate ? d.dueDate.toISOString().split("T")[0] : null,
    assignee_id: d.assigneeId,
    assignee: d.assignee
      ? {
          full_name: d.assignee.fullName,
        }
      : null,
    status: d.status
      ? {
          category: d.status.category,
        }
      : null,
  }));
}
