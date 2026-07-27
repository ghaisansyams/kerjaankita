import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { createTestDb, type TestDb } from "./db";

// Backs Sprint 7: guest isolation (RLS) + permission-aware search.

const OWNER = "11111111-1111-1111-1111-111111111111";
const GUEST = "22222222-2222-2222-2222-222222222222";
const OUTSIDER = "33333333-3333-3333-3333-333333333333";

let t: TestDb;
let orgA: string;
let acc: string;
let projP: string; // shared with the guest's account
let projQ: string; // private, not shared
let taskT: string;

beforeAll(async () => {
  t = await createTestDb();
  await t.query("insert into auth.users (id,email) values ($1,'o@a.dev'),($2,'g@a.dev'),($3,'x@a.dev')", [
    OWNER,
    GUEST,
    OUTSIDER,
  ]);
  orgA = (
    await t.query("select public.bootstrap_organization('Acme','acme',$1,'it_services') id", [OWNER])
  )[0].id as string;

  acc = randomUUID();
  await t.query("insert into public.accounts (id,organization_id,name) values ($1,$2,'Client A')", [acc, orgA]);

  // GUEST → member_type 'guest' linked to the account; OUTSIDER → plain member.
  await t.query(
    `insert into public.organization_members (organization_id,user_id,role_id,member_type,account_id,status,joined_at)
     values ($1,$2,(select id from public.roles where key='org_member' and organization_id is null),'guest',$3,'active',now())`,
    [orgA, GUEST, acc],
  );
  await t.query(
    `insert into public.organization_members (organization_id,user_id,role_id,member_type,status,joined_at)
     values ($1,$2,(select id from public.roles where key='org_member' and organization_id is null),'member','active',now())`,
    [orgA, OUTSIDER],
  );

  const wsA = (await t.query("select id from public.workspaces where organization_id=$1", [orgA]))[0].id as string;
  await t.query("select set_config('app.current_user_id',$1,false)", [OWNER]);

  projP = randomUUID();
  projQ = randomUUID();
  await t.query(
    `insert into public.projects (id,organization_id,workspace_id,name,visibility,account_id,owner_id)
     values ($1,$2,$3,'Portal Project','private',$4,$5)`,
    [projP, orgA, wsA, acc, OWNER],
  );
  await t.query(
    `insert into public.projects (id,organization_id,workspace_id,name,visibility,owner_id)
     values ($1,$2,$3,'Secret Q','private',$4)`,
    [projQ, orgA, wsA, OWNER],
  );

  taskT = randomUUID();
  await t.query(
    `insert into public.tasks (id,organization_id,project_id,title,assignee_id,reporter_id) values ($1,$2,$3,'T',$4,$4)`,
    [taskT, orgA, projP, OWNER],
  );

  // Two files: one shared with guests, one internal.
  await t.query(
    `insert into public.attachments (id,organization_id,project_id,entity,entity_id,bucket,path,file_name,file_type,file_size,uploaded_by,is_guest_visible)
     values ($1,$2,$3,'task',$4,'attachments',$5,'shared.pdf','application/pdf',10,$6,true)`,
    [randomUUID(), orgA, projP, taskT, `${orgA}/shared.pdf`, OWNER],
  );
  await t.query(
    `insert into public.attachments (id,organization_id,project_id,entity,entity_id,bucket,path,file_name,file_type,file_size,uploaded_by,is_guest_visible)
     values ($1,$2,$3,'task',$4,'attachments',$5,'internal.pdf','application/pdf',10,$6,false)`,
    [randomUUID(), orgA, projP, taskT, `${orgA}/internal.pdf`, OWNER],
  );

  // Internal comment (guests must never see internal comments).
  await t.query(
    `insert into public.comments (id,organization_id,project_id,entity,entity_id,author_id,body,is_internal)
     values ($1,$2,$3,'task',$4,$5,'internal note',true)`,
    [randomUUID(), orgA, projP, taskT, OWNER],
  );

  // Activities: one guest-visible, one internal.
  await t.query(
    `insert into public.activities (id,organization_id,project_id,entity,entity_id,action,is_guest_visible)
     values ($1,$2,$3,'project',$3,'project.shared_update',true)`,
    [randomUUID(), orgA, projP],
  );
  await t.query(
    `insert into public.activities (id,organization_id,project_id,entity,entity_id,action,is_guest_visible)
     values ($1,$2,$3,'task',$4,'task.status_changed',false)`,
    [randomUUID(), orgA, projP, taskT],
  );

  await t.authenticate();
});

afterAll(async () => {
  await t.db.close();
});

describe("Guest isolation (RLS)", () => {
  it("sees a project shared with its account but not an unshared one", async () => {
    await t.asUser(GUEST);
    expect(await t.query("select id from public.projects where id=$1", [projP])).toHaveLength(1);
    expect(await t.query("select id from public.projects where id=$1", [projQ])).toHaveLength(0);
  });

  it("sees only guest-visible files", async () => {
    await t.asUser(GUEST);
    const rows = await t.query("select file_name, is_guest_visible from public.attachments where project_id=$1", [projP]);
    expect(rows).toHaveLength(1);
    expect(rows[0].file_name).toBe("shared.pdf");
  });

  it("never sees internal comments", async () => {
    await t.asUser(GUEST);
    expect(await t.query("select id from public.comments where entity_id=$1", [taskT])).toHaveLength(0);
  });

  it("sees only the guest-visible activity subset", async () => {
    await t.asUser(GUEST);
    const actions = (await t.query("select action from public.activities where project_id=$1", [projP])).map(
      (r) => r.action,
    );
    expect(actions).toContain("project.shared_update");
    expect(actions).not.toContain("task.status_changed");
  });
});

describe("Permission-aware search", () => {
  it("returns a shared project to the guest but hides it from a non-member", async () => {
    await t.asUser(GUEST);
    expect(await t.query("select id from public.projects where name ilike '%Portal%'", [])).toHaveLength(1);
    await t.asUser(OUTSIDER);
    expect(await t.query("select id from public.projects where name ilike '%Portal%'", [])).toHaveLength(0);
  });
});
