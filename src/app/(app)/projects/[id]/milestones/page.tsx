import { notFound } from "next/navigation";
import { requireOrgContext } from "@/lib/auth";
import { PERMISSIONS } from "@/constants";
import { loadProject } from "@/features/projects/loaders";
import { checkPermission } from "@/repositories/permission.repository";
import { listMilestones } from "@/repositories/milestone.repository";
import { MilestonesPanel } from "@/features/milestones/components/milestones-panel";

export default async function ProjectMilestonesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireOrgContext();

  const project = await loadProject(id);
  if (!project) notFound();

  const canManage = await checkPermission(
    ctx.organization.id,
    PERMISSIONS.MILESTONE_MANAGE,
    { projectId: id },
  );

  const rows = await listMilestones(id);
  const milestones = rows.map((m) => ({
    id: m.id,
    name: m.name,
    description: m.description,
    dueDate: m.due_date,
    achieved: m.achieved_at != null,
  }));

  return (
    <MilestonesPanel projectId={id} milestones={milestones} canManage={canManage} />
  );
}
