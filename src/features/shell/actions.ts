"use server";

import { prisma } from "@/lib/prisma";
import { requireOrgContext } from "@/lib/auth";

export type SearchResult = {
  projects: { id: string; name: string; key: string | null; color: string | null }[];
  tasks: { id: string; title: string; project_id: string }[];
  members: { user_id: string; profile: { full_name: string | null } | null }[];
  workspaces: { id: string; name: string }[];
};

export async function searchCommandMenu(query: string): Promise<SearchResult> {
  const ctx = await requireOrgContext();
  const term = query.trim();
  if (!term) {
    return { projects: [], tasks: [], members: [], workspaces: [] };
  }

  const [projects, tasks, members, workspaces] = await Promise.all([
    prisma.project.findMany({
      where: {
        organizationId: ctx.organization.id,
        deletedAt: null,
        name: { contains: term, mode: "insensitive" },
      },
      select: {
        id: true,
        name: true,
        key: true,
        color: true,
      },
      take: 6,
    }),
    prisma.task.findMany({
      where: {
        organizationId: ctx.organization.id,
        deletedAt: null,
        title: { contains: term, mode: "insensitive" },
      },
      select: {
        id: true,
        title: true,
        projectId: true,
      },
      take: 6,
    }),
    prisma.organizationMember.findMany({
      where: {
        organizationId: ctx.organization.id,
        status: "active",
        deletedAt: null,
        user: {
          fullName: { contains: term, mode: "insensitive" },
        },
      },
      select: {
        userId: true,
        user: {
          select: {
            fullName: true,
          },
        },
      },
      take: 6,
    }),
    prisma.workspace.findMany({
      where: {
        organizationId: ctx.organization.id,
        deletedAt: null,
        name: { contains: term, mode: "insensitive" },
      },
      select: {
        id: true,
        name: true,
      },
      take: 6,
    }),
  ]);

  return {
    projects,
    tasks: tasks.map((t) => ({ id: t.id, title: t.title, project_id: t.projectId })),
    members: members.map((m) => ({
      user_id: m.userId,
      profile: m.user ? { full_name: m.user.fullName } : null,
    })),
    workspaces,
  };
}
