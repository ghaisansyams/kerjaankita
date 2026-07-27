import { notFound, redirect } from "next/navigation";
import { getTaskRef } from "@/repositories/task.repository";

/**
 * Resolver for task-scoped deep links (notifications carry only the task id).
 * Looks up the task's project (RLS-scoped) and redirects to the drawer.
 */
export default async function GoTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ref = await getTaskRef(id);
  if (!ref) notFound();
  redirect(`/projects/${ref.project_id}/tasks?task=${id}`);
}
