import "server-only";
import { prisma } from "@/lib/prisma";
import {
  assembleBoard,
  type BoardTask,
  type RawBoardTask,
} from "@/features/tasks/board-shared";
import type { PriorityLevel } from "@prisma/client";

/** Enriched board data (tasks + checklist/attachment/comment counts). */
export async function getBoardData(projectId: string): Promise<BoardTask[]> {
  const taskData = await prisma.task.findMany({
    where: {
      projectId,
      deletedAt: null,
    },
    select: {
      id: true,
      number: true,
      title: true,
      statusId: true,
      priority: true,
      assigneeId: true,
      dueDate: true,
      progress: true,
      isBlocked: true,
      position: true,
      estimatedHours: true,
      roadmapId: true,
      moduleId: true,
      assignee: {
        select: {
          fullName: true,
          avatarUrl: true,
        },
      },
    },
    orderBy: [
      { position: "asc" },
      { number: "asc" },
    ],
  });

  const ids = taskData.map((t) => t.id);

  const [checklist, attachments, comments] = await Promise.all([
    ids.length
      ? prisma.taskChecklistItem.findMany({
          where: { taskId: { in: ids }, deletedAt: null },
          select: { taskId: true, isDone: true },
        })
      : [],
    ids.length
      ? prisma.attachment.findMany({
          where: { entity: "task", projectId, deletedAt: null },
          select: { entityId: true },
        })
      : [],
    ids.length
      ? prisma.comment.findMany({
          where: { entity: "task", projectId, deletedAt: null },
          select: { entityId: true },
        })
      : [],
  ]);

  const rawTasks: RawBoardTask[] = taskData.map((t) => ({
    id: t.id,
    number: t.number,
    title: t.title,
    status_id: t.statusId,
    priority: t.priority,
    assignee_id: t.assigneeId,
    due_date: t.dueDate ? t.dueDate.toISOString().split("T")[0] : null,
    progress: t.progress,
    is_blocked: t.isBlocked,
    position: t.position,
    estimated_hours: t.estimatedHours ? Number(t.estimatedHours) : null,
    roadmap_id: t.roadmapId,
    module_id: t.moduleId,
    access_roles: [],
    assignee: t.assignee
      ? {
          full_name: t.assignee.fullName,
          avatar_url: t.assignee.avatarUrl,
        }
      : null,
  }));

  return assembleBoard(
    rawTasks,
    checklist.map((c) => ({ task_id: c.taskId, is_done: c.isDone })),
    attachments.map((a) => ({ entity_id: a.entityId })),
    comments.map((c) => ({ entity_id: c.entityId })),
  );
}

export async function listTasks(projectId: string) {
  const data = await prisma.task.findMany({
    where: {
      projectId,
      deletedAt: null,
    },
    select: {
      id: true,
      number: true,
      title: true,
      statusId: true,
      priority: true,
      assigneeId: true,
      dueDate: true,
      progress: true,
      isBlocked: true,
      position: true,
      status: {
        select: {
          id: true,
          name: true,
          color: true,
          category: true,
        },
      },
      assignee: {
        select: {
          id: true,
          fullName: true,
          avatarUrl: true,
        },
      },
    },
    orderBy: [
      { position: "asc" },
      { number: "asc" },
    ],
  });

  return data.map((d) => ({
    id: d.id,
    number: d.number,
    title: d.title,
    status_id: d.statusId,
    priority: d.priority,
    assignee_id: d.assigneeId,
    due_date: d.dueDate ? d.dueDate.toISOString().split("T")[0] : null,
    progress: d.progress,
    is_blocked: d.isBlocked,
    position: d.position,
    status: d.status,
    assignee: d.assignee ? {
      id: d.assignee.id,
      full_name: d.assignee.fullName,
      avatar_url: d.assignee.avatarUrl,
    } : null,
  }));
}

export type TaskListItem = Awaited<ReturnType<typeof listTasks>>[number];

