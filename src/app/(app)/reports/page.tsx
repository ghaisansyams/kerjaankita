import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth";
import { PERMISSIONS } from "@/constants";
import {
  reportMilestones,
  reportProjects,
  reportTasks,
} from "@/repositories/report.repository";
import { listOrgMemberProfiles } from "@/repositories/member.repository";
import { listWorkspaces } from "@/repositories/workspace.repository";
import { listProjects } from "@/repositories/project.repository";
import { loadHealthTolerance } from "@/features/projects/loaders";
import {
  buildMemberProductivity,
  buildMilestoneCompletion,
  buildOverdue,
  buildProjectProgress,
  buildTaskCompletion,
  buildWorkload,
  type ReportVM,
} from "@/services/reports.service";
import { PageHeader } from "@/components/page-header";
import { ReportsView } from "@/features/reports/components/reports-view";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ workspace?: string; project?: string; from?: string; to?: string }>;
}) {
  const { workspace, project, from, to } = await searchParams;
  const ctx = await requirePermission(PERMISSIONS.REPORT_VIEW);
  const orgId = ctx.organization.id;

  const scope = { workspaceId: workspace, projectId: project };
  const range = { from, to };
  const today = new Date();

  const [projects, tasks, milestones, members, workspaces, allProjects, tolerance] =
    await Promise.all([
      reportProjects(orgId, scope),
      reportTasks(orgId, scope),
      reportMilestones(orgId, scope),
      listOrgMemberProfiles(orgId),
      listWorkspaces(orgId),
      listProjects(orgId),
      loadHealthTolerance(orgId),
    ]);

  const rProjects = projects.map((p) => ({
    id: p.id,
    name: p.name,
    progress: p.progress,
    startDate: p.start_date,
    endDate: p.end_date,
    isArchived: p.is_archived,
    workspaceName: p.workspace?.name ?? null,
  }));
  const rTasks = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    dueDate: t.due_date,
    completedAt: t.completed_at,
    estimatedHours: t.estimated_hours,
    priority: t.priority,
    assigneeId: t.assignee_id,
    assigneeName: t.assignee?.full_name ?? null,
    projectId: t.project_id,
    projectName: t.project?.name ?? "Project",
    category: t.status?.category ?? null,
  }));
  const rMilestones = milestones.map((m) => ({
    id: m.id,
    name: m.name,
    dueDate: m.due_date,
    achievedAt: m.achieved_at,
    projectId: m.project_id,
  }));
  const rMembers = members.map((m) => ({ id: m.id, name: m.full_name ?? m.email ?? "Member" }));

  const reports: ReportVM[] = [
    buildProjectProgress(rProjects, tolerance, today),
    buildMemberProductivity(rMembers, rTasks, range),
    buildTaskCompletion(rProjects, rTasks, range),
    buildOverdue(rTasks, range, today),
    buildWorkload(rMembers, rTasks),
    buildMilestoneCompletion(rProjects, rMilestones, range, today),
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="Project, team and delivery reporting." />
      <ReportsView
        reports={reports}
        workspaces={workspaces.map((w) => ({ id: w.id, name: w.name }))}
        projects={allProjects.map((p) => ({ id: p.id, name: p.name, workspaceId: p.workspace_id }))}
        filters={{ workspace: workspace ?? "", project: project ?? "", from: from ?? "", to: to ?? "" }}
      />
    </div>
  );
}
