import { describe, expect, it } from "vitest";
import { averageWorkload, summarizeProjects, type ProjectHealthInput } from "./dashboard.service";

// A fixed "today" keeps health math deterministic.
const TODAY = new Date("2026-06-15T00:00:00Z");

function p(over: Partial<ProjectHealthInput>): ProjectHealthInput {
  return { progress: 0, start_date: null, end_date: null, is_archived: false, ...over };
}

describe("summarizeProjects", () => {
  it("classifies active / completed and ignores archived", () => {
    const s = summarizeProjects(
      [
        p({ progress: 100 }), // completed
        p({ progress: 40 }), // active
        p({ progress: 10, is_archived: true }), // ignored
      ],
      15,
      TODAY,
    );
    expect(s.completed).toBe(1);
    expect(s.active).toBe(1);
    expect(s.total).toBe(2); // archived excluded
    expect(s.avgProgress).toBe(70); // (100 + 40) / 2
  });

  it("flags delayed (past end, <100) and at-risk (behind the expected pace)", () => {
    const s = summarizeProjects(
      [
        p({ progress: 50, start_date: "2026-01-01", end_date: "2026-05-01" }), // delayed (past end)
        p({ progress: 5, start_date: "2026-06-01", end_date: "2026-06-30" }), // at risk (behind)
        p({ progress: 100, start_date: "2026-01-01", end_date: "2026-05-01" }), // completed, not delayed
      ],
      15,
      TODAY,
    );
    expect(s.delayed).toBe(1);
    expect(s.atRisk).toBe(1);
    expect(s.completed).toBe(1);
  });
});

describe("averageWorkload", () => {
  it("returns open tasks per member to one decimal, guarding divide-by-zero", () => {
    expect(averageWorkload(15, 4)).toBe(3.8);
    expect(averageWorkload(10, 0)).toBe(0);
  });
});
