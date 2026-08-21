import "server-only";
import { prisma } from "@/lib/prisma";

export async function listProjectMembers(projectId: string) {
  const data = await prisma.projectMember.findMany({
    where: {
      projectId,
      deletedAt: null,
    },
    select: {
      id: true,
      userId: true,
      roleId: true,
      allocationPct: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          fullName: true,
          avatarUrl: true,
          email: true,
        },
      },
      role: {
        select: {
          id: true,
          name: true,
          key: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  return data.map((d) => ({
    id: d.id,
    user_id: d.userId,
    role_id: d.roleId,
    allocation_pct: d.allocationPct,
    created_at: d.createdAt.toISOString(),
    profile: d.user ? {
      id: d.user.id,
      full_name: d.user.fullName,
      avatar_url: d.user.avatarUrl,
      email: d.user.email,
    } : null,
    role: d.role ? {
      id: d.role.id,
      name: d.role.name,
      key: d.role.key,
    } : null,
  }));
}

export type ProjectMemberRow = Awaited<
  ReturnType<typeof listProjectMembers>
>[number];

export async function insertProjectMember(values: {
  id?: string;
  organization_id?: string;
  organizationId?: string;
  project_id?: string;
  projectId?: string;
  user_id?: string;
  userId?: string;
  role_id?: string;
  roleId?: string;
  allocation_pct?: number | null;
  allocationPct?: number | null;
  created_by?: string | null;
  createdBy?: string | null;
}) {
  await prisma.projectMember.create({
    data: {
      id: values.id,
      organizationId: values.organizationId || values.organization_id!,
      projectId: values.projectId || values.project_id!,
      userId: values.userId || values.user_id!,
      roleId: values.roleId || values.role_id!,
      allocationPct: values.allocationPct !== undefined ? values.allocationPct : values.allocation_pct,
      createdBy: values.createdBy || values.created_by,
    },
  });
}

export async function updateProjectMemberRole(memberId: string, roleId: string) {
  const data = await prisma.projectMember.update({
    where: { id: memberId },
    data: { roleId },
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

export async function softDeleteProjectMember(memberId: string, deletedBy: string) {
  const data = await prisma.projectMember.update({
    where: { id: memberId },
    data: {
      deletedAt: new Date(),
      deletedBy,
    },
    select: {
      id: true,
      projectId: true,
      userId: true,
    },
  });
  return {
    id: data.id,
    project_id: data.projectId,
    user_id: data.userId,
  };
}
