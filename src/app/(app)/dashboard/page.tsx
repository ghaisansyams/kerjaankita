import type { Metadata } from "next";
import { endOfWeek, format, startOfWeek } from "date-fns";
import {
  AlertOctagon,
  CalendarClock,
  CheckCircle2,
  FolderKanban,
} from "lucide-react";
import { requireOrgContext } from "@/lib/auth";
import { loadHealthTolerance } from "@/features/projects/loaders";
import {
  countCompletedSince,
  getTaskDueCounts,
  listMyOpenTasks,
  listProjectHealthRows,
  listTeamWorkload,
} from "@/repositories/dashboard.repository";
import { listRecentActivities } from "@/repositories/activity.repository";
import { summarizeProjects } from "@/services/dashboard.service";
import { StatCard, type Stat } from "@/features/dashboard/components/stat-card";
import { QuickCreate } from "@/features/dashboard/components/quick-create";
import { MyTasks, type MyTaskVM } from "@/features/dashboard/components/my-tasks";
import { ActivityFeed } from "@/features/dashboard/components/activity-feed";
import { BarChart, DonutChart } from "@/features/analytics/components/charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const ctx = await requireOrgContext();
  const orgId = ctx.organization.id;
  const firstName = ctx.profile.full_name?.split(" ")[0] ?? "there";

  const today = new Date();
  const todayIso = format(today, "yyyy-MM-dd");
  const weekEndIso = format(endOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const weekStartIso = startOfWeek(today, { weekStartsOn: 1 }).toISOString();

  const [projectRows, dueCounts, completedWeek, myTasks, workload, activities, tolerance] =
    await Promise.all([
      listProjectHealthRows(orgId),
      getTaskDueCounts(orgId, todayIso, weekEndIso),
      countCompletedSince(orgId, weekStartIso),
      listMyOpenTasks(orgId, ctx.profile.id),
      listTeamWorkload(orgId),
      listRecentActivities(orgId, 9), // 1 extra: tells us whether "show all" is warranted
      loadHealthTolerance(orgId),
    ]);

  const projects = summarizeProjects(projectRows, tolerance, today);
  const onTrack = Math.max(0, projects.active - projects.delayed - projects.atRisk);

  const kpis: Stat[] = [
    { label: "Active projects", value: projects.active, icon: FolderKanban, href: "/projects" },
    { label: "Due today", value: dueCounts.dueToday, icon: CalendarClock, href: "/calendar", tone: dueCounts.dueToday ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300" : undefined },
    { label: "Overdue", value: dueCounts.overdue, icon: AlertOctagon, tone: dueCounts.overdue ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300" : undefined },
    { label: "Completed this week", value: completedWeek, icon: CheckCircle2, tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300" },
  ];

  const health = [
    { label: "On track", value: onTrack, color: "#10b981" },
    { label: "At risk", value: projects.atRisk, color: "#f59e0b" },
    { label: "Delayed", value: projects.delayed, color: "#ef4444" },
  ];

  const wl = new Map<string, { name: string; count: number }>();
  for (const r of workload) {
    const id = r.assignee_id;
    if (!id) continue;
    const cur = wl.get(id) ?? { name: r.assignee?.full_name ?? "Member", count: 0 };
    cur.count += 1;
    wl.set(id, cur);
  }
  const workloadPoints = [...wl.values()].sort((a, b) => b.count - a.count).slice(0, 6).map((w) => ({ label: w.name, value: w.count }));

  const myTaskVMs: MyTaskVM[] = myTasks.map((t) => ({
    id: t.id,
    number: t.number,
    title: t.title,
    dueDate: t.due_date,
    progress: t.progress,
    projectId: t.project_id,
    projectName: t.project?.name ?? "Project",
    statusName: t.status?.name ?? null,
    statusColor: t.status?.color ?? null,
    category: t.status?.category ?? null,
  }));

  return (
    <div className="space-y-6">
      {/* Row 1 — welcome + quick create */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Welcome back, {firstName}</h1>
          <p className="text-sm text-muted-foreground">
            {ctx.organization.name} · here&apos;s what needs your attention today.
          </p>
        </div>
        <QuickCreate />
      </header>

      {/* Row 2 — KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      {/* Row 3 — My tasks */}
      <MyTasks tasks={myTaskVMs} today={today} />

      {/* Row 4 — insights */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Project health</CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChart data={health} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Team workload</CardTitle>
            <p className="text-xs text-muted-foreground">Open tasks per member</p>
          </CardHeader>
          <CardContent>
            <BarChart data={workloadPoints} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4">
        <ActivityFeed
          hasMore={activities.length > 8}
          items={activities.map((a) => ({
            id: a.id,
            action: a.action,
            entity: a.entity,
            entityId: a.entity_id,
            metadata: (a.metadata as Record<string, unknown>) ?? {},
            actorName: a.actor?.full_name ?? null,
            actorAvatar: a.actor?.avatar_url ?? null,
            createdAt: a.created_at,
          }))}
        />
      </div>
    </div>
  );
}
