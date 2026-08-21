import "server-only";
import { prisma } from "@/lib/prisma";
import type { EntityType, PriorityLevel, Prisma } from "@prisma/client";

// ----- roadmaps -----------------------------------------------------------
export interface InsertRoadmapInput {
  id?: string;
  organization_id?: string;
  organizationId?: string;
  project_id?: string;
  projectId?: string;
  name: string;
  description?: string | null;
  color?: string | null;
  position?: number;
  created_by?: string | null;
  createdBy?: string | null;
  updated_by?: string | null;
  updatedBy?: string | null;
  [key: string]: unknown;
}

export async function insertRoadmap(values: InsertRoadmapInput): Promise<string> {
  const row = await prisma.roadmap.create({
    data: {
      id: values.id,
      organizationId: values.organizationId || values.organization_id!,
      projectId: values.projectId || values.project_id!,
      name: values.name,
      description: values.description,
      color: values.color,
      position: values.position ?? 0,
      createdBy: values.createdBy || values.created_by,
    },
    select: { id: true },
  });
  return row.id;
}

export async function listRoadmaps(projectId: string) {
  const data = await prisma.roadmap.findMany({
    where: {
      projectId,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      description: true,
      color: true,
      position: true,
    },
    orderBy: {
      position: "asc",
    },
  });
  return data;
}

// ----- modules ------------------------------------------------------------
export interface InsertModuleInput {
  id?: string;
  organization_id?: string;
  organizationId?: string;
  project_id?: string;
  projectId?: string;
  roadmap_id?: string | null;
  roadmapId?: string | null;
  name: string;
  description?: string | null;
  position?: number;
  created_by?: string | null;
  createdBy?: string | null;
  updated_by?: string | null;
  updatedBy?: string | null;
  [key: string]: unknown;
}

export async function insertModule(values: InsertModuleInput): Promise<string> {
  const row = await prisma.module.create({
    data: {
      id: values.id,
      organizationId: values.organizationId || values.organization_id!,
      projectId: values.projectId || values.project_id!,
      roadmapId: values.roadmapId !== undefined ? values.roadmapId : values.roadmap_id,
      name: values.name,
      description: values.description,
      position: values.position ?? 0,
      createdBy: values.createdBy || values.created_by,
    },
    select: { id: true },
  });
  return row.id;
}

export async function listModules(projectId: string) {
  const data = await prisma.module.findMany({
    where: {
      projectId,
      deletedAt: null,
    },
    select: {
      id: true,
      roadmapId: true,
      name: true,
      description: true,
      position: true,
    },
    orderBy: {
      position: "asc",
    },
  });
  return data.map((d) => ({
    id: d.id,
    roadmap_id: d.roadmapId,
    name: d.name,
    description: d.description,
    position: d.position,
  }));
}

// ----- import_jobs --------------------------------------------------------
export interface InsertImportJobInput {
  id?: string;
  organization_id?: string;
  organizationId?: string;
  project_id?: string | null;
  projectId?: string | null;
  created_by?: string | null;
  createdBy?: string | null;
  file_name?: string | null;
  fileName?: string | null;
  file_path?: string | null;
  filePath?: string | null;
  file_type?: string | null;
  fileType?: string | null;
  document_type?: string | null;
  documentType?: string | null;
  provider?: string | null;
  status?: string;
  error?: string | null;
  result?: Prisma.InputJsonValue;
  confidence?: string | null;
  [key: string]: unknown;
}

export async function insertImportJob(values: InsertImportJobInput): Promise<string> {
  const row = await prisma.importJob.create({
    data: {
      id: values.id,
      organizationId: values.organizationId || values.organization_id!,
      projectId: values.projectId !== undefined ? values.projectId : values.project_id,
      createdBy: values.createdBy || values.created_by,
      fileName: (values.fileName || values.file_name) ?? "document",
      filePath: (values.filePath || values.file_path) ?? "",
      fileType: (values.fileType || values.file_type) ?? "application/octet-stream",
      documentType: (values.documentType || values.document_type) ?? "unknown",
      provider: values.provider,
      status: values.status || "pending",
      error: values.error,
      result: values.result,
      confidence: values.confidence,
    },
    select: { id: true },
  });
  return row.id;
}

export interface UpdateImportJobInput {
  file_name?: string | null;
  fileName?: string | null;
  file_path?: string | null;
  filePath?: string | null;
  file_type?: string | null;
  fileType?: string | null;
  document_type?: string | null;
  documentType?: string | null;
  provider?: string | null;
  status?: string;
  error?: string | null;
  result?: Prisma.InputJsonValue;
  confidence?: string | null;
  project_id?: string | null;
  projectId?: string | null;
  [key: string]: unknown;
}

