import "server-only";
import { requireOrgContext } from "@/lib/auth";
import { PERMISSIONS, type StatusCategory } from "@/constants";
import { checkPermission } from "@/repositories/permission.repository";
import { getTask } from "@/repositories/task.repository";
import { listChecklist } from "@/repositories/checklist.repository";
import { getWorkflowStatuses } from "@/repositories/workflow.repository";
import { listOrgMemberProfiles } from "@/repositories/member.repository";
import { listComments } from "@/repositories/comment.repository";
import { listAttachments } from "@/repositories/attachment.repository";
import { listTaskActivities } from "@/repositories/activity.repository";
import type { TaskDetailVM, TaskDrawerData } from "./components/task-drawer";

/**
 * Loads everything the task drawer needs and returns a serializable bundle.
 * Shared by the server loader (Tasks tab, deep links) and the read action the
 * board uses to open the drawer in place. Returns null when the id doesn't
 * resolve to a task in this project (RLS-safe).
 */
export async function buildTaskDrawerData(
  projectId: string,
  taskId: string,
): Promise<TaskDrawerData | null> {
  const ctx = await requireOrgContext();
  const orgId = ctx.organization.id;

  const task = await getTask(taskId);
  if (!task || task.project_id !== projectId) return null;

  const [
    checklist,
    statuses,
    comments,
    attachments,
    activities,
    members,
    canAny,
    canOwn,
    canDelete,
    canComment,
    canModerate,
    canUpload,
    canManageFiles,
  ] = await Promise.all([
    listChecklist(task.id),
    task.workflow_id ? getWorkflowStatuses(task.workflow_id) : Promise.resolve([]),
    listComments("task", task.id),
    listAttachments("task", task.id),
    listTaskActivities(task.id),
    listOrgMemberProfiles(orgId),
    checkPermission(orgId, PERMISSIONS.TASK_UPDATE_ANY, { projectId }),
    checkPermission(orgId, PERMISSIONS.TASK_UPDATE_OWN, { projectId }),
    checkPermission(orgId, PERMISSIONS.TASK_DELETE, { projectId }),
    checkPermission(orgId, PERMISSIONS.COMMENT_CREATE, { projectId }),
    checkPermission(orgId, PERMISSIONS.COMMENT_MODERATE, { projectId }),
    checkPermission(orgId, PERMISSIONS.ATTACHMENT_UPLOAD, { projectId }),
    checkPermission(orgId, PERMISSIONS.ATTACHMENT_MANAGE, { projectId }),
  ]);

  const isAssignee = task.assignee_id === ctx.profile.id;
  const canQuickEdit = canAny || (isAssignee && canOwn);

  const vm: TaskDetailVM = {
    id: task.id,
    number: task.number,
    title: task.title,
    description: task.description,
    statusId: task.status_id,
    priority: task.priority,
    assigneeId: task.assignee_id,
    assigneeName: task.assignee?.full_name ?? null,
    assigneeAvatar: task.assignee?.avatar_url ?? null,
    reporterName: task.reporter?.full_name ?? null,
    startDate: task.start_date,
    dueDate: task.due_date,
    estimatedHours: task.estimated_hours,
    actualHours: task.actual_hours,
    progress: task.progress,
    isBlocked: task.is_blocked,
    blockedReason: task.blocked_reason,
    githubPrUrl: task.github_pr_url,
    figmaUrl: task.figma_url,
    stagingUrl: task.staging_url,
    productionUrl: task.production_url,
    evidenceNotes: task.evidence_notes,
    statusCategory: (task.status?.category ?? "todo") as StatusCategory,
  };

  return {
    projectId,
    task: vm,
    statuses: statuses.map((s) => ({ id: s.id, name: s.name, color: s.color, category: s.category })),
    checklist: checklist.map((c) => ({ id: c.id, content: c.content, isDone: c.is_done })),
    members: members.map((m) => ({ id: m.id, name: m.full_name ?? m.email ?? "Member" })),
    canEditAll: canAny,
    canQuickEdit,
    canDelete,
    attachments: attachments.map((a) => ({
      id: a.id,
      fileName: a.file_name,
      fileSize: a.file_size,
      uploaderId: a.uploaded_by,
      uploaderName: a.uploader?.full_name ?? null,
      isGuestVisible: a.is_guest_visible,
      createdAt: a.created_at,
    })),
    comments: comments.map((c) => ({
      id: c.id,
      body: c.body,
      authorId: c.author_id,
      authorName: c.author?.full_name ?? null,
      authorAvatar: c.author?.avatar_url ?? null,
      isEdited: c.is_edited,
      createdAt: c.created_at,
    })),
    activities: activities.map((a) => ({
      id: a.id,
      action: a.action,
      metadata: (a.metadata as Record<string, unknown>) ?? {},
      actorName: a.actor?.full_name ?? null,
      actorAvatar: a.actor?.avatar_url ?? null,
      createdAt: a.created_at,
    })),
    currentUserId: ctx.profile.id,
    canComment,
    canModerate,
    canUpload,
    canManageFiles,
  };
}
