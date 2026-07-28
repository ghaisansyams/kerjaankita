import { buildTaskDrawerData } from "../task-drawer-data";
import { TaskDrawer } from "./task-drawer";

/**
 * Server component that loads the task drawer's data and renders it with
 * URL-driven close. Used by the Tasks tab and by deep links. Returns null when
 * the id doesn't resolve to a task in this project (RLS-safe).
 */
export async function TaskDrawerLoader({
  projectId,
  taskId,
  returnTo,
}: {
  projectId: string;
  taskId: string;
  /** Route to navigate back to when the drawer closes. */
  returnTo: string;
}) {
  const data = await buildTaskDrawerData(projectId, taskId);
  if (!data) return null;
  return <TaskDrawer {...data} closeHref={returnTo} />;
}
