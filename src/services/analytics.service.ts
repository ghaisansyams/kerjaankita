import { addDays, addWeeks, format, startOfWeek } from "date-fns";
import { computeHealth } from "./project.service";

export type Slice = { label: string; value: number; color: string };
export type Point = { label: string; value: number };

export type ATask = {
  createdAt: string;
  completedAt: string | null;
  dueDate: string | null;
  assigneeName: string | null;
  category: string | null;
};
export type AProject = {
  progress: number;
  startDate: string | null;
  endDate: string | null;
  isArchived: boolean;
};

const HEALTH_COLOR: Record<string, string> = {
  on_track: "#10b981",
  at_risk: "#f59e0b",
  delayed: "#ef4444",
};
const HEALTH_LABEL: Record<string, string> = {
  on_track: "On track",
  at_risk: "At risk",
  delayed: "Delayed",
};
const CATEGORY_COLOR: Record<string, string> = {
  todo: "#94a3b8",
  in_progress: "#6366f1",
  blocked: "#ef4444",
  done: "#10b981",
  cancelled: "#64748b",
};
const CATEGORY_LABEL: Record<string, string> = {
  todo: "To do",
  in_progress: "In progress",
  blocked: "Blocked",
  done: "Done",
  cancelled: "Cancelled",
};

const day = (v: string) => v.slice(0, 10);

function weekBuckets(weeks: number, today: Date) {
  const thisWeek = startOfWeek(today, { weekStartsOn: 1 });
  return Array.from({ length: weeks }, (_, i) => {
    const start = addWeeks(thisWeek, i - (weeks - 1));
    return {
      label: format(start, "MMM d"),
      from: format(start, "yyyy-MM-dd"),
      to: format(addDays(start, 6), "yyyy-MM-dd"),
    };
  });
}

export function healthDistribution(
  projects: AProject[],
  tolerance: number,
  today: Date,
): Slice[] {
  const counts: Record<string, number> = { on_track: 0, at_risk: 0, delayed: 0 };
  for (const p of projects) {
    if (p.isArchived) continue;
    const h = computeHealth(
      { progress: p.progress, startDate: p.startDate, endDate: p.endDate },
      tolerance,
      today,
    );
    counts[h] = (counts[h] ?? 0) + 1;
  }
  return ["on_track", "at_risk", "delayed"].map((k) => ({
    label: HEALTH_LABEL[k],
    value: counts[k] ?? 0,
    color: HEALTH_COLOR[k],
  }));
}

export function statusDistribution(tasks: ATask[]): Slice[] {
  const counts: Record<string, number> = {};
  for (const t of tasks) if (t.category) counts[t.category] = (counts[t.category] ?? 0) + 1;
  return ["todo", "in_progress", "blocked", "done", "cancelled"]
    .filter((k) => (counts[k] ?? 0) > 0)
    .map((k) => ({ label: CATEGORY_LABEL[k], value: counts[k], color: CATEGORY_COLOR[k] }));
}

export function progressTrend(tasks: ATask[], today: Date, weeks = 8): Point[] {
  return weekBuckets(weeks, today).map((b) => {
    const created = tasks.filter((t) => day(t.createdAt) <= b.to).length;
    const done = tasks.filter((t) => t.completedAt && day(t.completedAt) <= b.to).length;
    return { label: b.label, value: created ? Math.round((done / created) * 100) : 0 };
  });
}

export function completedOverTime(tasks: ATask[], today: Date, weeks = 8): Point[] {
  return weekBuckets(weeks, today).map((b) => ({
    label: b.label,
    value: tasks.filter((t) => t.completedAt && day(t.completedAt) >= b.from && day(t.completedAt) <= b.to)
      .length,
  }));
}

export function overdueTrend(tasks: ATask[], today: Date, weeks = 8): Point[] {
  return weekBuckets(weeks, today).map((b) => ({
    label: b.label,
    value: tasks.filter((t) => {
      if (!t.dueDate || t.dueDate < b.from || t.dueDate > b.to) return false;
      // Missed = not completed, or completed after the due date.
      return !t.completedAt || day(t.completedAt) > t.dueDate;
    }).length,
  }));
}

export function workloadDistribution(tasks: ATask[], topN = 8): Point[] {
  const counts = new Map<string, number>();
  for (const t of tasks) {
    if (t.completedAt || !t.assigneeName) continue;
    counts.set(t.assigneeName, (counts.get(t.assigneeName) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, topN);
}
