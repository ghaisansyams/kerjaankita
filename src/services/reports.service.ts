import { differenceInCalendarDays } from "date-fns";
import { toDate } from "@/utils/format";
import { computeHealth } from "./project.service";
import { PROJECT_HEALTH_LABELS, PRIORITY_RANK, type Priority } from "@/constants";

/* -------------------------------------------------------------------------- */
/*  View-model shape (export-ready: a CSV/PDF writer consumes columns+rows)     */
/* -------------------------------------------------------------------------- */

export type ReportColumn = { key: string; label: string; numeric?: boolean };
export type ReportRow = Record<string, string | number>;
export type ReportVM = {
  key: string;
  title: string;
  description: string;
  columns: ReportColumn[];
  rows: ReportRow[];
};

export type DateRange = { from?: string; to?: string };

export type RTask = {
  id: string;
  title: string;
  dueDate: string | null;
  completedAt: string | null;
  estimatedHours: number | null;
  priority: string;
  assigneeId: string | null;
  assigneeName: string | null;
  projectId: string;
  projectName: string;
  category: string | null;
};
export type RProject = {
  id: string;
  name: string;
  progress: number;
  startDate: string | null;
  endDate: string | null;
  isArchived: boolean;
  workspaceName: string | null;
};
export type RMember = { id: string; name: string };
export type RMilestone = {
  id: string;
  name: string;
  dueDate: string | null;
  achievedAt: string | null;
  projectId: string;
};

function inRange(value: string | null, r: DateRange): boolean {
  if (!value) return false;
  const d = value.slice(0, 10);
  return (!r.from || d >= r.from) && (!r.to || d <= r.to);
}
const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 100) : 0);

/* -------------------------------------------------------------------------- */
/*  Builders                                                                   */
/* -------------------------------------------------------------------------- */

export function buildProjectProgress(
  projects: RProject[],
  tolerance: number,
  today: Date,
): ReportVM {
  const rows = projects
    .filter((p) => !p.isArchived)
    .map((p) => {
      const health = computeHealth(
        { progress: p.progress, startDate: p.startDate, endDate: p.endDate },
        tolerance,
        today,
      );
      const end = toDate(p.endDate);
      return {
        project: p.name,
        workspace: p.workspaceName ?? "—",
        progress: p.progress,
        health: PROJECT_HEALTH_LABELS[health],
        due: p.endDate ?? "—",
        daysLeft: end ? differenceInCalendarDays(end, today) : "—",
      };
    });
  return {
    key: "project-progress",
    title: "Project Progress",
    description: "Progress and health for every active project.",
    columns: [
      { key: "project", label: "Project" },
      { key: "workspace", label: "Workspace" },
      { key: "progress", label: "Progress %", numeric: true },
      { key: "health", label: "Health" },
      { key: "due", label: "Due" },
      { key: "daysLeft", label: "Days left", numeric: true },
    ],
    rows,
  };
}

export function buildMemberProductivity(
  members: RMember[],
  tasks: RTask[],
  range: DateRange,
): ReportVM {
  const rows = members.map((m) => {
    const assigned = tasks.filter((t) => t.assigneeId === m.id);
    const completed = assigned.filter((t) => t.completedAt && inRange(t.completedAt, range));
    const open = assigned.filter((t) => !t.completedAt);
    return {
      member: m.name,
      assigned: assigned.length,
      completed: completed.length,
      open: open.length,
      completion: pct(completed.length, assigned.length),
    };
  });
  return {
    key: "member-productivity",
    title: "Member Productivity",
    description: "Tasks assigned, completed (in range) and still open, per member.",
    columns: [
      { key: "member", label: "Member" },
      { key: "assigned", label: "Assigned", numeric: true },
      { key: "completed", label: "Completed", numeric: true },
      { key: "open", label: "Open", numeric: true },
      { key: "completion", label: "Completion %", numeric: true },
    ],
    rows,
  };
}

