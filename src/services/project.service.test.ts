import { describe, expect, it } from "vitest";
import { computeHealth, daysRemaining } from "./project.service";

// Fixed "today" so every assertion is deterministic (June 15, 2026, local).
const TODAY = new Date(2026, 5, 15);

describe("computeHealth (PRD BR-5)", () => {
  it("is on_track when the project is closed, regardless of progress", () => {
    expect(
      computeHealth(
        { progress: 10, startDate: "2026-01-01", endDate: "2026-12-31", isClosed: true },
        15,
        TODAY,
      ),
    ).toBe("on_track");
  });

  it("is on_track when there is no end date (cannot be judged)", () => {
    expect(
      computeHealth({ progress: 5, startDate: "2026-01-01", endDate: null }, 15, TODAY),
    ).toBe("on_track");
  });

  it("is delayed when past the end date and under 100%", () => {
    expect(
      computeHealth({ progress: 50, startDate: "2026-05-01", endDate: "2026-06-10" }, 15, TODAY),
    ).toBe("delayed");
  });

  it("is on_track when past the end date but complete (100%)", () => {
    expect(
      computeHealth({ progress: 100, startDate: "2026-05-01", endDate: "2026-06-10" }, 15, TODAY),
    ).toBe("on_track");
  });

  it("is at_risk when progress trails expected by more than the tolerance", () => {
    // window 06-01..06-30: elapsed 14/29 → expected ≈ 48; 30 < 48-15 → at_risk
    expect(
      computeHealth({ progress: 30, startDate: "2026-06-01", endDate: "2026-06-30" }, 15, TODAY),
    ).toBe("at_risk");
  });

  it("is on_track when progress is within the tolerance band", () => {
    expect(
      computeHealth({ progress: 40, startDate: "2026-06-01", endDate: "2026-06-30" }, 15, TODAY),
    ).toBe("on_track");
  });

  it("treats the tolerance boundary as on_track (expected-tolerance is inclusive)", () => {
    // expected 48, tolerance 15 → threshold 33; progress 33 is NOT below 33
    expect(
      computeHealth({ progress: 33, startDate: "2026-06-01", endDate: "2026-06-30" }, 15, TODAY),
    ).toBe("on_track");
  });

  it("honours a custom (tenant) tolerance", () => {
    // With tolerance 5, threshold 43 → 40 < 43 → at_risk
    expect(
      computeHealth({ progress: 40, startDate: "2026-06-01", endDate: "2026-06-30" }, 5, TODAY),
    ).toBe("at_risk");
  });

  it("is on_track when start is missing (cannot estimate expected progress)", () => {
    expect(
      computeHealth({ progress: 0, startDate: null, endDate: "2026-06-30" }, 15, TODAY),
    ).toBe("on_track");
  });

  it("is on_track when end is not after start but still in the future", () => {
    // future end (no overdue) + end <= start → the estimate branch bails to on_track
    expect(
      computeHealth({ progress: 0, startDate: "2026-08-01", endDate: "2026-07-01" }, 15, TODAY),
    ).toBe("on_track");
  });

  it("is delayed when the end date has already passed, even if end precedes start", () => {
    // overdue check fires first — matches SQL compute_project_health ordering
    expect(
      computeHealth({ progress: 0, startDate: "2026-06-30", endDate: "2026-06-01" }, 15, TODAY),
    ).toBe("delayed");
  });
});

describe("daysRemaining", () => {
  it("returns positive whole days until the end date", () => {
    expect(daysRemaining("2026-06-30", TODAY)).toBe(15);
  });
  it("returns negative days when overdue", () => {
    expect(daysRemaining("2026-06-10", TODAY)).toBe(-5);
  });
  it("returns null when there is no end date", () => {
    expect(daysRemaining(null, TODAY)).toBeNull();
  });
});
