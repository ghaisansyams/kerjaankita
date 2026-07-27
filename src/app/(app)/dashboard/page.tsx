import type { Metadata } from "next";
import { endOfWeek, format } from "date-fns";
import {
  AlertOctagon,
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Clock,
  FolderKanban,
  Gauge,
  TrendingUp,
  Users,
} from "lucide-react";
import { requireOrgContext } from "@/lib/auth";
import { loadHealthTolerance } from "@/features/projects/loaders";
import {
  countActiveMembers,
  getTaskDueCounts,
  listProjectHealthRows,
} from "@/repositories/dashboard.repository";
import { listRecentActivities } from "@/repositories/activity.repository";
import { listUpcomingMilestones } from "@/repositories/schedule.repository";
import { averageWorkload, summarizeProjects } from "@/services/dashboard.service";
import { PageHeader } from "@/components/page-header";
import { StatCard, type Stat } from "@/features/dashboard/components/stat-card";
import { ActivityFeed } from "@/features/dashboard/components/activity-feed";
import { UpcomingMilestones } from "@/features/dashboard/components/upcoming-milestones";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const ctx = await requireOrgContext();
  const orgId = ctx.organization.id;
  const firstName = ctx.profile.full_name?.split(" ")[0] ?? "there";

  const today = new Date();
  const todayIso = format(today, "yyyy-MM-dd");
  const weekEndIso = format(endOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd");

  const [projectRows, memberCount, dueCounts, activities, milestones, tolerance] =
    await Promise.all([
      listProjectHealthRows(orgId),
      countActiveMembers(orgId),
      getTaskDueCounts(orgId, todayIso, weekEndIso),
      listRecentActivities(orgId, 12),
      listUpcomingMilestones(orgId, todayIso, 6),
      loadHealthTolerance(orgId),
    ]);

  const projects = summarizeProjects(projectRows, tolerance, today);
  const workload = averageWorkload(dueCounts.openAssigned, memberCount);

  const stats: Stat[] = [
    { label: "Active projects", value: projects.active, icon: FolderKanban, href: "/projects" },
    { label: "Completed projects", value: projects.completed, icon: CheckCircle2, tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300" },
    { label: "Delayed projects", value: projects.delayed, icon: Clock, tone: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300" },
    { label: "Projects at risk", value: projects.atRisk, icon: AlertTriangle, tone: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300" },
    { label: "Total members", value: memberCount, icon: Users },
    { label: "Tasks due today", value: dueCounts.dueToday, icon: CalendarClock, href: "/calendar" },
    { label: "Due this week", value: dueCounts.dueThisWeek, icon: CalendarDays, href: "/calendar" },
    { label: "Overdue tasks", value: dueCounts.overdue, icon: AlertOctagon, tone: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300" },
    { label: "Avg. project progress", value: `${projects.avgProgress}%`, icon: TrendingUp },
    { label: "Avg. team workload", value: workload, icon: Gauge, hint: "open tasks / member" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description={`${ctx.organization.name} · executive overview`}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ActivityFeed
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
        <UpcomingMilestones
          items={milestones.map((m) => ({
            id: m.id,
            name: m.name,
            dueDate: m.due_date,
            projectId: m.project_id,
            projectName: m.project?.name ?? "Project",
            projectColor: m.project?.color ?? null,
          }))}
        />
      </div>
    </div>
  );
}
