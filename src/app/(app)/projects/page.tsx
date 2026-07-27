import type { Metadata } from "next";
import { can, requireOrgContext } from "@/lib/auth";
import { PERMISSIONS } from "@/constants";
import { listProjects } from "@/repositories/project.repository";
import { listWorkspaces } from "@/repositories/workspace.repository";
import { listAccountOptions } from "@/repositories/account.repository";
import { listOrgMemberProfiles } from "@/repositories/member.repository";
import { getHealthTolerance } from "@/repositories/organization.repository";
import { toProjectCardVM } from "@/features/projects/vm";
import { ProjectsView } from "@/features/projects/components/projects-view";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const ctx = await requireOrgContext();
  const orgId = ctx.organization.id;

  const [rows, tolerance, workspaces, accounts, members] = await Promise.all([
    listProjects(orgId),
    getHealthTolerance(orgId),
    listWorkspaces(orgId),
    listAccountOptions(orgId),
    listOrgMemberProfiles(orgId),
  ]);

  const projects = rows.map((r) => toProjectCardVM(r, tolerance));
  const defaultWorkspaceId =
    workspaces.find((w) => w.is_default)?.id ?? workspaces[0]?.id ?? "";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="Every project, its health, and who's responsible."
      />
      <ProjectsView
        projects={projects}
        workspaces={workspaces.map((w) => ({ id: w.id, name: w.name }))}
        accounts={accounts}
        members={members.map((m) => ({
          id: m.id,
          full_name: m.full_name,
          email: m.email,
        }))}
        defaultWorkspaceId={defaultWorkspaceId}
        canCreate={can(ctx, PERMISSIONS.PROJECT_CREATE)}
      />
    </div>
  );
}
