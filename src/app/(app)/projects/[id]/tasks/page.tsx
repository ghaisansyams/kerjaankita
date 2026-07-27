import { notFound } from "next/navigation";
import { requireOrgContext } from "@/lib/auth";
import { PERMISSIONS, type StatusCategory } from "@/constants";
import { loadProject } from "@/features/projects/loaders";
import { checkPermission } from "@/repositories/permission.repository";
import { listTasks } from "@/repositories/task.repository";
import { listOrgMemberProfiles } from "@/repositories/member.repository";
import { TasksPanel, type TaskVM } from "@/features/tasks/components/tasks-panel";
import { TaskDrawerLoader } from "@/features/tasks/components/task-drawer-loader";

export default async function ProjectTasksPage({
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

  const [canCreate, rows, members] = await Promise.all([
    checkPermission(orgId, PERMISSIONS.TASK_CREATE, { projectId: id }),
    listTasks(id),
    listOrgMemberProfiles(orgId),
  ]);

  const tasks: TaskVM[] = rows.map((r) => ({
    id: r.id,
    number: r.number,
    title: r.title,
    statusName: r.status?.name ?? null,
    statusColor: r.status?.color ?? null,
    statusCategory: (r.status?.category ?? "todo") as StatusCategory,
    priority: r.priority,
    assigneeName: r.assignee?.full_name ?? null,
    assigneeAvatar: r.assignee?.avatar_url ?? null,
    dueDate: r.due_date,
    progress: r.progress,
    isBlocked: r.is_blocked,
  }));

  const memberOptions = members.map((m) => ({
    id: m.id,
    name: m.full_name ?? m.email ?? "Member",
  }));

  return (
    <>
      <TasksPanel projectId={id} tasks={tasks} members={memberOptions} canCreate={canCreate} />
      {openTaskId && (
        <TaskDrawerLoader projectId={id} taskId={openTaskId} returnTo={`/projects/${id}/tasks`} />
      )}
    </>
  );
}