export function buildTaskCompletion(
  projects: RProject[],
  tasks: RTask[],
  range: DateRange,
): ReportVM {
  const rows = projects
    .filter((p) => !p.isArchived)
    .map((p) => {
      const own = tasks.filter((t) => t.projectId === p.id);
      const completed = own.filter((t) => t.completedAt && inRange(t.completedAt, range));
      const open = own.filter((t) => !t.completedAt);
      const total = completed.length + open.length;
      return {
        project: p.name,
        completed: completed.length,
        open: open.length,
        total,
        completion: pct(completed.length, total),
      };
    });
  return {
    key: "task-completion",
    title: "Task Completion",
    description: "Completed vs open tasks per project (completions honour the date range).",
    columns: [
      { key: "project", label: "Project" },
      { key: "completed", label: "Completed", numeric: true },
      { key: "open", label: "Open", numeric: true },
      { key: "total", label: "Total", numeric: true },
      { key: "completion", label: "Completion %", numeric: true },
    ],
    rows,
  };
}

export function buildOverdue(tasks: RTask[], range: DateRange, today: Date): ReportVM {
  const todayIso = today.toISOString().slice(0, 10);
  const rows = tasks
    .filter(
      (t) =>
        !t.completedAt &&
        t.dueDate &&
        t.dueDate < todayIso &&
        (!range.from && !range.to ? true : inRange(t.dueDate, range)),
    )
    .map((t) => ({
      task: t.title,
      project: t.projectName,
      assignee: t.assigneeName ?? "Unassigned",
      due: t.dueDate as string,
      daysOverdue: differenceInCalendarDays(today, toDate(t.dueDate)!),
    }))
    .sort((a, b) => (b.daysOverdue as number) - (a.daysOverdue as number));
  return {
    key: "overdue",
    title: "Overdue",
    description: "Open tasks past their due date, most overdue first.",
    columns: [
      { key: "task", label: "Task" },
      { key: "project", label: "Project" },
      { key: "assignee", label: "Assignee" },
      { key: "due", label: "Due" },
      { key: "daysOverdue", label: "Days overdue", numeric: true },
    ],
    rows,
  };
}

export function buildWorkload(members: RMember[], tasks: RTask[]): ReportVM {
  const rows = members.map((m) => {
    const open = tasks.filter((t) => t.assigneeId === m.id && !t.completedAt);
    const hours = open.reduce((s, t) => s + (t.estimatedHours ?? 0), 0);
    const highPlus = open.filter((t) => PRIORITY_RANK[t.priority as Priority] >= PRIORITY_RANK.high).length;
    return {
      member: m.name,
      open: open.length,
      hours,
      highPlus,
    };
  });
  return {
    key: "workload",
    title: "Workload",
    description: "Current open load per member (snapshot).",
    columns: [
      { key: "member", label: "Member" },
      { key: "open", label: "Open tasks", numeric: true },
      { key: "hours", label: "Est. hours", numeric: true },
      { key: "highPlus", label: "High / Critical", numeric: true },
    ],
    rows,
  };
}

export function buildMilestoneCompletion(
  projects: RProject[],
  milestones: RMilestone[],
  range: DateRange,
  today: Date,
): ReportVM {
  const todayIso = today.toISOString().slice(0, 10);
  const scoped = milestones.filter((m) => (!range.from && !range.to ? true : inRange(m.dueDate, range)));
  const rows = projects
    .filter((p) => !p.isArchived)
    .map((p) => {
      const own = scoped.filter((m) => m.projectId === p.id);
      const achieved = own.filter((m) => m.achievedAt);
      const overdue = own.filter((m) => !m.achievedAt && m.dueDate && m.dueDate < todayIso);
      return {
        project: p.name,
        total: own.length,
        achieved: achieved.length,
        overdue: overdue.length,
        completion: pct(achieved.length, own.length),
      };
    })
    .filter((r) => (r.total as number) > 0);
  return {
    key: "milestone-completion",
    title: "Milestone Completion",
    description: "Milestones achieved vs overdue, per project.",
    columns: [
      { key: "project", label: "Project" },
      { key: "total", label: "Total", numeric: true },
      { key: "achieved", label: "Achieved", numeric: true },
      { key: "overdue", label: "Overdue", numeric: true },
      { key: "completion", label: "Completion %", numeric: true },
    ],
    rows,
  };
}
