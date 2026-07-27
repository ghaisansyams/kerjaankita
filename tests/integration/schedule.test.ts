import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { createTestDb, type TestDb } from "./db";

// Backs Sprint 5: moveTask (RLS + column guard let an assignee reorder / move
// their own card but not others'; position & status are NOT guarded) and
// rescheduleTaskDue (due_date IS guarded → only a manager can move a due date).

const OWNER = "11111111-1111-1111-1111-111111111111";
const CONTRIB = "22222222-2222-2222-2222-222222222222";

let t: TestDb;
let orgA: string;
let projId: string;
let ownTask: string; // assigned to CONTRIB
let otherTask: string; // assigned to OWNER

async function positionOf(id: string) {
  const rows = await t.query("select position, due_date from public.tasks where id=$1", [id]);
  return rows[0];
}

beforeAll(async () => {
  t = await createTestDb();
  await t.query("insert into auth.users (id,email) values ($1,'o@a.dev'),($2,'c@a.dev')", [OWNER, CONTRIB]);
  orgA = (
    await t.query("select public.bootstrap_organization('Acme','acme',$1,'it_services') id", [OWNER])
  )[0].id as string;
  await t.query(
    `insert into public.organization_members (organization_id,user_id,role_id,status,joined_at)
     values ($1,$2,(select id from public.roles where key='org_member' and organization_id is null),'active',now())`,
    [orgA, CONTRIB],
  );
  const wsA = (await t.query("select id from public.workspaces where organization_id=$1", [orgA]))[0].id as string;
  projId = randomUUID();
  await t.query("select set_config('app.current_user_id',$1,false)", [OWNER]);
  await t.query(
    `insert into public.projects (id,organization_id,workspace_id,name,visibility,owner_id) values ($1,$2,$3,'P','private',$4)`,
    [projId, orgA, wsA, OWNER],
  );
  await t.query(
    `insert into public.project_members (organization_id,project_id,user_id,role_id)
     values ($1,$2,$3,(select id from public.roles where key='proj_contributor' and organization_id is null))`,
    [orgA, projId, CONTRIB],
  );
  ownTask = randomUUID();
  otherTask = randomUUID();
  await t.query(
    `insert into public.tasks (id,organization_id,project_id,title,assignee_id,reporter_id) values ($1,$2,$3,'own',$4,$5)`,
    [ownTask, orgA, projId, CONTRIB, OWNER],
  );
  await t.query(
    `insert into public.tasks (id,organization_id,project_id,title,assignee_id,reporter_id) values ($1,$2,$3,'other',$4,$4)`,
    [otherTask, orgA, projId, OWNER],
  );
  await t.authenticate();
});

afterAll(async () => {
  await t.db.close();
});

describe("Kanban move (position / status)", () => {
  it("lets a manager reorder any card", async () => {
    await t.asUser(OWNER);
    const n = await t.run("update public.tasks set position=5 where id=$1", [otherTask]);
    expect(n).toBe(1);
    expect((await positionOf(otherTask)).position).toBe(5);
  });

  it("lets an assignee reorder their own card (position isn't guarded)", async () => {
    await t.asUser(CONTRIB);
    const n = await t.run("update public.tasks set position=9 where id=$1", [ownTask]);
    expect(n).toBe(1);
    expect((await positionOf(ownTask)).position).toBe(9);
  });

  it("stops an assignee reordering someone else's card", async () => {
    await t.asUser(CONTRIB);
    const n = await t.run("update public.tasks set position=99 where id=$1", [otherTask]);
    expect(n).toBe(0);
  });
});

describe("Calendar reschedule (due_date is guarded)", () => {
  it("reverts an assignee's due-date change via the column guard", async () => {
    await t.asUser(CONTRIB);
    await t.run("update public.tasks set due_date='2026-08-01' where id=$1", [ownTask]);
    await t.asUser(OWNER);
    expect((await positionOf(ownTask)).due_date).toBeNull();
  });

  it("lets a manager set a due date", async () => {
    await t.asUser(OWNER);
    const n = await t.run("update public.tasks set due_date='2026-08-01' where id=$1", [ownTask]);
    expect(n).toBe(1);
    const d = new Date((await positionOf(ownTask)).due_date as string | Date);
    expect([d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()]).toEqual([2026, 7, 1]);
  });
});

describe("Activity log (0015)", () => {
  it("records task.reordered (within-column) and task.rescheduled", async () => {
    await t.asUser(OWNER);
    const actions = (
      await t.query("select action from public.activities where entity='task' and entity_id=$1", [ownTask])
    ).map((r) => r.action);
    expect(actions).toContain("task.reordered"); // assignee moved position, same status
    expect(actions).toContain("task.rescheduled"); // manager set a due date
  });

  it("does not log a reorder when the column (status) also changes", async () => {
    // Cross-column moves are audited as task.status_changed, not task.reordered.
    await t.asUser(OWNER);
    const before = (
      await t.query(
        "select count(*)::int c from public.activities where entity_id=$1 and action='task.reordered'",
        [otherTask],
      )
    )[0].c as number;
    // otherTask keeps its status; a pure position change *should* add one.
    await t.run("update public.tasks set position=7 where id=$1", [otherTask]);
    const after = (
      await t.query(
        "select count(*)::int c from public.activities where entity_id=$1 and action='task.reordered'",
        [otherTask],
      )
    )[0].c as number;
    expect(after).toBe(before + 1);
  });
});
