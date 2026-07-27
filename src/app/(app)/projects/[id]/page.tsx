import { notFound } from "next/navigation";
import { requireOrgContext } from "@/lib/auth";
import { loadProject } from "@/features/projects/loaders";
import { ProjectOverview } from "@/features/projects/components/project-overview";

export default async function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireOrgContext();

  // Cached by loadProject — shares the fetch with the layout, no double query.
  const project = await loadProject(id);
  if (!project) notFound();

  return <ProjectOverview project={project} />;
}
