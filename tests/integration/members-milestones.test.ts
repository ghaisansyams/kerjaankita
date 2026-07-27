import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { createTestDb, type TestDb } from "./db";

const OWNER = "11111111-1111-1111-1111-111111111111";
const LEAD = "22222222-2222-2222-2222-222222222222";
const CONTRIB = "33333333-3333-3333-3333-333333333333";

let t: TestDb;
let orgA: string;
let projId: string;
let milestoneId: string;

async function systemRole(key: string) {
  return (
    await t.query("select id from public.roles where key=$1 and organization_id is null", [key])
  )[0].id as string;
}
async function addOrgMember(userId: string) {
  await t.query(
    `insert into public.organization_members (organization_id,user_id,role_id,status,joined_at)
     values ($1,$2,(select id from public.roles where key='org_member' and organization_id is null),'active',now())`,
    [orgA, userId],
  );
}

beforeAll(async () => {
  t = await createTestDb();
  await t.query(
    "insert into auth.users (id,email) values ($1,'o@a.dev'),($2,'l@a.dev'),($3,'c@a.dev')",
    [OWNER, LEAD, CONTRIB],
  );
  orgA = (
    await t.query("select public.bootstrap_organization('Acme','acme',$1,'it_services') id", [OWNER])
  )[0].id as string;
  await addOrgMember(LEAD);
  await addOrgMember(CONTRIB);
  const wsA = (
    await t.query("select id from public.workspaces where organization_id=$1", [orgA])
  )[0].id as string;

  // a PRIVATE project so access must come from explicit membership
  projId = randomUUID();
  await t.query("select set_config('app.current_user_id',$1,false)", [OWNER]);
  await t.query(
    `insert into public.projects (id,organization_id,workspace_id,name,visibility,owner_id)
     values ($1,$2,$3,'Secret','private',$4)`,
    [projId, orgA, wsA, OWNER],
  );
  await t.authenticate();
});

afterAll(async () => {
  await t.db.close();
});

describe("Project members under RLS", () => {
  it("lets a manager add a project member", async () => {
    await t.asUser(OWNER);
    const leadRole = await systemRole("proj_lead");
    await t.query(
      `insert into public.project_members (organization_id,project_id,user_id,role_id) values ($1,$2,$3,$4)`,
      [orgA, projId, LEAD, leadRole],
    );
    const rows = await t.query("select id from public.project_members where project_id=$1", [projId]);
    expect(rows).toHaveLength(1);
  });

  it("grants a member visibility of an otherwise-private project", async () => {
    await t.asUser(LEAD);
    const seen = await t.query("select id from public.projects where id=$1", [projId]);
    expect(seen).toHaveLength(1);
  });

  it("recognises project-scoped roles: a Project Lead can add members", async () => {
    // LEAD holds proj_lead (has project.member.manage at project scope) but is
    // only a plain org member — the org role alone would NOT allow this.
    await t.asUser(LEAD);
    const contribRole = await systemRole("proj_contributor");
    await t.query(
      `insert into public.project_members (organization_id,project_id,user_id,role_id) values ($1,$2,$3,$4)`,
      [orgA, projId, CONTRIB, contribRole],
    );
    const rows = await t.query("select user_id from public.project_members where project_id=$1", [projId]);
    expect(rows.map((r) => r.user_id)).toContain(CONTRIB);
  });

  it("blocks a Contributor from managing members", async () => {
    await t.asUser(CONTRIB);
    await expect(
      t.query(
        `insert into public.project_members (organization_id,project_id,user_id,role_id) values ($1,$2,$3,(select id from public.roles where key='proj_viewer' and organization_id is null))`,
        [orgA, projId, OWNER],
      ),
    ).rejects.toThrow(/row-level security/i);
  });
});

describe("Milestones under RLS", () => {
  it("lets a manager create a milestone and logs the activity", async () => {
    await t.asUser(OWNER);
    milestoneId = randomUUID();
    await t.query(
      `insert into public.milestones (id,organization_id,project_id,name) values ($1,$2,$3,'Kickoff')`,
      [milestoneId, orgA, projId],
    );
    await t.query(
      "select public.log_activity($1,$2,'milestone',$3,'milestone.created','{}'::jsonb,true)",
      [orgA, projId, milestoneId],
    );
    const actions = (
      await t.query("select action from public.activities where entity_id=$1", [milestoneId])
    ).map((r) => r.action);
    expect(actions).toContain("milestone.created");
  });

  it("lets a project member read milestones", async () => {
    await t.asUser(CONTRIB);
    const rows = await t.query("select id from public.milestones where project_id=$1", [projId]);
    expect(rows).toHaveLength(1);
  });

  it("blocks a Contributor from creating a milestone", async () => {
    await t.asUser(CONTRIB);
    await expect(
      t.query(
        `insert into public.milestones (id,organization_id,project_id,name) values ($1,$2,$3,'Nope')`,
        [randomUUID(), orgA, projId],
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it("removes a member (soft delete) and revokes their access", async () => {
    await t.asUser(OWNER);
    await t.run(
      "update public.project_members set deleted_at=now(), deleted_by=$1 where project_id=$2 and user_id=$3",
      [OWNER, projId, CONTRIB],
    );
    await t.asUser(CONTRIB);
    const seen = await t.query("select id from public.projects where id=$1", [projId]);
    expect(seen).toHaveLength(0);
  });
});
