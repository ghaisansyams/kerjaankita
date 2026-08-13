"use server";

import { z } from "zod";
import { requireOrgContext } from "@/lib/auth";
import { listRecentActivities } from "@/repositories/activity.repository";
import { mapUnknownError } from "@/lib/errors";
import { actionError, actionOk, type ActionResult } from "@/types/action";
import type { FeedItem } from "./components/activity-feed";

const schema = z.object({
  /** Capped so "show all" can't be turned into an unbounded scrape. */
  limit: z.number().int().min(1).max(200).default(200),
});

/**
 * The longer activity feed, loaded only when the dashboard's "show all" opens —
 * the card itself keeps rendering its short preview.
 *
 * No new visibility: same RLS-scoped read the page already does, just with a
 * larger limit, and scoped to the caller's active organization.
 */
export async function loadRecentActivity(
  input: unknown,
): Promise<ActionResult<{ items: FeedItem[] }>> {
  const ctx = await requireOrgContext();
  const parsed = schema.safeParse(input ?? {});
  if (!parsed.success) return actionError("VALIDATION", "Invalid request.");

  try {
    const rows = await listRecentActivities(ctx.organization.id, parsed.data.limit);
    return actionOk({
      items: rows.map((a) => ({
        id: a.id,
        action: a.action,
        entity: a.entity,
        entityId: a.entity_id,
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
