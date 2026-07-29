import type { Metadata } from "next";
import { addMonths, format, startOfMonth, subMonths } from "date-fns";
import { requireInternal } from "@/lib/auth";
import { CLOSED_CATEGORIES, type StatusCategory } from "@/constants";
import { listCalendarTasks } from "@/repositories/schedule.repository";
import { listWorkspaces } from "@/repositories/workspace.repository";
import { listProjects } from "@/repositories/project.repository";
import { listOrgMemberProfiles } from "@/repositories/member.repository";
import { PageHeader } from "@/components/page-header";
import { CalendarView, type CalendarEvent } from "@/features/calendar/components/calendar-view";

export const metadata: Metadata = { title: "Calendar" };

export default async function CalendarPage() {
  const ctx = await requireInternal();
  const orgId = ctx.organization.id;

  // Load a generous window around today; the client navigates within it.
  const anchor = startOfMonth(new Date());
  const from = format(subMonths(anchor, 1), "yyyy-MM-dd");
  const to = format(addMonths(anchor, 3), "yyyy-MM-dd");

  const [taskRows, workspaces, projects, members] = await Promise.all([
    listCalendarTasks(orgId, from, to),
    listWorkspaces(orgId),
    listProjects(orgId),
    listOrgMemberProfiles(orgId),
  ]);

  const taskEvents: CalendarEvent[] = taskRows.map((r) => ({
    id: r.id,
    kind: "task",
    title: r.title,
    date: r.due_date!,
    projectId: r.project_id,
    projectName: r.project?.name ?? "Project",
    projectColor: r.project?.color ?? null,
    workspaceId: r.project?.workspace_id ?? null,
    assigneeId: r.assignee_id,
    isBlocked: r.is_blocked,
    done: CLOSED_CATEGORIES.includes((r.status?.category ?? "todo") as StatusCategory),
  }));

  return (
    <div className="space-y-6">
      <PageHeader title="Calendar" description="Task deadlines by date." />
      <CalendarView
        initialEvents={taskEvents}
        workspaces={workspaces.map((w) => ({ id: w.id, name: w.name }))}
        projects={projects.map((p) => ({ id: p.id, name: p.name, workspaceId: p.workspace_id }))}
        members={members.map((m) => ({ id: m.id, name: m.full_name ?? m.email ?? "Member" }))}
      />
    </div>
  );
}
