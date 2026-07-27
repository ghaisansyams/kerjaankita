import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth";
import { PERMISSIONS } from "@/constants";
import { listProjectHealthRows } from "@/repositories/dashboard.repository";
import { analyticsTasks } from "@/repositories/analytics.repository";
import { loadHealthTolerance } from "@/features/projects/loaders";
import {
  completedOverTime,
  healthDistribution,
  overdueTrend,
  progressTrend,
  statusDistribution,
  workloadDistribution,
} from "@/services/analytics.service";
import { PageHeader } from "@/components/page-header";
import { BarChart, ChartCard, DonutChart, LineChart } from "@/features/analytics/components/charts";

export const metadata: Metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  const ctx = await requirePermission(PERMISSIONS.REPORT_VIEW);
  const orgId = ctx.organization.id;
  const today = new Date();

  const [projectRows, taskRows, tolerance] = await Promise.all([
    listProjectHealthRows(orgId),
    analyticsTasks(orgId),
    loadHealthTolerance(orgId),
  ]);

  const aProjects = projectRows.map((p) => ({
    progress: p.progress,
    startDate: p.start_date,
    endDate: p.end_date,
    isArchived: p.is_archived,
  }));
  const aTasks = taskRows.map((t) => ({
    createdAt: t.created_at,
    completedAt: t.completed_at,
    dueDate: t.due_date,
    assigneeName: t.assignee?.full_name ?? null,
    category: t.status?.category ?? null,
  }));

  const health = healthDistribution(aProjects, tolerance, today);
  const status = statusDistribution(aTasks);
  const progress = progressTrend(aTasks, today);
  const workload = workloadDistribution(aTasks);
  const completed = completedOverTime(aTasks, today);
  const overdue = overdueTrend(aTasks, today);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Executive metrics, derived live from your projects and tasks."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Project health distribution"
          table={{ columns: ["Health", "Projects"], rows: health.map((s) => [s.label, s.value]) }}
        >
          <DonutChart data={health} />
        </ChartCard>

        <ChartCard
          title="Task status distribution"
          table={{ columns: ["Status", "Tasks"], rows: status.map((s) => [s.label, s.value]) }}
        >
          <DonutChart data={status} />
        </ChartCard>

        <ChartCard
          title="Project progress trend"
          description="Completed vs created tasks, cumulative, by week."
          table={{ columns: ["Week", "Progress %"], rows: progress.map((p) => [p.label, p.value]) }}
        >
          <LineChart data={progress} max={100} suffix="%" />
        </ChartCard>

        <ChartCard
          title="Team workload distribution"
          description="Open tasks per member."
          table={{ columns: ["Member", "Open tasks"], rows: workload.map((p) => [p.label, p.value]) }}
        >
          <BarChart data={workload} />
        </ChartCard>

        <ChartCard
          title="Completed tasks over time"
          table={{ columns: ["Week", "Completed"], rows: completed.map((p) => [p.label, p.value]) }}
        >
          <LineChart data={completed} />
        </ChartCard>

        <ChartCard
          title="Overdue trend"
          description="Tasks that missed their deadline, by due-date week."
          table={{ columns: ["Week", "Missed"], rows: overdue.map((p) => [p.label, p.value]) }}
        >
          <LineChart data={overdue} />
        </ChartCard>
      </div>
    </div>
  );
}
