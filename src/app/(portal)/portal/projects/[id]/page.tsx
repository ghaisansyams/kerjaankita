import { notFound } from "next/navigation";
import { requireOrgContext } from "@/lib/auth";
import type { StatusCategory } from "@/constants";
import { getProject } from "@/repositories/project.repository";
import { listTasks } from "@/repositories/task.repository";
import { listProjectAttachments } from "@/repositories/attachment.repository";
import { listProjectActivities } from "@/repositories/activity.repository";
import { loadHealthTolerance } from "@/features/projects/loaders";
import { computeHealth } from "@/services/project.service";
import { GuestProjectView } from "@/features/portal/components/guest-project-view";

export default async function PortalProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ task?: string }>;
}) {
  const { id } = await params;
  const { task: openTaskId } = await searchParams;
  const ctx = await requireOrgContext();

  // RLS: getProject returns null unless this project is shared with the guest.
  const project = await getProject(id);
  if (!project) notFound();

  const [tasks, attachments, activities, tolerance] = await Promise.all([
    listTasks(id),
    listProjectAttachments(id),
    listProjectActivities(id, 20),
    loadHealthTolerance(ctx.organization.id),
  ]);

  const health = computeHealth(
    { progress: project.progress, startDate: project.start_date, endDate: project.end_date },
    tolerance,
  );

  return (
    <GuestProjectView
      openTaskId={openTaskId ?? null}
      project={{
        id: project.id,
        name: project.name,
        description: project.description,
        progress: project.progress,
        startDate: project.start_date,
        endDate: project.end_date,
        health,
      }}
      tasks={tasks.map((t) => ({
        id: t.id,
        number: t.number,
        title: t.title,
        statusName: t.status?.name ?? null,
        statusColor: t.status?.color ?? null,
        statusCategory: (t.status?.category ?? "todo") as StatusCategory,
        progress: t.progress,
        assigneeName: t.assignee?.full_name ?? null,
        dueDate: t.due_date,
        isBlocked: t.is_blocked,
      }))}
      files={attachments.map((a) => ({
        id: a.id,
        taskId: a.entity === "task" ? a.entity_id : null,
        fileName: a.file_name,
        fileSize: a.file_size,
        createdAt: a.created_at,
      }))}
      updates={activities.map((a) => ({
        id: a.id,
        action: a.action,
        metadata: (a.metadata as Record<string, unknown>) ?? {},
        actorName: a.actor?.full_name ?? null,
        actorAvatar: a.actor?.avatar_url ?? null,
        createdAt: a.created_at,
      }))}
    />
  );
}