export async function getTask(id: string) {
  const d = await prisma.task.findFirst({
    where: {
      id,
      deletedAt: null,
    },
    include: {
      status: {
        select: {
          id: true,
          name: true,
          color: true,
          category: true,
        },
      },
      assignee: {
        select: {
          id: true,
          fullName: true,
          avatarUrl: true,
          email: true,
        },
      },
      reporter: {
        select: {
          id: true,
          fullName: true,
          avatarUrl: true,
        },
      },
    },
  });

  if (!d) return null;

  return {
    ...d,
    organization_id: d.organizationId,
    project_id: d.projectId,
    parent_id: d.parentId,
    milestone_id: d.milestoneId,
    workflow_id: d.workflowId,
    status_id: d.statusId,
    template_id: d.templateId,
    roadmap_id: d.roadmapId,
    module_id: d.moduleId,
    assignee_id: d.assigneeId,
    reporter_id: d.reporterId,
    start_date: d.startDate ? d.startDate.toISOString().split("T")[0] : null,
    due_date: d.dueDate ? d.dueDate.toISOString().split("T")[0] : null,
    completed_at: d.completedAt ? d.completedAt.toISOString() : null,
    estimated_hours: d.estimatedHours ? Number(d.estimatedHours) : null,
    actual_hours: d.actualHours ? Number(d.actualHours) : null,
    is_blocked: d.isBlocked,
    blocked_reason: d.blockedReason,
    blocked_since: d.blockedSince ? d.blockedSince.toISOString() : null,
    github_pr_url: d.githubPrUrl,
    figma_url: d.figmaUrl,
    staging_url: d.stagingUrl,
    production_url: d.productionUrl,
    evidence_notes: d.evidenceNotes,
    created_at: d.createdAt.toISOString(),
    created_by: d.createdBy,
    updated_at: d.updatedAt.toISOString(),
    updated_by: d.updatedBy,
    status: d.status,
    access_roles: [] as string[],
    assignee: d.assignee ? {
      id: d.assignee.id,
      full_name: d.assignee.fullName,
      avatar_url: d.assignee.avatarUrl,
      email: d.assignee.email,
    } : null,
    reporter: d.reporter ? {
      id: d.reporter.id,
      full_name: d.reporter.fullName,
      avatar_url: d.reporter.avatarUrl,
    } : null,
  };
}

export type TaskDetail = NonNullable<Awaited<ReturnType<typeof getTask>>>;

export interface InsertTaskInput {
  id?: string;
  organization_id?: string;
  organizationId?: string;
  project_id?: string;
  projectId?: string;
  parent_id?: string | null;
  parentId?: string | null;
  milestone_id?: string | null;
  milestoneId?: string | null;
  workflow_id?: string | null;
  workflowId?: string | null;
  status_id?: string | null;
  statusId?: string | null;
  template_id?: string | null;
  templateId?: string | null;
  roadmap_id?: string | null;
  roadmapId?: string | null;
  module_id?: string | null;
  moduleId?: string | null;
  number?: number;
  title: string;
  description?: string | null;
  priority?: PriorityLevel | "none" | "low" | "medium" | "high" | "critical";
  assignee_id?: string | null;
  assigneeId?: string | null;
  reporter_id?: string | null;
  reporterId?: string | null;
  start_date?: string | null;
  startDate?: string | null;
  due_date?: string | null;
  dueDate?: string | null;
  estimated_hours?: number | null;
  estimatedHours?: number | null;
  actual_hours?: number | null;
  actualHours?: number | null;
  progress?: number;
  position?: number;
  is_blocked?: boolean;
  isBlocked?: boolean;
  blocked_reason?: string | null;
  blockedReason?: string | null;
  github_pr_url?: string | null;
  githubPrUrl?: string | null;
  figma_url?: string | null;
  figmaUrl?: string | null;
  staging_url?: string | null;
  stagingUrl?: string | null;
  production_url?: string | null;
  productionUrl?: string | null;
  evidence_notes?: string | null;
  evidenceNotes?: string | null;
  created_by?: string | null;
  createdBy?: string | null;
  [key: string]: unknown;
}

export async function insertTask(values: InsertTaskInput) {
  const projectId = values.projectId || values.project_id!;
  let taskNum = values.number;

  if (taskNum === undefined) {
    // Auto increment project task number
    const proj = await prisma.project.update({
      where: { id: projectId },
      data: { taskSeq: { increment: 1 } },
      select: { taskSeq: true },
    });
    taskNum = proj.taskSeq;
  }

  await prisma.task.create({
    data: {
      id: values.id,
      organizationId: values.organizationId || values.organization_id!,
      projectId,
      parentId: values.parentId !== undefined ? values.parentId : values.parent_id,
      milestoneId: values.milestoneId !== undefined ? values.milestoneId : values.milestone_id,
      workflowId: values.workflowId !== undefined ? values.workflowId : values.workflow_id,
      statusId: values.statusId !== undefined ? values.statusId : values.status_id,
      templateId: values.templateId !== undefined ? values.templateId : values.template_id,
      roadmapId: values.roadmapId !== undefined ? values.roadmapId : values.roadmap_id,
      moduleId: values.moduleId !== undefined ? values.moduleId : values.module_id,
      number: taskNum,
      title: values.title,
      description: values.description,
      priority: (values.priority || "medium") as PriorityLevel,
      assigneeId: values.assigneeId !== undefined ? values.assigneeId : values.assignee_id,
      reporterId: values.reporterId !== undefined ? values.reporterId : values.reporter_id,
      startDate: values.startDate ? new Date(values.startDate) : values.start_date ? new Date(values.start_date) : undefined,
      dueDate: values.dueDate ? new Date(values.dueDate) : values.due_date ? new Date(values.due_date) : undefined,
      estimatedHours: values.estimatedHours !== undefined ? values.estimatedHours : values.estimated_hours,
      actualHours: values.actualHours !== undefined ? values.actualHours : values.actual_hours,
      progress: values.progress ?? 0,
      position: values.position ?? 0,
      isBlocked: values.isBlocked ?? values.is_blocked ?? false,
      blockedReason: values.blockedReason || values.blocked_reason,
      githubPrUrl: values.githubPrUrl || values.github_pr_url,
      figmaUrl: values.figmaUrl || values.figma_url,
      stagingUrl: values.stagingUrl || values.staging_url,
      productionUrl: values.productionUrl || values.production_url,
      evidenceNotes: values.evidenceNotes || values.evidence_notes,
      createdBy: values.createdBy || values.created_by,
    },
  });
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  status_id?: string | null;
  statusId?: string | null;
  priority?: PriorityLevel | "none" | "low" | "medium" | "high" | "critical";
  assignee_id?: string | null;
  assigneeId?: string | null;
  reporter_id?: string | null;
  reporterId?: string | null;
  start_date?: string | null;
  startDate?: string | null;
  due_date?: string | null;
  dueDate?: string | null;
  completed_at?: string | null;
  completedAt?: string | null;
  estimated_hours?: number | null;
  estimatedHours?: number | null;
  actual_hours?: number | null;
  actualHours?: number | null;
  progress?: number;
  position?: number;
  is_blocked?: boolean;
  isBlocked?: boolean;
  blocked_reason?: string | null;
  blockedReason?: string | null;
  blocked_since?: string | null;
  blockedSince?: string | null;
  github_pr_url?: string | null;
  githubPrUrl?: string | null;
  figma_url?: string | null;
  figmaUrl?: string | null;
  staging_url?: string | null;
  stagingUrl?: string | null;
  production_url?: string | null;
  productionUrl?: string | null;
  evidence_notes?: string | null;
  evidenceNotes?: string | null;
  updated_by?: string | null;
  updatedBy?: string | null;
  [key: string]: unknown;
}

