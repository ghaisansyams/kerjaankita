import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { createTestDb, type TestDb } from "./db";

// Production hardening: prove multi-tenant isolation — a member of org A can
// never read or write org B's data, at the RLS layer.

const USER_A = "11111111-1111-1111-1111-111111111111";
const USER_B = "22222222-2222-2222-2222-222222222222";

let t: TestDb;
let orgA: string;
let orgB: string;
let projA: string;
let projB: string;

beforeAll(async () => {
  t = await createTestDb();
  await t.query("insert into auth.users (id,email) values ($1,'a@a.dev'),($2,'b@b.dev')", [USER_A, USER_B]);
  orgA = (await t.query("select public.bootstrap_organization('A','a',$1,'it_services') id", [USER_A]))[0].id as string;
  orgB = (await t.query("select public.bootstrap_organization('B','b',$1,'it_services') id", [USER_B]))[0].id as string;

  const wsA = (await t.query("select id from public.workspaces where organization_id=$1", [orgA]))[0].id as string;
  const wsB = (await t.query("select id from public.workspaces where organization_id=$1", [orgB]))[0].id as string;

  projA = randomUUID();
  projB = randomUUID();
  await t.query("select set_config('app.current_user_id',$1,false)", [USER_A]);
  await t.query(
    "insert into public.projects (id,organization_id,workspace_id,name,visibility,owner_id) values ($1,$2,$3,'PA','organization',$4)",
    [projA, orgA, wsA, USER_A],
  );
  await t.query("select set_config('app.current_user_id',$1,false)", [USER_B]);
  await t.query(
    "insert into public.projects (id,organization_id,workspace_id,name,visibility,owner_id) values ($1,$2,$3,'PB','organization',$4)",
    [projB, orgB, wsB, USER_B],
  );
  await t.authenticate();
});

afterAll(async () => {
  await t.db.close();
});

describe("Multi-tenant isolation (RLS)", () => {
  it("scopes project reads to the caller's org", async () => {
    await t.asUser(USER_A);
    expect(await t.query("select id from public.projects where id=$1", [projA])).toHaveLength(1);
    expect(await t.query("select id from public.projects where id=$1", [projB])).toHaveLength(0);

    await t.asUser(USER_B);
    expect(await t.query("select id from public.projects where id=$1", [projB])).toHaveLength(1);
    expect(await t.query("select id from public.projects where id=$1", [projA])).toHaveLength(0);
  });

  it("scopes organization + membership reads to the caller's org", async () => {
    await t.asUser(USER_A);
    const orgs = (await t.query("select id from public.organizations", [])).map((r) => r.id);
    expect(orgs).toContain(orgA);
    expect(orgs).not.toContain(orgB);
    expect(
      await t.query("select id from public.organization_members where organization_id=$1", [orgB]),
    ).toHaveLength(0);
  });

  it("refuses cross-tenant task inserts", async () => {
    await t.asUser(USER_A);
    // USER_A is not a member of org B → tasks_insert WITH CHECK must reject.
    await expect(
      t.query(
        "insert into public.tasks (id,organization_id,project_id,title,reporter_id) values ($1,$2,$3,'x',$4)",
        [randomUUID(), orgB, projB, USER_A],
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it("hides cross-tenant search results", async () => {
    await t.asUser(USER_A);
    // A permission-aware search for org B's project name returns nothing.
    expect(await t.query("select id from public.projects where name ilike '%PB%'", [])).toHaveLength(0);
  });
});
