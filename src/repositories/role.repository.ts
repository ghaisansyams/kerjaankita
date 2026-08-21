import "server-only";
import { prisma } from "@/lib/prisma";
import type { RoleScope } from "@prisma/client";

/** Roles available for a given scope: system roles + the tenant's own. */
export async function listRoles(
  orgId: string,
  scope: RoleScope | "organization" | "workspace" | "project",
) {
  const data = await prisma.role.findMany({
    where: {
      scope: scope as RoleScope,
      deletedAt: null,
      OR: [
        { organizationId: null },
        { organizationId: orgId },
      ],
    },
    select: {
      id: true,
      key: true,
      name: true,
      description: true,
      rank: true,
      organizationId: true,
    },
    orderBy: {
      rank: "asc",
    },
  });

  return data.map((d) => ({
    id: d.id,
    key: d.key,
    name: d.name,
    description: d.description,
    rank: d.rank,
    organization_id: d.organizationId,
  }));
}

export type RoleOption = Awaited<ReturnType<typeof listRoles>>[number];
