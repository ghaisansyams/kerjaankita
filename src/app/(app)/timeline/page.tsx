import type { Metadata } from "next";
import { requireInternal } from "@/lib/auth";
import { listTimelineTasks } from "@/repositories/schedule.repository";
import { listWorkspaces } from "@/repositories/workspace.repository";
import { listProjects } from "@/repositories/project.repository";
import { listOrgMemberProfiles } from "@/repositories/member.repository";
import { PageHeader } from "@/components/page-header";
import { TimelineView, type TimelineTaskVM } from "@/features/timeline/components/timeline-view";

export const metadata: Metadata = { title: "Timeline" };

export default async function TimelinePage() {
  const ctx = await requireInternal();
  const orgId = ctx.organization.id;

  const [rows, workspaces, projects, members] = await Promise.all([
    listTimelineTasks(orgId),
    listWorkspaces(orgId),
    listProjects(orgId),
    listOrgMemberProfiles(orgId),
  ]);

  const tasks: TimelineTaskVM[] = rows.map((r) => {
    const start = r.start_date ?? r.due_date!;
    const end = r.due_date ?? r.start_date!;
    return {
      id: r.id,
      title: r.title,
      projectId: r.project_id,
      projectName: r.project?.name ?? "Project",
      projectColor: r.project?.color ?? null,
      workspaceId: r.project?.workspace_id ?? null,
      assigneeId: r.assignee_id,
      assigneeName: r.assignee?.full_name ?? null,
      assigneeAvatar: r.assignee?.avatar_url ?? null,
      // Normalise so start ≤ end even if only one date is set.
      start: start <= end ? start : end,
      end: start <= end ? end : start,
      progress: r.progress,
      isBlocked: r.is_blocked,
      estimatedHours: r.estimated_hours,
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Timeline"
        description="Who is working on what, and when it starts and ends."
      />
      <TimelineView
        tasks={tasks}
        workspaces={workspaces.map((w) => ({ id: w.id, name: w.name }))}
        projects={projects.map((p) => ({ id: p.id, name: p.name, workspaceId: p.workspace_id }))}
        members={members.map((m) => ({ id: m.id, name: m.full_name ?? m.email ?? "Member" }))}
      />
    </div>
  );
}
