import "server-only";
import { prisma } from "@/lib/prisma";
import { getUser } from "@/lib/auth";
import type { PermissionKey } from "@/constants";

/**
 * Scope-aware permission check.
 * Checks organization membership, project membership, and workspace membership roles.
 */
export async function checkPermission(
  orgId: string,
  permission: PermissionKey,
  scope?: { workspaceId?: string; projectId?: string },
): Promise<boolean> {
  const user = await getUser();
  if (!user) return false;

  // 1. Check org membership
  const orgMember = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: orgId,
        userId: user.id,
      },
    },
    include: {
      role: {
        include: {
          rolePermissions: {
            include: { permission: true },
          },
        },
      },
    },
  });

  if (!orgMember || orgMember.status !== "active" || orgMember.deletedAt) {
    return false;
  }

  // Owner has all permissions
  if (orgMember.role?.key === "org_owner") return true;

  // Check org role permissions
  const orgPerms = new Set(
    orgMember.role?.rolePermissions.map((rp) => rp.permission.key) ?? [],
  );
  if (orgPerms.has(permission)) return true;

  // 2. Check project role if scope.projectId is provided
  if (scope?.projectId) {
    const projMember = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId: scope.projectId,
          userId: user.id,
        },
      },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: { permission: true },
            },
          },
        },
      },
    });

    if (projMember && !projMember.deletedAt) {
      const projPerms = new Set(
        projMember.role.rolePermissions.map((rp) => rp.permission.key),
      );
      if (projPerms.has(permission)) return true;
    }
  }

  // 3. Check workspace role if scope.workspaceId is provided
  if (scope?.workspaceId) {
    const wsMember = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: scope.workspaceId,
          userId: user.id,
        },
      },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: { permission: true },
            },
          },
        },
      },
    });

    if (wsMember && !wsMember.deletedAt) {
      const wsPerms = new Set(
        wsMember.role.rolePermissions.map((rp) => rp.permission.key),
      );
      if (wsPerms.has(permission)) return true;
    }
  }

  return false;
}
