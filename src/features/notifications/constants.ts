import {
  AlertOctagon,
  AtSign,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  FileUp,
  Repeat,
  Trophy,
  UserPlus,
  type LucideIcon,
} from "lucide-react";

export type NotificationTypeMeta = {
  type: string;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Tailwind classes for the icon chip. */
  tone: string;
};

/** The catalogue drives both rendering and the preferences screen. */
export const NOTIFICATION_TYPES: NotificationTypeMeta[] = [
  {
    type: "task_assigned",
    label: "Task assigned",
    description: "A task is assigned to you.",
    icon: UserPlus,
    tone: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300",
  },
  {
    type: "task_reassigned",
    label: "Task reassigned",
    description: "An existing task changes hands to you.",
    icon: Repeat,
    tone: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300",
  },
  {
    type: "task_mentioned",
    label: "Mentioned",
    description: "Someone @mentions you in a comment.",
    icon: AtSign,
    tone: "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300",
  },
  {
    type: "task_completed",
    label: "Task completed",
    description: "A task you reported is completed.",
    icon: CheckCircle2,
    tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
  },
  {
    type: "task_blocked",
    label: "Task blocked",
    description: "A task in your project becomes blocked.",
    icon: AlertOctagon,
    tone: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300",
  },
  {
    type: "deadline_today",
    label: "Deadline today",
    description: "A task assigned to you is due today.",
    icon: CalendarClock,
    tone: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
  },
  {
    type: "deadline_tomorrow",
    label: "Deadline tomorrow",
    description: "A task assigned to you is due tomorrow.",
    icon: CalendarDays,
    tone: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
  },
  {
    type: "project_completed",
    label: "Project completed",
    description: "A project you own reaches 100%.",
    icon: Trophy,
    tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
  },
  {
    type: "guest_file_shared",
    label: "File shared",
    description: "A file is shared with you (guest).",
    icon: FileUp,
    tone: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
];

const BY_TYPE = new Map(NOTIFICATION_TYPES.map((n) => [n.type, n]));

export function notificationMeta(type: string): NotificationTypeMeta {
  return (
    BY_TYPE.get(type) ?? {
      type,
      label: type.replace(/[._]/g, " "),
      description: "",
      icon: UserPlus,
      tone: "bg-muted text-muted-foreground",
    }
  );
}

/** Build the deep-link for a notification's target entity. */
export function notificationHref(entity: string | null, entityId: string | null): string | null {
  if (!entityId) return null;
  if (entity === "project") return `/projects/${entityId}`;
  // The notification only carries the task id; this resolver looks up the
  // task's project (RLS-scoped) and redirects to the drawer.
  if (entity === "task") return `/go/task/${entityId}`;
  return null;
}
