import "server-only";
import { prisma } from "@/lib/prisma";
import type { PriorityLevel, ProjectVisibility, Prisma } from "@prisma/client";

export type ProjectListFilters = {
  search?: string;
  workspaceId?: string;
  includeArchived?: boolean;
};

export async function listProjects(orgId: string, filters: ProjectListFilters = {}) {
  const where: Prisma.ProjectWhereInput = {
    organizationId: orgId,
    deletedAt: null,
  };

  if (!filters.includeArchived) where.isArchived = false;
  if (filters.workspaceId) where.workspaceId = filters.workspaceId;
  if (filters.search) where.name = { contains: filters.search, mode: "insensitive" };

  const data = await prisma.project.findMany({
    where,
    select: {
      id: true,
      name: true,
      key: true,
      description: true,
      color: true,
      statusId: true,
      workspaceId: true,
      accountId: true,
      ownerId: true,
      visibility: true,
      startDate: true,
      endDate: true,
      progress: true,
      isArchived: true,
      createdAt: true,
      updatedAt: true,
      account: {
        select: { id: true, name: true },
      },
      owner: {
        select: { id: true, fullName: true, avatarUrl: true },
      },
      status: {
        select: { id: true, name: true, color: true, category: true },
      },
      workspace: {
        select: { id: true, name: true, color: true },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return data.map((d) => ({
    id: d.id,
    name: d.name,
    key: d.key,
    description: d.description,
    color: d.color,
    status_id: d.statusId,
    workspace_id: d.workspaceId,
    account_id: d.accountId,
    owner_id: d.ownerId,
    visibility: d.visibility,
    start_date: d.startDate ? d.startDate.toISOString().split("T")[0] : null,
    end_date: d.endDate ? d.endDate.toISOString().split("T")[0] : null,
    progress: d.progress,
    is_archived: d.isArchived,
    created_at: d.createdAt.toISOString(),
    updated_at: d.updatedAt.toISOString(),
    account: d.account,
    owner: d.owner ? { id: d.owner.id, full_name: d.owner.fullName, avatar_url: d.owner.avatarUrl } : null,
    status: d.status,
    workspace: d.workspace,
  }));
}

export async function getProject(id: string) {
  const d = await prisma.project.findFirst({
    where: {
      id,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      key: true,
      description: true,
      color: true,
      statusId: true,
      workspaceId: true,
      accountId: true,
      ownerId: true,
      visibility: true,
      startDate: true,
      endDate: true,
      progress: true,
      isArchived: true,
      createdAt: true,
      updatedAt: true,
      createdBy: true,
      account: {
        select: { id: true, name: true },
      },
      owner: {
        select: { id: true, fullName: true, avatarUrl: true },
      },
      status: {
        select: { id: true, name: true, color: true, category: true },
      },
      workspace: {
        select: { id: true, name: true, color: true },
      },
    },
  });

  if (!d) return null;

  let creator = null;
  if (d.createdBy) {
    const c = await prisma.profile.findUnique({
      where: { id: d.createdBy },
      select: { id: true, fullName: true, avatarUrl: true },
    });
    if (c) creator = { id: c.id, full_name: c.fullName, avatar_url: c.avatarUrl };
  }

  return {
    id: d.id,
    name: d.name,
    key: d.key,
    description: d.description,
    color: d.color,
    status_id: d.statusId,
    workspace_id: d.workspaceId,
    account_id: d.accountId,
    owner_id: d.ownerId,
    visibility: d.visibility,
    start_date: d.startDate ? d.startDate.toISOString().split("T")[0] : null,
    end_date: d.endDate ? d.endDate.toISOString().split("T")[0] : null,
    progress: d.progress,
    is_archived: d.isArchived,
    created_at: d.createdAt.toISOString(),
    updated_at: d.updatedAt.toISOString(),
    created_by: d.createdBy,
    account: d.account,
    owner: d.owner ? { id: d.owner.id, full_name: d.owner.fullName, avatar_url: d.owner.avatarUrl } : null,
    status: d.status,
    workspace: d.workspace,
    creator,
  };
}

export type ProjectDetail = NonNullable<Awaited<ReturnType<typeof getProject>>>;
export type ProjectListItem = Awaited<ReturnType<typeof listProjects>>[number];

export interface InsertProjectInput {
  id: string;
  organization_id?: string;
  organizationId?: string;
  workspace_id?: string;
  workspaceId?: string;
  account_id?: string | null;
  accountId?: string | null;
  template_id?: string | null;
  templateId?: string | null;
  workflow_id?: string | null;
  workflowId?: string | null;
  status_id?: string | null;
  statusId?: string | null;
  parent_id?: string | null;
  parentId?: string | null;
  key?: string | null;
  name: string;
  description?: string | null;
  owner_id?: string | null;
  ownerId?: string | null;
  team_id?: string | null;
  teamId?: string | null;
  visibility?: ProjectVisibility | "workspace" | "organization" | "private";
  priority?: PriorityLevel | "none" | "low" | "medium" | "high" | "critical";
  color?: string;
  start_date?: string | null;
  startDate?: string | null;
  end_date?: string | null;
  endDate?: string | null;
  budget_amount?: number | null;
  budgetAmount?: number | null;
  budget_currency?: string;
  budgetCurrency?: string;
  created_by?: string | null;
  createdBy?: string | null;
  [key: string]: unknown;
}

export async function insertProject(values: InsertProjectInput) {
  await prisma.project.create({
    data: {
      id: values.id,
      organizationId: values.organizationId || values.organization_id!,
      workspaceId: values.workspaceId || values.workspace_id!,
      accountId: values.accountId !== undefined ? values.accountId : values.account_id,
      templateId: values.templateId !== undefined ? values.templateId : values.template_id,
      workflowId: values.workflowId !== undefined ? values.workflowId : values.workflow_id,
      statusId: values.statusId !== undefined ? values.statusId : values.status_id,
      parentId: values.parentId !== undefined ? values.parentId : values.parent_id,
      key: values.key,
      name: values.name,
      description: values.description,
      ownerId: values.ownerId !== undefined ? values.ownerId : values.owner_id,
      teamId: values.teamId !== undefined ? values.teamId : values.team_id,
      visibility: (values.visibility || "workspace") as ProjectVisibility,
      priority: (values.priority || "medium") as PriorityLevel,
      color: values.color || "#4F46E5",
      startDate: values.startDate ? new Date(values.startDate) : values.start_date ? new Date(values.start_date) : undefined,
      endDate: values.endDate ? new Date(values.endDate) : values.end_date ? new Date(values.end_date) : undefined,
      budgetAmount: values.budgetAmount !== undefined ? values.budgetAmount : values.budget_amount,
      budgetCurrency: values.budgetCurrency || values.budget_currency || "USD",
      createdBy: values.createdBy || values.created_by,
    },
  });
}

export interface UpdateProjectInput {
  name?: string;
  description?: string | null;
  color?: string;
  key?: string | null;
  status_id?: string | null;
  statusId?: string | null;
  workspace_id?: string;
  workspaceId?: string;
  account_id?: string | null;
  accountId?: string | null;
  owner_id?: string | null;
  ownerId?: string | null;
  visibility?: ProjectVisibility | "workspace" | "organization" | "private";
  priority?: PriorityLevel | "none" | "low" | "medium" | "high" | "critical";
  start_date?: string | null;
  startDate?: string | null;
  end_date?: string | null;
  endDate?: string | null;
  budget_amount?: number | null;
  budgetAmount?: number | null;
  progress?: number;
  is_archived?: boolean;
  isArchived?: boolean;
  updated_by?: string | null;
  updatedBy?: string | null;
  [key: string]: unknown;
}

export async function updateProject(
  id: string,
  patch: UpdateProjectInput,
) {
  const data = await prisma.project.update({
    where: { id },
    data: {
      name: patch.name,
      description: patch.description,
      color: patch.color,
      statusId: patch.statusId !== undefined ? patch.statusId : patch.status_id,
      workspaceId: patch.workspaceId || patch.workspace_id,
      accountId: patch.accountId !== undefined ? patch.accountId : patch.account_id,
      ownerId: patch.ownerId !== undefined ? patch.ownerId : patch.owner_id,
      visibility: patch.visibility as ProjectVisibility,
      priority: patch.priority as PriorityLevel,
      startDate: patch.startDate ? new Date(patch.startDate) : patch.start_date ? new Date(patch.start_date) : undefined,
      endDate: patch.endDate ? new Date(patch.endDate) : patch.end_date ? new Date(patch.end_date) : undefined,
      progress: patch.progress,
      isArchived: patch.isArchived ?? patch.is_archived,
      updatedBy: patch.updatedBy || patch.updated_by,
    },
    select: { id: true },
  });
  return data;
}

export async function setProjectArchived(id: string, archived: boolean) {
  return updateProject(id, { is_archived: archived });
}

export async function softDeleteProject(id: string) {
  const now = new Date();
  await prisma.$transaction([
    prisma.project.update({ where: { id }, data: { deletedAt: now } }),
    prisma.task.updateMany({ where: { projectId: id }, data: { deletedAt: now } }),
    prisma.milestone.updateMany({ where: { projectId: id }, data: { deletedAt: now } }),
    prisma.comment.updateMany({ where: { projectId: id }, data: { deletedAt: now } }),
    prisma.attachment.updateMany({ where: { projectId: id }, data: { deletedAt: now } }),
    prisma.mom.updateMany({ where: { projectId: id }, data: { deletedAt: now } }),
    prisma.roadmap.updateMany({ where: { projectId: id }, data: { deletedAt: now } }),
    prisma.module.updateMany({ where: { projectId: id }, data: { deletedAt: now } }),
  ]);
}