export async function updateImportJob(id: string, patch: UpdateImportJobInput) {
  const data: Prisma.ImportJobUpdateInput = {};
  const fileName = patch.fileName !== undefined ? patch.fileName : patch.file_name;
  if (fileName) data.fileName = fileName;
  const filePath = patch.filePath !== undefined ? patch.filePath : patch.file_path;
  if (filePath) data.filePath = filePath;
  const fileType = patch.fileType !== undefined ? patch.fileType : patch.file_type;
  if (fileType) data.fileType = fileType;
  const documentType = patch.documentType !== undefined ? patch.documentType : patch.document_type;
  if (documentType) data.documentType = documentType;
  if (patch.provider !== undefined) data.provider = patch.provider;
  if (patch.status !== undefined) data.status = patch.status;
  if (patch.error !== undefined) data.error = patch.error;
  if (patch.result !== undefined) data.result = patch.result as Prisma.InputJsonValue;
  if (patch.confidence !== undefined) data.confidence = patch.confidence;
  const projectId = patch.projectId !== undefined ? patch.projectId : patch.project_id;
  if (projectId) {
    data.project = { connect: { id: projectId } };
  } else if (projectId === null) {
    data.project = { disconnect: true };
  }

  await prisma.importJob.update({
    where: { id },
    data,
  });
}

export async function getImportJobRow(id: string) {
  const data = await prisma.importJob.findUnique({
    where: { id },
  });
  if (!data) return null;
  return {
    id: data.id,
    organization_id: data.organizationId,
    project_id: data.projectId,
    created_by: data.createdBy,
    file_name: data.fileName,
    file_path: data.filePath,
    file_type: data.fileType,
    document_type: data.documentType,
    provider: data.provider,
    status: data.status,
    error: data.error,
    result: data.result,
    confidence: data.confidence,
    created_at: data.createdAt.toISOString(),
    updated_at: data.updatedAt.toISOString(),
  };
}

export interface InsertAttachmentAdminInput {
  id?: string;
  organization_id?: string;
  organizationId?: string;
  project_id?: string | null;
  projectId?: string | null;
  entity?: string;
  entity_id?: string;
  entityId?: string;
  bucket?: string;
  path: string;
  file_name?: string;
  fileName?: string;
  file_type?: string;
  fileType?: string;
  file_size?: number | bigint | null;
  fileSize?: number | bigint | null;
  is_guest_visible?: boolean;
  isGuestVisible?: boolean;
  uploaded_by?: string | null;
  uploadedBy?: string | null;
  [key: string]: unknown;
}

export async function insertAttachmentAdmin(values: InsertAttachmentAdminInput) {
  const size = values.fileSize !== undefined ? values.fileSize : values.file_size;
  await prisma.attachment.create({
    data: {
      id: values.id,
      organizationId: values.organizationId || values.organization_id!,
      projectId: values.projectId !== undefined ? values.projectId : values.project_id,
      entity: (values.entity || "project") as EntityType,
      entityId: values.entityId || values.entity_id!,
      bucket: values.bucket || "attachments",
      path: values.path,
      fileName: values.fileName || values.file_name || "file",
      fileType: values.fileType || values.file_type || "application/octet-stream",
      fileSize: size ? BigInt(size) : null,
      isGuestVisible: values.isGuestVisible ?? values.is_guest_visible ?? false,
      uploadedBy: values.uploadedBy || values.uploaded_by,
    },
  });
}

/** Existing (non-deleted) task titles in a project — for duplicate detection. */
export async function listTaskTitles(projectId: string): Promise<{ id: string; title: string }[]> {
  const data = await prisma.task.findMany({
    where: {
      projectId,
      deletedAt: null,
    },
    select: {
      id: true,
      title: true,
    },
  });
  return data;
}

// ----- project / workflow helpers (for creating a project on commit) ------
export async function getDefaultWorkspaceId(orgId: string): Promise<string | null> {
  const ws = await prisma.workspace.findFirst({
    where: {
      organizationId: orgId,
      isDefault: true,
      deletedAt: null,
    },
    select: { id: true },
  });
  return ws?.id ?? null;
}

export interface InsertProjectRowInput {
  id?: string;
  organization_id?: string;
  organizationId?: string;
  workspace_id?: string;
  workspaceId?: string;
  name: string;
  description?: string | null;
  key?: string | null;
  color?: string | null;
  owner_id?: string | null;
  ownerId?: string | null;
  template_id?: string | null;
  templateId?: string | null;
  workflow_id?: string | null;
  workflowId?: string | null;
  status_id?: string | null;
  statusId?: string | null;
  start_date?: string | null;
  startDate?: string | null;
  end_date?: string | null;
  endDate?: string | null;
  budget_amount?: number | null;
  budgetAmount?: number | null;
  created_by?: string | null;
  createdBy?: string | null;
  updated_by?: string | null;
  updatedBy?: string | null;
  [key: string]: unknown;
}

