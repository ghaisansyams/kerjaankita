import type { DbEnums } from "@/types/database.types";

/**
 * Domain constants.
 *
 * NOTE: task statuses are NO LONGER a hard-coded enum — every tenant defines
 * its own via `workflow_statuses`. What stays fixed is `status_category`, the
 * stable semantic bucket every tenant status maps to. Render a status using its
 * own `name`/`color`; use its `category` for logic (done? blocked? in progress?).
 */

/* -------------------------------------------------------------------------- */
/*  Permission keys — mirrors the `permissions` table (0010_seed.sql)          */
/* -------------------------------------------------------------------------- */

export const PERMISSIONS = {
  ORG_UPDATE: "organization.update",
  ORG_DELETE: "organization.delete",
  ORG_SETTINGS_UPDATE: "organization.settings.update",
  ORG_MEMBER_MANAGE: "organization.member.manage",
  ORG_ROLE_MANAGE: "organization.role.manage",
  INVITATION_MANAGE: "invitation.manage",

  WORKSPACE_CREATE: "workspace.create",
  WORKSPACE_UPDATE: "workspace.update",
  WORKSPACE_DELETE: "workspace.delete",
  WORKSPACE_MEMBER_MANAGE: "workspace.member.manage",

  TEAM_MANAGE: "team.manage",
  ACCOUNT_MANAGE: "account.manage",

  PROJECT_CREATE: "project.create",
  PROJECT_UPDATE: "project.update",
  PROJECT_DELETE: "project.delete",
  PROJECT_MEMBER_MANAGE: "project.member.manage",
  PROJECT_VIEW_ALL: "project.view.all",

  TASK_CREATE: "task.create",
  TASK_UPDATE_ANY: "task.update.any",
  TASK_UPDATE_OWN: "task.update.own",
  TASK_DELETE: "task.delete",
  TASK_ASSIGN: "task.assign",

  COMMENT_CREATE: "comment.create",
  COMMENT_MODERATE: "comment.moderate",
  ATTACHMENT_UPLOAD: "attachment.upload",
  ATTACHMENT_MANAGE: "attachment.manage",
  ATTACHMENT_SHARE_GUEST: "attachment.share_guest",

  WORKFLOW_MANAGE: "workflow.manage",
  MOM_CREATE: "mom.create",
  MOM_UPDATE: "mom.update",
  MOM_DELETE: "mom.delete",
  MOM_EXPORT: "mom.export",
  CUSTOMFIELD_MANAGE: "customfield.manage",
  TEMPLATE_MANAGE: "template.manage",
  AUTOMATION_MANAGE: "automation.manage",
  TAG_MANAGE: "tag.manage",

  REPORT_VIEW: "report.view",
  REPORT_EXPORT: "report.export",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/* -------------------------------------------------------------------------- */
/*  Status categories (stable across every tenant workflow)                   */
/* -------------------------------------------------------------------------- */

export type StatusCategory = DbEnums<"status_category">;

export const STATUS_CATEGORY_LABELS: Record<StatusCategory, string> = {
  backlog: "Backlog",
  todo: "To Do",
  in_progress: "In Progress",
  review: "Review",
  done: "Done",
  blocked: "Blocked",
  cancelled: "Cancelled",
};

/** Fallback chip styling when a tenant status has no custom colour. */
export const STATUS_CATEGORY_BADGE: Record<StatusCategory, string> = {
  backlog: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  todo: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  in_progress: "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300",
  review: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300",
  done: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
  blocked: "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300",
  cancelled: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
};

export const STATUS_CATEGORY_DOT: Record<StatusCategory, string> = {
  backlog: "bg-slate-400",
  todo: "bg-slate-400",
  in_progress: "bg-blue-500",
  review: "bg-indigo-500",
  done: "bg-emerald-500",
  blocked: "bg-rose-500",
  cancelled: "bg-slate-400",
};

/** Categories that count a task as finished. */
export const CLOSED_CATEGORIES: StatusCategory[] = ["done", "cancelled"];

/* -------------------------------------------------------------------------- */
/*  Priority                                                                  */
/* -------------------------------------------------------------------------- */

export type Priority = DbEnums<"priority_level">;

export const PRIORITIES: Priority[] = ["none", "low", "medium", "high", "critical"];

export const PRIORITY_LABELS: Record<Priority, string> = {
  none: "None",
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export const PRIORITY_RANK: Record<Priority, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export const PRIORITY_BADGE: Record<Priority, string> = {
  none: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
  low: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  medium: "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300",
  high: "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
  critical: "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300",
};

export const PRIORITY_DOT: Record<Priority, string> = {
  none: "bg-slate-300",
  low: "bg-slate-400",
  medium: "bg-blue-500",
  high: "bg-amber-500",
  critical: "bg-rose-500",
};

/* -------------------------------------------------------------------------- */
/*  Project health / visibility / membership                                  */
/* -------------------------------------------------------------------------- */

export type ProjectHealth = DbEnums<"project_health">;

export const PROJECT_HEALTH_LABELS: Record<ProjectHealth, string> = {
  on_track: "On Track",
  at_risk: "At Risk",
  delayed: "Delayed",
};

export const PROJECT_HEALTH_BADGE: Record<ProjectHealth, string> = {
  on_track:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
  at_risk: "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
  delayed: "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300",
};

export const PROJECT_HEALTH_DOT: Record<ProjectHealth, string> = {
  on_track: "bg-emerald-500",
  at_risk: "bg-amber-500",
  delayed: "bg-rose-500",
};

export type ProjectVisibility = DbEnums<"project_visibility">;

export const PROJECT_VISIBILITY_LABELS: Record<ProjectVisibility, string> = {
  organization: "Everyone in the organization",
  workspace: "Workspace members",
  private: "Project members only",
};

export type MemberType = DbEnums<"member_type">;

export const MEMBER_TYPE_LABELS: Record<MemberType, string> = {
  member: "Member",
  guest: "Guest",
};

export type MembershipStatus = DbEnums<"membership_status">;

export const MEMBERSHIP_STATUS_LABELS: Record<MembershipStatus, string> = {
  invited: "Invited",
  active: "Active",
  suspended: "Suspended",
};

/* -------------------------------------------------------------------------- */
/*  Misc                                                                      */
/* -------------------------------------------------------------------------- */

/** Curated accent palette for projects and workspaces. */
export const PROJECT_COLORS = [
  "#4F46E5", "#2563EB", "#0EA5E9", "#0891B2", "#7C3AED",
  "#DB2777", "#059669", "#D97706", "#DC2626", "#475569",
] as const;

/**
 * Ready-made project keys for the delivery lines we run most often. Offered as
 * a picker next to the Key field — the field stays free-text, so anything else
 * that satisfies the 2–6 uppercase rule is still accepted.
 */
export const PROJECT_KEY_PRESETS = [
  { key: "WEB", label: "Web" },
  { key: "MOBILE", label: "Mobile" },
  { key: "IOT", label: "IoT" },
] as const;

/** Progress steps offered in the UI (0, 10, 20 … 100). */
export const PROGRESS_STEPS = Array.from({ length: 11 }, (_, i) => i * 10);

/** Cookie holding the user's active organization. */
export const ACTIVE_ORG_COOKIE = "flowdesk_org";
