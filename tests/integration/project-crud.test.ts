import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { createTestDb, type TestDb } from "./db";

const OWNER = "11111111-1111-1111-1111-111111111111";
const MEMBER = "22222222-2222-2222-2222-222222222222";
const OWNER_B = "33333333-3333-3333-3333-333333333333";

let t: TestDb;
let orgA: string;
let wsA: string;
let projA: string;

beforeAll(async () => {
  t = await createTestDb();
  await t.query(
    "insert into auth.users (id,email) values ($1,'o@a.dev'),($2,'m@a.dev'),($3,'o@b.dev')",
    [OWNER, MEMBER, OWNER_B],
  );
  orgA = (
    await t.query("select public.bootstrap_organization('Acme','acme',$1,'it_services') id", [OWNER])
  )[0].id as string;
  await t.query("select public.bootstrap_organization('Globex','globex',$1,'general')", [OWNER_B]);
  // add MEMBER as a plain org member (no project.create)
  await t.query(
    `insert into public.organization_members (organization_id,user_id,role_id,status,joined_at)
     values ($1,$2,(select id from public.roles where key='org_member' and organization_id is null),'active',now())`,
    [orgA, MEMBER],
  );
  wsA = (await t.query("select id from public.workspaces where organization_id=$1", [orgA]))[0]
    .id as string;
  await t.authenticate();
});

afterAll(async () => {
  await t.db.close();
});

describe("Project CRUD under RLS", () => {
  it("blocks a plain member from creating a project", async () => {
    await t.asUser(MEMBER);
    await expect(
      t.query(
        `insert into public.projects (organization_id,workspace_id,name,visibility) values ($1,$2,'sneaky','workspace')`,
        [orgA, wsA],
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it("lets an owner create a project; org is derived from the workspace", async () => {
    await t.asUser(OWNER);
    projA = randomUUID();
    await t.query(
      `insert into public.projects (id,organization_id,workspace_id,name,key,visibility,owner_id,start_date,end_date)
       values ($1,$2,$3,'Website','WEB','workspace',$4,current_date-10,current_date+10)`,
      [projA, orgA, wsA, OWNER],
    );
    const created = await t.query("select organization_id from public.projects where id=$1", [projA]);
    expect(created).toHaveLength(1);
    expect(created[0].organization_id).toBe(orgA);
  });

  it("hides a workspace-visibility project from a non-workspace member", async () => {
    await t.asUser(MEMBER);
    const rows = await t.query("select id from public.projects where id=$1", [projA]);
    expect(rows).toHaveLength(0);
  });

  it("shows an organization-visibility project to members but keeps it read-only", async () => {
    await t.asUser(OWNER);
    await t.run("update public.projects set visibility='organization' where id=$1", [projA]);

    await t.asUser(MEMBER);
    const seen = await t.query("select id from public.projects where id=$1", [projA]);
    expect(seen).toHaveLength(1);

    const affected = await t.run("update public.projects set name='hacked' where id=$1", [projA]);
    expect(affected).toBe(0); // RLS filters the row out of the UPDATE
  });

  it("isolates tenants (org B cannot see or modify org A projects)", async () => {
    await t.asUser(OWNER_B);
    const seen = await t.query("select id from public.projects where organization_id=$1", [orgA]);
    expect(seen).toHaveLength(0);
    const affected = await t.run("update public.projects set name='x' where id=$1", [projA]);
    expect(affected).toBe(0);
  });

  it("records the activity trail (created via trigger, updated via log_activity)", async () => {
    await t.asUser(OWNER);
    await t.run("update public.projects set name='Website Rebuild' where id=$1", [projA]);
    await t.query(
      "select public.log_activity($1,$2,'project',$2,'project.updated','{}'::jsonb,true)",
      [orgA, projA],
    );
    const actions = (
      await t.query("select action from public.activities where project_id=$1", [projA])
    ).map((r) => r.action);
    expect(actions).toContain("project.created");
    expect(actions).toContain("project.updated");
  });

  it("archives and soft-deletes (never hard-deletes)", async () => {
    await t.asUser(OWNER);
    await t.run("update public.projects set is_archived=true where id=$1", [projA]);
    expect(
      (await t.query("select is_archived from public.projects where id=$1", [projA]))[0].is_archived,
    ).toBe(true);

    await t.query("select public.soft_delete_project($1)", [projA]);
    const live = await t.query(
      "select id from public.projects where id=$1 and deleted_at is null",
      [projA],
    );
    expect(live).toHaveLength(0);
  });

  it("blocks a plain member from deleting a project", async () => {
    await t.asUser(OWNER);
    const proj2 = randomUUID();
    await t.query(
      `insert into public.projects (id,organization_id,workspace_id,name,visibility,owner_id)
       values ($1,$2,$3,'Temp','organization',$4)`,
      [proj2, orgA, wsA, OWNER],
    );
    await t.asUser(MEMBER);
    const affected = await t.run("delete from public.projects where id=$1", [proj2]);
    expect(affected).toBe(0);
  });
});
