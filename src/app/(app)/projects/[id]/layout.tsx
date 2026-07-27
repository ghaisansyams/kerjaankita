import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireOrgContext } from "@/lib/auth";
import { PERMISSIONS } from "@/constants";
import { checkPermission } from "@/repositories/permission.repository";
import { loadHealthTolerance, loadProject } from "@/features/projects/loaders";
import { listWorkspaces } from "@/repositories/workspace.repository";
import { listAccountOptions } from "@/repositories/account.repository";
import { listOrgMemberProfiles } from "@/repositories/member.repository";
import { computeHealth, daysRemaining } from "@/services/project.service";
import { HealthBadge } from "@/components/domain/health-badge";
import { ProgressRing } from "@/components/domain/progress-ring";
import { ProjectActions } from "@/features/projects/components/project-actions";
import { ProjectTabs } from "@/features/projects/components/project-tabs";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const project = await loadProject(id);
  return { title: project?.name ?? "Project" };
}

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireOrgContext();

  const project = await loadProject(id);
  if (!project) notFound();

  const tolerance = await loadHealthTolerance(ctx.organization.id);
  const health = computeHealth(
    { progress: project.progress, startDate: project.start_date, endDate: project.end_date },
    tolerance,
  );
  const daysLeft = daysRemaining(project.end_date);

  // Scope-aware so a Project Lead sees the same actions the RLS policies allow.
  const [canEdit, canDelete] = await Promise.all([
    checkPermission(ctx.organization.id, PERMISSIONS.PROJECT_UPDATE, { projectId: id }),
    checkPermission(ctx.organization.id, PERMISSIONS.PROJECT_DELETE, { projectId: id }),
  ]);

  const [workspaces, accounts, members] = canEdit
    ? await Promise.all([
        listWorkspaces(ctx.organization.id),
        listAccountOptions(ctx.organization.id),
        listOrgMemberProfiles(ctx.organization.id),
      ])
    : [[], [], []];

  const editInitial = {
    name: project.name,
    key: project.key ?? "",
    workspaceId: project.workspace_id,
    accountId: project.account_id ?? "none",
    ownerId: project.owner_id ?? "none",
    visibility: project.visibility,
    color: project.color,
    description: project.description ?? "",
    startDate: project.start_date ?? "",
    endDate: project.end_date ?? "",
  };
  const defaultWorkspaceId =
    workspaces.find((w) => w.is_default)?.id ?? workspaces[0]?.id ?? project.workspace_id;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <ProgressRing value={project.progress} size={52} strokeWidth={5} />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
              {project.key && (
                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                  {project.key}
                </span>
              )}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <HealthBadge health={health} />
              {project.account?.name && <span>· {project.account.name}</span>}
              {typeof daysLeft === "number" && (
                <span>
                  ·{" "}
                  {daysLeft >= 0
                    ? `${daysLeft} days left`
                    : `${Math.abs(daysLeft)} days overdue`}
                </span>
              )}
            </div>
          </div>
        </div>

        <ProjectActions
          projectId={project.id}
          projectName={project.name}
          isArchived={project.is_archived}
          canEdit={canEdit}
          canDelete={canDelete}
          editInitial={editInitial}
          workspaces={workspaces.map((w) => ({ id: w.id, name: w.name }))}
          accounts={accounts}
          members={members.map((m) => ({
            id: m.id,
            full_name: m.full_name,
            email: m.email,
          }))}
          defaultWorkspaceId={defaultWorkspaceId}
        />
      </header>

      <ProjectTabs projectId={id} />

      {children}
    </div>
  );
}