export async function updateTask(
  id: string,
  patch: UpdateTaskInput,
) {
  const data = await prisma.task.update({
    where: { id },
    data: {
      title: patch.title,
      description: patch.description,
      statusId: patch.statusId !== undefined ? patch.statusId : patch.status_id,
      priority: patch.priority as PriorityLevel,
      assigneeId: patch.assigneeId !== undefined ? patch.assigneeId : patch.assignee_id,
      reporterId: patch.reporterId !== undefined ? patch.reporterId : patch.reporter_id,
      startDate: patch.startDate ? new Date(patch.startDate) : patch.start_date ? new Date(patch.start_date) : patch.startDate === null || patch.start_date === null ? null : undefined,
      dueDate: patch.dueDate ? new Date(patch.dueDate) : patch.due_date ? new Date(patch.due_date) : patch.dueDate === null || patch.due_date === null ? null : undefined,
      completedAt: patch.completedAt ? new Date(patch.completedAt) : patch.completed_at ? new Date(patch.completed_at) : patch.completedAt === null || patch.completed_at === null ? null : undefined,
      estimatedHours: patch.estimatedHours !== undefined ? patch.estimatedHours : patch.estimated_hours,
      actualHours: patch.actualHours !== undefined ? patch.actualHours : patch.actual_hours,
      progress: patch.progress,
      position: patch.position,
      isBlocked: patch.isBlocked ?? patch.is_blocked,
      blockedReason: patch.blockedReason !== undefined ? patch.blockedReason : patch.blocked_reason,
      blockedSince: patch.blockedSince ? new Date(patch.blockedSince) : patch.blocked_since ? new Date(patch.blocked_since) : patch.blockedSince === null || patch.blocked_since === null ? null : undefined,
      githubPrUrl: patch.githubPrUrl !== undefined ? patch.githubPrUrl : patch.github_pr_url,
      figmaUrl: patch.figmaUrl !== undefined ? patch.figmaUrl : patch.figma_url,
      stagingUrl: patch.stagingUrl !== undefined ? patch.stagingUrl : patch.staging_url,
      productionUrl: patch.productionUrl !== undefined ? patch.productionUrl : patch.production_url,
      evidenceNotes: patch.evidenceNotes !== undefined ? patch.evidenceNotes : patch.evidence_notes,
      updatedBy: patch.updatedBy || patch.updated_by,
    },
    select: {
      id: true,
      projectId: true,
    },
  });
  return {
    id: data.id,
    project_id: data.projectId,
  };
}

export async function softDeleteTask(id: string, deletedBy: string) {
  const data = await prisma.task.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      deletedBy,
    },
    select: {
      id: true,
      projectId: true,
    },
  });
  return {
    id: data.id,
    project_id: data.projectId,
  };
}

/** Lightweight tenancy reference for a task. */
export async function getTaskRef(id: string) {
  const data = await prisma.task.findFirst({
    where: { id, deletedAt: null },
    select: {
      projectId: true,
      organizationId: true,
    },
  });
  if (!data) return null;
  return {
    project_id: data.projectId,
    organization_id: data.organizationId,
  };
}

/** Is this user the assignee of the task? */
export async function isTaskAssignee(id: string, userId: string) {
  const data = await prisma.task.findUnique({
    where: { id },
    select: { assigneeId: true },
  });
  return data?.assigneeId === userId;
}
