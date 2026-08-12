"use server";

import { z } from "zod";
import { requireOrgContext } from "@/lib/auth";
import { listProjectActivities } from "@/repositories/activity.repository";
import { getProject } from "@/repositories/project.repository";
import { mapUnknownError } from "@/lib/errors";
import { actionError, actionOk, type ActionResult } from "@/types/action";

export type PortalUpdate = {
  id: string;
  action: string;
  metadata: Record<string, unknown>;
  actorName: string | null;
  actorAvatar: string | null;
  createdAt: string;
};

const schema = z.object({
  projectId: z.string().uuid(),
  /** Capped so "show all" can't be turned into an unbounded scrape. */
  limit: z.number().int().min(1).max(200).default(200),
});

/**
 * The full activity feed for one project, loaded only when the client opens
 * "show all updates" — the page itself keeps rendering its short preview.
 *
 * No new visibility: getProject is RLS-scoped (null unless this project is
 * shared with the guest's account) and listProjectActivities returns guests
 * only the guest-visible subset, exactly as the page already does.
 */
export async function loadPortalUpdates(
  input: unknown,
): Promise<ActionResult<{ updates: PortalUpdate[] }>> {
  await requireOrgContext();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return actionError("VALIDATION", "Invalid request.");

  try {
    const project = await getProject(parsed.data.projectId);
    if (!project) return actionError("NOT_FOUND", "Project not found.");

    const rows = await listProjectActivities(parsed.data.projectId, parsed.data.limit);
    return actionOk({
      updates: rows.map((a) => ({
        id: a.id,
        action: a.action,
        metadata: (a.metadata as Record<string, unknown>) ?? {},
        actorName: a.actor?.full_name ?? null,
        actorAvatar: a.actor?.avatar_url ?? null,
        createdAt: a.created_at,
      })),
    });
  } catch (e) {
    return mapUnknownError(e);
  }
}
