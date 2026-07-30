import { notFound } from "next/navigation";
import { requireOrgContext } from "@/lib/auth";
import { loadProject } from "@/features/projects/loaders";
import { getBoardData } from "@/repositories/task.repository";
import { getProjectWorkflowId, getWorkflowStatuses } from "@/repositories/workflow.repository";
import { getOrgBranding } from "@/repositories/mom.repository";
import type { BoardTask } from "@/features/tasks/board-shared";
import { ReportProgressDocument, type ReportSection } from "@/features/reports/components/report-progress-document";
import { PrintTrigger } from "@/features/mom/components/print-trigger";

export const metadata = { title: "Report Progress — Export" };

export default async function ReportPrintPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const ctx = await requireOrgContext();

  // RLS: loadProject returns null unless the caller may view this project.
  const project = await loadProject(projectId);
  if (!project) notFound();

  const workflowId = await getProjectWorkflowId(projectId, ctx.organization.id);
  const [statuses, tasks, branding] = await Promise.all([
    workflowId ? getWorkflowStatuses(workflowId) : Promise.resolve([]),
    getBoardData(projectId),
    getOrgBranding(ctx.organization.id),
  ]);

  // Group tasks by status.
  const byStatus = new Map<string, BoardTask[]>();
  for (const t of tasks) {
    const key = t.status_id ?? "__none__";
    const bucket = byStatus.get(key) ?? [];
    if (!byStatus.has(key)) byStatus.set(key, bucket);
    bucket.push(t);
  }

  // Order sections by completion %: the final/Done column is 100%, others by
  // their progress weight (auto_progress); ties fall back to board position.
  const ordered = statuses
    .map((s) => ({ s, pct: s.is_final ? 100 : Math.round(s.auto_progress ?? 0) }))
    .sort((a, b) => b.pct - a.pct || a.s.position - b.s.position);

  let n = 0;
  const sections: ReportSection[] = ordered
    .map(({ s, pct }) => {
      const list = (byStatus.get(s.id) ?? []).sort(
        (a, b) => a.position - b.position || a.number - b.number,
      );
      return {
        status: s.name,
        pct,
        tasks: list.map((t) => ({ number: ++n, title: t.title })),
      };
    })
    .filter((sec) => sec.tasks.length > 0);

  const acc = project.account as { name?: string } | { name?: string }[] | null | undefined;
  const clientName = (Array.isArray(acc) ? acc[0]?.name : acc?.name) ?? null;

  return (
    <>
      <PrintTrigger />
      <ReportProgressDocument
        projectName={project.name}
        clientName={clientName}
        orgName={branding.name}
        logoUrl={branding.logoUrl}
        sections={sections}
        dateStr={new Date().toISOString().slice(0, 10)}
      />
    </>
  );
}
