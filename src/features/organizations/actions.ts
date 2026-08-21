"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getUser } from "@/lib/auth";
import { ACTIVE_ORG_COOKIE } from "@/constants";
import { slugify } from "@/utils/format";
import { createOrganizationSchema } from "./schema";
import { StatusCategory } from "@prisma/client";

export type OrgActionState = { error?: string } | undefined;

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
};

/** Switch the active organization (validated against real membership). */
export async function setActiveOrganization(organizationId: string) {
  const user = await getUser();
  if (!user) redirect("/login");

  const membership = await prisma.organizationMember.findFirst({
    where: {
      organizationId,
      userId: user.id,
      status: "active",
      deletedAt: null,
    },
    select: { organizationId: true },
  });

  if (!membership) redirect("/dashboard");

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORG_COOKIE, organizationId, COOKIE_OPTIONS);

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

/**
 * Create the caller's organization and make it active.
 * Atomically bootstraps settings, default workspace, workflow, statuses, and owner membership.
 */
export async function createOrganization(
  _prev: OrgActionState,
  formData: FormData,
): Promise<OrgActionState> {
  const parsed = createOrganizationSchema.safeParse({
    name: formData.get("name"),
    industryKey: formData.get("industryKey"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  }

  const user = await getUser();
  if (!user) redirect("/login");

  let orgId = "";
  try {
    const baseSlug = slugify(parsed.data.name) || "workspace";
    let slug = baseSlug;
    let counter = 1;
    while (await prisma.organization.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter++}`;
    }

    const industry = await prisma.industry.findUnique({
      where: { key: parsed.data.industryKey },
      select: { id: true },
    });

    const ownerRole = await prisma.role.findFirst({
      where: { key: "org_owner", organizationId: null },
      select: { id: true },
    });
    const wsAdminRole = await prisma.role.findFirst({
      where: { key: "ws_admin", organizationId: null },
      select: { id: true },
    });

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Organization
      const org = await tx.organization.create({
        data: {
          name: parsed.data.name,
          slug,
          industryId: industry?.id,
          createdBy: user.id,
        },
      });

      // 2. Create Organization Settings
      await tx.organizationSetting.create({
        data: {
          organizationId: org.id,
          createdBy: user.id,
        },
      });

      // 3. Create Default Workspace
      const ws = await tx.workspace.create({
        data: {
          organizationId: org.id,
          name: "General",
          slug: "general",
          isDefault: true,
          createdBy: user.id,
        },
      });

      // 4. Create Owner Organization Member
      if (ownerRole) {
        await tx.organizationMember.create({
          data: {
            organizationId: org.id,
            userId: user.id,
            roleId: ownerRole.id,
            memberType: "member",
            status: "active",
            joinedAt: new Date(),
            createdBy: user.id,
          },
        });
      }

      // 5. Create Workspace Member
      if (wsAdminRole) {
        await tx.workspaceMember.create({
          data: {
            organizationId: org.id,
            workspaceId: ws.id,
            userId: user.id,
            roleId: wsAdminRole.id,
            createdBy: user.id,
          },
        });
      }

      // 6. Create Default Task Workflow & Statuses
      const wf = await tx.workflow.create({
        data: {
          organizationId: org.id,
          workspaceId: ws.id,
          name: "Default Workflow",
          entity: "task",
          isDefault: true,
          isSystem: true,
          createdBy: user.id,
        },
      });

      // Statuses
      const defaultStatuses = [
        { key: "backlog", name: "Backlog", category: StatusCategory.backlog, color: "#94A3B8", position: 0, isInitial: true, isFinal: false, autoProgress: 0 },
        { key: "todo", name: "To Do", category: StatusCategory.todo, color: "#64748B", position: 1, isInitial: false, isFinal: false, autoProgress: 0 },
        { key: "in_progress", name: "In Progress", category: StatusCategory.in_progress, color: "#3B82F6", position: 2, isInitial: false, isFinal: false, autoProgress: 50 },
        { key: "review", name: "In Review", category: StatusCategory.review, color: "#F59E0B", position: 3, isInitial: false, isFinal: false, autoProgress: 80 },
        { key: "done", name: "Done", category: StatusCategory.done, color: "#10B981", position: 4, isInitial: false, isFinal: true, autoProgress: 100 },
      ];

      for (const st of defaultStatuses) {
        await tx.workflowStatus.create({
          data: {
            organizationId: org.id,
            workflowId: wf.id,
            key: st.key,
            name: st.name,
            category: st.category,
            color: st.color,
            position: st.position,
            isInitial: st.isInitial,
            isFinal: st.isFinal,
            autoProgress: st.autoProgress,
            createdBy: user.id,
          },
        });
      }

      return org.id;
    });

    orgId = result;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to create organization.";
    return { error: msg };
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORG_COOKIE, orgId, COOKIE_OPTIONS);

  revalidatePath("/", "layout");
  redirect("/dashboard");
}
