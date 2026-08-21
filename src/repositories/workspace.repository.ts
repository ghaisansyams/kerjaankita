import "server-only";
import { prisma } from "@/lib/prisma";

export async function listWorkspaces(orgId: string) {
  const data = await prisma.workspace.findMany({
    where: {
      organizationId: orgId,
      isArchived: false,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      color: true,
      isDefault: true,
    },
    orderBy: [
      { isDefault: "desc" },
      { name: "asc" },
    ],
  });

  return data.map((d) => ({
    id: d.id,
    name: d.name,
    color: d.color,
    is_default: d.isDefault,
  }));
}

export type WorkspaceOption = Awaited<ReturnType<typeof listWorkspaces>>[number];

/** Full record for the workspace settings screen. */
export async function getWorkspace(id: string) {
  const data = await prisma.workspace.findFirst({
    where: {
      id,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      description: true,
      color: true,
      icon: true,
      logoUrl: true,
      defaultWorkflowId: true,
      isDefault: true,
    },
  });

  if (!data) return null;

  return {
    id: data.id,
    name: data.name,
    description: data.description,
    color: data.color,
    icon: data.icon,
    logo_url: data.logoUrl,
    default_workflow_id: data.defaultWorkflowId,
    is_default: data.isDefault,
  };
}

export async function updateWorkspace(
  id: string,
  patch: {
    name?: string;
    description?: string | null;
    color?: string;
    icon?: string | null;
    logo_url?: string | null;
    logoUrl?: string | null;
    default_workflow_id?: string | null;
    defaultWorkflowId?: string | null;
    is_default?: boolean;
    isDefault?: boolean;
    is_archived?: boolean;
    isArchived?: boolean;
    updated_by?: string | null;
    updatedBy?: string | null;
    [key: string]: unknown;
  },
) {
  const data = await prisma.workspace.update({
    where: { id },
    data: {
      name: patch.name,
      description: patch.description,
      color: patch.color,
      icon: patch.icon,
      logoUrl: patch.logoUrl !== undefined ? patch.logoUrl : patch.logo_url,
      defaultWorkflowId: patch.defaultWorkflowId !== undefined ? patch.defaultWorkflowId : patch.default_workflow_id,
      isDefault: patch.isDefault ?? patch.is_default,
      updatedBy: patch.updatedBy || patch.updated_by,
    },
    select: { id: true },
  });
  return data;
}