export async function insertProjectRow(values: InsertProjectRowInput): Promise<void> {
  await prisma.project.create({
    data: {
      id: values.id,
      organizationId: values.organizationId || values.organization_id!,
      workspaceId: values.workspaceId || values.workspace_id!,
      name: values.name,
      description: values.description,
      key: values.key,
      color: values.color || "#4F46E5",
      ownerId: values.ownerId || values.owner_id,
      templateId: values.templateId || values.template_id,
      workflowId: values.workflowId || values.workflow_id,
      statusId: values.statusId || values.status_id,
      startDate: values.startDate ? new Date(values.startDate) : values.start_date ? new Date(values.start_date) : undefined,
      endDate: values.endDate ? new Date(values.endDate) : values.end_date ? new Date(values.end_date) : undefined,
      budgetAmount: values.budgetAmount !== undefined ? values.budgetAmount : values.budget_amount,
      createdBy: values.createdBy || values.created_by,
    },
  });
}

export async function getInitialStatusId(projectId: string): Promise<string | null> {
  const proj = await prisma.project.findUnique({
    where: { id: projectId },
    select: { workflowId: true },
  });
  if (!proj?.workflowId) return null;

  const status = await prisma.workflowStatus.findFirst({
    where: {
      workflowId: proj.workflowId,
      isInitial: true,
      deletedAt: null,
    },
    select: { id: true },
  });
  return status?.id ?? null;
}

export interface InsertTaskRowInput {
  id?: string;
  organization_id?: string;
  organizationId?: string;
  project_id?: string;
  projectId?: string;
  roadmap_id?: string | null;
  roadmapId?: string | null;
  module_id?: string | null;
  moduleId?: string | null;
  title: string;
  description?: string | null;
  priority?: PriorityLevel | "none" | "low" | "medium" | "high" | "critical";
  status_id?: string | null;
  statusId?: string | null;
  assignee_id?: string | null;
  assigneeId?: string | null;
  reporter_id?: string | null;
  reporterId?: string | null;
  due_date?: string | null;
  dueDate?: string | null;
  estimated_hours?: number | null;
  estimatedHours?: number | null;
  number?: number;
  position?: number;
  created_by?: string | null;
  createdBy?: string | null;
  updated_by?: string | null;
  updatedBy?: string | null;
  access_roles?: string[];
  [key: string]: unknown;
}

export async function insertTaskRow(values: InsertTaskRowInput): Promise<string> {
  const task = await prisma.task.create({
    data: {
      id: values.id,
      organizationId: values.organizationId || values.organization_id!,
      projectId: values.projectId || values.project_id!,
      roadmapId: values.roadmapId !== undefined ? values.roadmapId : values.roadmap_id,
      moduleId: values.moduleId !== undefined ? values.moduleId : values.module_id,
      title: values.title,
      description: values.description,
      priority: (values.priority || "medium") as PriorityLevel,
      statusId: values.statusId || values.status_id,
      assigneeId: values.assigneeId || values.assignee_id,
      reporterId: values.reporterId || values.reporter_id,
      dueDate: values.dueDate ? new Date(values.dueDate) : values.due_date ? new Date(values.due_date) : undefined,
      estimatedHours: values.estimatedHours !== undefined ? values.estimatedHours : values.estimated_hours,
      number: values.number ?? 0,
      position: values.position ?? 0,
      createdBy: values.createdBy || values.created_by,
    },
    select: { id: true },
  });
  return task.id;
}

export interface InsertChecklistItemRowInput {
  id?: string;
  organization_id?: string;
  organizationId?: string;
  task_id?: string;
  taskId?: string;
  content: string;
  is_done?: boolean;
  isDone?: boolean;
  position?: number;
  depth?: number;
  created_by?: string | null;
  createdBy?: string | null;
  updated_by?: string | null;
  updatedBy?: string | null;
  [key: string]: unknown;
}

export async function insertChecklistItems(rows: InsertChecklistItemRowInput[]): Promise<void> {
  if (!rows.length) return;
  await prisma.taskChecklistItem.createMany({
    data: rows.map((r) => ({
      id: r.id,
      organizationId: r.organizationId || r.organization_id!,
      taskId: r.taskId || r.task_id!,
      content: r.content,
      isDone: r.isDone ?? r.is_done ?? false,
      position: r.position ?? 0,
      depth: r.depth ?? 0,
      createdBy: r.createdBy || r.created_by,
    })),
  });
}
