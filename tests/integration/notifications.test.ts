import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { createTestDb, type TestDb } from "./db";

// Backs Sprint 6: preference-aware notify_user + task_reassigned trigger.

const OWNER = "11111111-1111-1111-1111-111111111111";
const A = "22222222-2222-2222-2222-222222222222";
const B = "33333333-3333-3333-3333-333333333333";

let t: TestDb;
let orgA: string;
let projId: string;

async function makeTask(assignee: string) {
  const id = randomUUID();
  await t.query(
    `insert into public.tasks (id,organization_id,project_id,title,assignee_id,reporter_id)
     values ($1,$2,$3,'T',$4,$5)`,
    [id, orgA, projId, assignee, OWNER],
  );
  return id;
}

async function reassignedFor(user: string, taskId: string) {
  await t.asUser(user);
  const rows = await t.query(
    "select id from public.notifications where user_id=$1 and entity_id=$2 and type='task_reassigned'",
    [user, taskId],
  );
  return rows.length;
}

beforeAll(async () => {
  t = await createTestDb();
  await t.query("insert into auth.users (id,email) values ($1,'o@a.dev'),($2,'a@a.dev'),($3,'b@a.dev')", [
    OWNER,
    A,
    B,
  ]);
  orgA = (
    await t.query("select public.bootstrap_organization('Acme','acme',$1,'it_services') id", [OWNER])
  )[0].id as string;
  for (const u of [A, B]) {
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
    `insert into public.projects (id,organization_id,workspace_id,name,visibility,owner_id) values ($1,$2,$3,'P','private',$4)`,
    [projId, orgA, wsA, OWNER],
  );
  for (const u of [A, B]) {
    await t.query(
      `insert into public.project_members (organization_id,project_id,user_id,role_id)
       values ($1,$2,$3,(select id from public.roles where key='proj_contributor' and organization_id is null))`,
      [orgA, projId, u],
    );
  }
  await t.authenticate();
});

afterAll(async () => {
  await t.db.close();
});

describe("task_reassigned notification", () => {
  it("notifies the new assignee when a manager reassigns", async () => {
    const task = await makeTask(A);
    await t.asUser(OWNER);
    await t.run("update public.tasks set assignee_id=$1 where id=$2", [B, task]);
    expect(await reassignedFor(B, task)).toBe(1);
  });

  it("respects an in-app opt-out (preference-aware notify_user)", async () => {
    const task = await makeTask(A);
    // B opts out of reassignment notifications (RLS: must write as B).
    await t.asUser(B);
    await t.query(
      `insert into public.notification_preferences (organization_id,user_id,type,in_app)
       values ($1,$2,'task_reassigned',false)`,
      [orgA, B],
    );
    await t.asUser(OWNER);
    await t.run("update public.tasks set assignee_id=$1 where id=$2", [B, task]);
    expect(await reassignedFor(B, task)).toBe(0);
  });

  it("never notifies the actor about their own action", async () => {
    const task = await makeTask(A);
    await t.asUser(OWNER);
    // OWNER assigns the task to themselves → target == actor → skipped.
    await t.run("update public.tasks set assignee_id=$1 where id=$2", [OWNER, task]);
    expect(await reassignedFor(OWNER, task)).toBe(0);
  });
});
