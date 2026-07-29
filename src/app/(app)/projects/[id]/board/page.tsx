import { notFound } from "next/navigation";
import { requireOrgContext } from "@/lib/auth";
import { PERMISSIONS } from "@/constants";
import { loadProject } from "@/features/projects/loaders";
import { checkPermission } from "@/repositories/permission.repository";
import { getBoardData } from "@/repositories/task.repository";
import { getProjectWorkflowId, getWorkflowStatuses } from "@/repositories/workflow.repository";
import { KanbanBoard } from "@/features/tasks/components/kanban-board";

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

  const workflowId = await getProjectWorkflowId(id, orgId);
  const [statuses, initialTasks, canAny, canOwn, canManageWorkflow, canCreate] = await Promise.all([
    workflowId ? getWorkflowStatuses(workflowId) : Promise.resolve([]),
    getBoardData(id),
    checkPermission(orgId, PERMISSIONS.TASK_UPDATE_ANY, { projectId: id }),
    checkPermission(orgId, PERMISSIONS.TASK_UPDATE_OWN, { projectId: id }),
    checkPermission(orgId, PERMISSIONS.WORKFLOW_MANAGE, { projectId: id }),
    checkPermission(orgId, PERMISSIONS.TASK_CREATE, { projectId: id }),
  ]);

  return (
    <KanbanBoard
      projectId={id}
      workflowId={workflowId ?? ""}
      currentUserId={ctx.profile.id}
      canAny={canAny}
      canOwn={canOwn}
      canManageWorkflow={canManageWorkflow}
      canCreate={canCreate}
      statuses={statuses.map((s) => ({
        id: s.id,
        name: s.name,
        color: s.color,
        category: s.category,
        position: s.position,
        isInitial: s.is_initial,
        isFinal: s.is_final,
        weight: s.auto_progress ?? 0,
      }))}
      initialTasks={initialTasks}
      initialTaskId={openTaskId ?? null}
    />
  );
}
