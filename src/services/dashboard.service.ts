import { computeHealth } from "./project.service";

export type ProjectHealthInput = {
  progress: number;
  start_date: string | null;
  end_date: string | null;
  is_archived: boolean;
};

export type ProjectSummary = {
  active: number;
  completed: number;
  delayed: number;
  atRisk: number;
  avgProgress: number;
  total: number;
};

/**
 * Executive project rollup — pure so the dashboard and any test derive the same
 * numbers. "Active" = non-archived and not yet complete; delayed/at-risk are
 * highlights *within* the active set (a completed project is neither).
 */
export function summarizeProjects(
  rows: ProjectHealthInput[],
  tolerance = 15,
  today: Date = new Date(),
): ProjectSummary {
  let active = 0;
  let completed = 0;
  let delayed = 0;
  let atRisk = 0;
  let progressSum = 0;
  let counted = 0;

  for (const p of rows) {
    if (p.is_archived) continue;
    counted += 1;
    progressSum += p.progress;
    if (p.progress >= 100) {
      completed += 1;
      continue;
    }
    active += 1;
    const health = computeHealth(
      { progress: p.progress, startDate: p.start_date, endDate: p.end_date },
      tolerance,
      today,
    );
    if (health === "delayed") delayed += 1;
    else if (health === "at_risk") atRisk += 1;
  }

  return {
    active,
    completed,
    delayed,
    atRisk,
    avgProgress: counted ? Math.round(progressSum / counted) : 0,
    total: counted,
  };
}

/** Average open assigned tasks per member (one decimal). */
export function averageWorkload(openAssigned: number, memberCount: number): number {
  if (!memberCount) return 0;
  return Math.round((openAssigned / memberCount) * 10) / 10;
}
