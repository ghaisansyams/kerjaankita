import { differenceInCalendarDays } from "date-fns";
import { toDate } from "@/utils/format";
import type { ProjectHealth } from "@/constants";

/**
 * Project health (PRD BR-5). Pure — mirrors the SQL `compute_project_health`
 * so on-screen health always matches the database's view. Tolerance is the
 * tenant's `organization_settings.health_tolerance_points`.
 *
 * Kept in a service (not a component) so every screen derives it identically.
 */
export function computeHealth(
  input: {
    progress: number;
    startDate: string | null;
    endDate: string | null;
    isClosed?: boolean;
  },
  tolerancePoints = 15,
  today: Date = new Date(),
): ProjectHealth {
  const { progress, isClosed } = input;
  const start = toDate(input.startDate);
  const end = toDate(input.endDate);

  if (isClosed) return "on_track";
  if (!end) return "on_track";
  if (today > end && progress < 100) return "delayed";
  if (!start || end <= start) return "on_track";

  const elapsed = differenceInCalendarDays(today, start);
  const total = differenceInCalendarDays(end, start);
  const expected = Math.max(0, Math.min(100, Math.round((elapsed / total) * 100)));

  if (progress < expected - tolerancePoints) return "at_risk";
  return "on_track";
}

/** Whole days between today and the end date (negative = overdue). null if no end. */
export function daysRemaining(
  endDate: string | null,
  today: Date = new Date(),
): number | null {
  const end = toDate(endDate);
  return end ? differenceInCalendarDays(end, today) : null;
}
