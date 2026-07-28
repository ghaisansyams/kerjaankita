import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Postgres error surfaced by an RPC (SQLSTATE + our friendly message). */
export type RpcError = { code: string; message: string } | null;

/**
 * Column mutations live in SECURITY DEFINER SQL functions (migration 0019) that
 * assert `workflow.manage` and enforce the workflow invariants atomically. These
 * are thin, typed wrappers — the only place the app calls them. The generated
 * Database types don't include these functions, so the rpc handle is narrowed
 * locally rather than leaking `any` outward.
 */
async function rpc(fn: string, args: Record<string, unknown>): Promise<RpcError> {
  const supabase = await createClient();
  // Call `.rpc` as a method on the client so its `this` binding is preserved;
  // the generated Database types don't include these functions, so the shape is
  // narrowed locally rather than leaking `any`.
  const client = supabase as unknown as {
    rpc: (f: string, a: Record<string, unknown>) => Promise<{ error: RpcError }>;
  };
  const { error } = await client.rpc(fn, args);
  return error;
}

export const createColumn = (workflowId: string, name: string, color: string, weight: number) =>
  rpc("create_workflow_column", { p_workflow: workflowId, p_name: name, p_color: color, p_weight: weight });

export const updateColumn = (
  statusId: string,
  name: string | null,
  color: string | null,
  weight: number | null,
) => rpc("update_workflow_column", { p_status: statusId, p_name: name, p_color: color, p_weight: weight });

export const reorderColumns = (workflowId: string, ids: string[]) =>
  rpc("reorder_workflow_columns", { p_workflow: workflowId, p_ids: ids });

export const deleteColumn = (statusId: string, reassignTo: string | null) =>
  rpc("delete_workflow_column", { p_status: statusId, p_reassign_to: reassignTo });

export const setDefaultColumn = (statusId: string) =>
  rpc("set_default_workflow_column", { p_status: statusId });

export const setCompletedColumn = (statusId: string, completed: boolean) =>
  rpc("set_completed_workflow_column", { p_status: statusId, p_completed: completed });
