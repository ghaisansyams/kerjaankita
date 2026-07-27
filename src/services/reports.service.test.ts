import { describe, expect, it } from "vitest";
import {
  buildMemberProductivity,
  buildOverdue,
  type RMember,
  type RTask,
} from "./reports.service";

const TODAY = new Date("2026-06-15T00:00:00Z");

function task(over: Partial<RTask>): RTask {
  return {
    id: crypto.randomUUID(),
    title: "T",
    dueDate: null,
    completedAt: null,
    estimatedHours: null,
    priority: "medium",
    assigneeId: null,
    assigneeName: null,
    projectId: "p1",
    projectName: "P",
    category: "todo",
    ...over,
  };
}

const MEMBERS: RMember[] = [{ id: "u1", name: "Ada" }];

describe("buildMemberProductivity", () => {
  it("counts assigned / completed-in-range / open with a completion rate", () => {
    const tasks = [
      task({ assigneeId: "u1", completedAt: "2026-06-10T09:00:00Z" }), // completed in range
      task({ assigneeId: "u1", completedAt: "2026-01-01T09:00:00Z" }), // completed, out of range
      task({ assigneeId: "u1" }), // open
    ];
    const vm = buildMemberProductivity(MEMBERS, tasks, { from: "2026-06-01", to: "2026-06-30" });
    const row = vm.rows[0];
    expect(row.assigned).toBe(3);
    expect(row.completed).toBe(1); // only the in-range completion
    expect(row.open).toBe(1);
    expect(row.completion).toBe(33); // 1 in-range / 3 assigned
  });
});

describe("buildOverdue", () => {
  it("lists open past-due tasks, most overdue first", () => {
    const tasks = [
      task({ title: "late", dueDate: "2026-06-01", assigneeName: "Ada" }),
      task({ title: "later", dueDate: "2026-05-01", assigneeName: "Ada" }),
      task({ title: "done", dueDate: "2026-05-01", completedAt: "2026-05-02T00:00:00Z" }), // completed → excluded
      task({ title: "future", dueDate: "2026-07-01" }), // not yet due → excluded
    ];
    const vm = buildOverdue(tasks, {}, TODAY);
    expect(vm.rows.map((r) => r.task)).toEqual(["later", "late"]);
    expect(vm.rows[0].daysOverdue).toBeGreaterThan(vm.rows[1].daysOverdue as number);
  });
});
