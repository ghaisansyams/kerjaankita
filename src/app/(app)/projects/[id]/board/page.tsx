import { notFound } from "next/navigation";
import { requireOrgContext } from "@/lib/auth";
import { PERMISSIONS } from "@/constants";
import { loadProject } from "@/features/projects/loaders";
import { checkPermission } from "@/repositories/permission.repository";
import { listTasks } from "@/repositories/task.repository";
import { getDefaultTaskWorkflowId, getWorkflowStatuses } from "@/repositories/workflow.repository";
import { KanbanBoard } from "@/features/tasks/components/kanban-board";
import { TaskDrawerLoader } from "@/features/tasks/components/task-drawer-loader";
import type { BoardTask } from "@/features/tasks/queries";

export default async function ProjectBoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ task?: string }>;
}) {
  const { id } = await params;
  const { task: openTaskId } = await searchParams;
  const ctx = await requireOrgContext();
  const orgId = ctx.organization.id;

  const project = await loadProject(id);
  if (!project) notFound();

  const workflowId = await getDefaultTaskWorkflowId(orgId);
  const [statuses, rows, canAny, canOwn] = await Promise.all([
    workflowId ? getWorkflowStatuses(workflowId) : Promise.resolve([]),
    listTasks(id),
    checkPermission(orgId, PERMISSIONS.TASK_UPDATE_ANY, { projectId: id }),
    checkPermission(orgId, PERMISSIONS.TASK_UPDATE_OWN, { projectId: id }),
  ]);

  const initialTasks: BoardTask[] = rows.map((r) => ({
    id: r.id,
    number: r.number,
    title: r.title,
    status_id: r.status_id,
    priority: r.priority,
    assignee_id: r.assignee_id,
    assignee_name: r.assignee?.full_name ?? null,
    assignee_avatar: r.assignee?.avatar_url ?? null,
    due_date: r.due_date,
    progress: r.progress,
    is_blocked: r.is_blocked,
    position: r.position ?? 0,
  }));

  return (
    <>
      <KanbanBoard
        projectId={id}
        currentUserId={ctx.profile.id}
        canAny={canAny}
        canOwn={canOwn}
        statuses={statuses.map((s) => ({
          id: s.id,
          name: s.name,
          color: s.color,
          category: s.category,
        }))}
        initialTasks={initialTasks}
      />
      {openTaskId && (
        <TaskDrawerLoader projectId={id} taskId={openTaskId} returnTo={`/projects/${id}/board`} />
      )}
    </>
  );
}
