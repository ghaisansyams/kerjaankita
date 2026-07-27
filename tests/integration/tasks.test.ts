import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { createTestDb, type TestDb } from "./db";

const OWNER = "11111111-1111-1111-1111-111111111111";
const CONTRIB = "22222222-2222-2222-2222-222222222222";
const OUTSIDER = "33333333-3333-3333-3333-333333333333";

let t: TestDb;
let orgA: string;
let projId: string;
let taskId: string;
let bigTaskId: string;
let status: Record<string, string> = {};

async function statusFor(category: string, workflowId: string) {
  const rows = await t.query(
    "select id from public.workflow_statuses where workflow_id=$1 and category=$2 order by position limit 1",
    [workflowId, category],
  );
  return rows[0]?.id as string;
}
async function initialStatus(workflowId: string) {
  return (
    await t.query("select id from public.workflow_statuses where workflow_id=$1 and is_initial", [workflowId])
  )[0].id as string;
}
async function createTask(id: string, assignee: string | null, est: number) {
  await t.query(
    `insert into public.tasks (id,organization_id,project_id,title,assignee_id,reporter_id,estimated_hours)
     values ($1,$2,$3,'Task',$4,$5,$6)`,
    [id, orgA, projId, assignee, OWNER, est],
  );
}

beforeAll(async () => {
  t = await createTestDb();
  await t.query("insert into auth.users (id,email) values ($1,'o@a.dev'),($2,'c@a.dev'),($3,'x@a.dev')", [OWNER, CONTRIB, OUTSIDER]);
  orgA = (
    await t.query("select public.bootstrap_organization('Acme','acme',$1,'it_services') id", [OWNER])
  )[0].id as string;
  for (const u of [CONTRIB, OUTSIDER]) {
    await t.query(
      `insert into public.organization_members (organization_id,user_id,role_id,status,joined_at)
       values ($1,$2,(select id from public.roles where key='org_member' and organization_id is null),'active',now())`,
      [orgA, u],
    );
  }
  const wsA = (await t.query("select id from public.workspaces where organization_id=$1", [orgA]))[0].id as string;

  projId = randomUUID();
  await t.query("select set_config('app.current_user_id',$1,false)", [OWNER]);
  await t.query(
    `insert into public.projects (id,organization_id,workspace_id,name,visibility,owner_id)
     values ($1,$2,$3,'Secret','private',$4)`,
    [projId, orgA, wsA, OWNER],
  );
  // CONTRIB is a project member (proj_contributor → task.update.own)
  await t.query(
    `insert into public.project_members (organization_id,project_id,user_id,role_id)
     values ($1,$2,$3,(select id from public.roles where key='proj_contributor' and organization_id is null))`,
    [orgA, projId, CONTRIB],
  );

  const wf = (
    await t.query(
      "select id from public.workflows where organization_id=$1 and entity='task' and is_default",
      [orgA],
    )
  )[0].id as string;
  status = {
    initial: await initialStatus(wf),
    in_progress: await statusFor("in_progress", wf),
    done: await statusFor("done", wf),
    blocked: await statusFor("blocked", wf),
  };
  await t.authenticate();
});

afterAll(async () => {
  await t.db.close();
});

describe("Tasks under RLS + triggers", () => {
  it("lets a manager create a task (auto number, initial status, activity + notification)", async () => {
    await t.asUser(OWNER);
    taskId = randomUUID();
    await createTask(taskId, CONTRIB, 10);
    const [task] = await t.query(
      "select number, status_id, progress from public.tasks where id=$1",
      [taskId],
    );
    expect(task.number).toBe(1);
    expect(task.status_id).toBe(status.initial);
    expect(task.progress).toBe(0);

    const acts = (await t.query("select action from public.activities where entity_id=$1", [taskId])).map((r) => r.action);
    expect(acts).toContain("task.created");
    // Check the notification as its recipient — RLS hides it from anyone else.
    await t.asUser(CONTRIB);
    const notif = await t.query("select id from public.notifications where type='task_assigned'");
    expect(notif.length).toBeGreaterThan(0);
    await t.asUser(OWNER);
  });

  it("blocks a member without project visibility from creating a task (insert hardening)", async () => {
    await t.asUser(OUTSIDER);
    await expect(createTask(randomUUID(), null, 1)).rejects.toThrow(/row-level security/i);
  });

  it("lets the assignee change their own task's status", async () => {
    await t.asUser(CONTRIB);
    const n = await t.run("update public.tasks set status_id=$1 where id=$2", [status.in_progress, taskId]);
    expect(n).toBe(1);
    expect((await t.query("select status_id from public.tasks where id=$1", [taskId]))[0].status_id).toBe(status.in_progress);
  });

  it("column guard: assignee may change progress but NOT manager-owned fields", async () => {
    await t.asUser(CONTRIB);
    await t.run("update public.tasks set title='hacked', priority='critical', progress=50 where id=$1", [taskId]);
    const [task] = await t.query("select title, priority, progress from public.tasks where id=$1", [taskId]);
    expect(task.progress).toBe(50); // allowed
    expect(task.title).toBe("Task"); // reverted by guard
    expect(task.priority).toBe("medium"); // reverted by guard
  });

  it("blocks the assignee from editing a task assigned to someone else", async () => {
    await t.asUser(OWNER);
    const other = randomUUID();
    await createTask(other, OWNER, 1);
    await t.asUser(CONTRIB);
    const n = await t.run("update public.tasks set status_id=$1 where id=$2", [status.in_progress, other]);
    expect(n).toBe(0);
  });

  it("forces progress=100 and completed_at when entering a done status", async () => {
    await t.asUser(OWNER);
    await t.run("update public.tasks set status_id=$1 where id=$2", [status.done, taskId]);
    const [task] = await t.query("select progress, completed_at from public.tasks where id=$1", [taskId]);
    expect(task.progress).toBe(100);
    expect(task.completed_at).not.toBeNull();
  });

  it("sets is_blocked when entering a blocked status", async () => {
    await t.asUser(OWNER);
    const b = randomUUID();
    await createTask(b, OWNER, 1);
    await t.run("update public.tasks set status_id=$1, blocked_reason='waiting' where id=$2", [status.blocked, b]);
    const [task] = await t.query("select is_blocked, blocked_since from public.tasks where id=$1", [b]);
    expect(task.is_blocked).toBe(true);
    expect(task.blocked_since).not.toBeNull();
  });

  it("rolls project progress up from tasks by effort weight (BR-2)", async () => {
    // Fresh project to control the calculation exactly.
    await t.asUser(OWNER);
    const wsA = (await t.query("select id from public.workspaces where organization_id=$1", [orgA]))[0].id as string;
    projId = randomUUID();
    await t.query(
      `insert into public.projects (id,organization_id,workspace_id,name,visibility,owner_id)
       values ($1,$2,$3,'Rollup','organization',$4)`,
      [projId, orgA, wsA, OWNER],
    );
    const small = randomUUID();
    bigTaskId = randomUUID();
    await createTask(small, OWNER, 10);
    await createTask(bigTaskId, OWNER, 40);
    // small → done (100%), big stays 0 → weighted = (100*10 + 0*40)/50 = 20
    await t.run("update public.tasks set status_id=$1 where id=$2", [status.done, small]);
    const [proj] = await t.query("select progress from public.projects where id=$1", [projId]);
    expect(proj.progress).toBe(20);
  });

  it("blocks a Contributor from deleting a task", async () => {
    await t.asUser(CONTRIB);
    const n = await t.run(
      "update public.tasks set deleted_at=now() where id=$1",
      [bigTaskId],
    );
    expect(n).toBe(0);
  });
});
