import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { createTestDb, type TestDb } from "./db";

const OWNER = "11111111-1111-1111-1111-111111111111";
const CONTRIB = "22222222-2222-2222-2222-222222222222";

let t: TestDb;
let orgA: string;
let projId: string;
let taskId: string;

async function actions(entityId: string) {
  return (
    await t.query("select action from public.activities where entity='task' and entity_id=$1", [entityId])
  ).map((r) => r.action);
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
  taskId = randomUUID();
  await t.query(
    `insert into public.tasks (id,organization_id,project_id,title,assignee_id,reporter_id) values ($1,$2,$3,'T',$4,$5)`,
    [taskId, orgA, projId, CONTRIB, OWNER],
  );
  await t.authenticate();
});

afterAll(async () => {
  await t.db.close();
});

describe("Comments", () => {
  it("lets a project member comment and logs comment.created", async () => {
    await t.asUser(CONTRIB);
    await t.query(
      `insert into public.comments (id,organization_id,project_id,entity,entity_id,author_id,body,is_internal)
       values ($1,$2,$3,'task',$4,$5,'looks good',true)`,
      [randomUUID(), orgA, projId, taskId, CONTRIB],
    );
    expect((await t.query("select id from public.comments where entity_id=$1", [taskId]))).toHaveLength(1);
    expect(await actions(taskId)).toContain("comment.created");
  });

  it("blocks editing another author's comment", async () => {
    await t.asUser(OWNER);
    const cid = randomUUID();
    await t.query(
      `insert into public.comments (id,organization_id,project_id,entity,entity_id,author_id,body) values ($1,$2,$3,'task',$4,$5,'owner note')`,
      [cid, orgA, projId, taskId, OWNER],
    );
    await t.asUser(CONTRIB);
    const n = await t.run("update public.comments set body='hacked' where id=$1", [cid]);
    expect(n).toBe(0);
  });
});

describe("Checklist activity (0013)", () => {
  it("logs checklist.item_added and checklist.item_completed", async () => {
    await t.asUser(CONTRIB); // assignee → can_edit_task
    const itemId = randomUUID();
    await t.query(
      `insert into public.task_checklist_items (id,organization_id,task_id,content) values ($1,$2,$3,'step one')`,
      [itemId, orgA, taskId],
    );
    expect(await actions(taskId)).toContain("checklist.item_added");
    await t.run("update public.task_checklist_items set is_done=true where id=$1", [itemId]);
    expect(await actions(taskId)).toContain("checklist.item_completed");
  });
});

describe("Attachments", () => {
  it("registers metadata and logs attachment.uploaded", async () => {
    await t.asUser(CONTRIB); // proj_contributor has attachment.upload
    await t.query(
      `insert into public.attachments (id,organization_id,project_id,entity,entity_id,bucket,path,file_name,file_type,file_size,uploaded_by)
       values ($1,$2,$3,'task',$4,'attachments',$5,'report.pdf','application/pdf',1024,$6)`,
      [randomUUID(), orgA, projId, taskId, `${orgA}/${projId}/x-report.pdf`, CONTRIB],
    );
    expect(await actions(taskId)).toContain("attachment.uploaded");
    expect((await t.query("select id from public.attachments where entity_id=$1", [taskId]))).toHaveLength(1);
  });

  it("the unified timeline sees status/comment/checklist/upload events together", async () => {
    await t.asUser(CONTRIB);
    const all = await actions(taskId);
    expect(all).toEqual(
      expect.arrayContaining([
        "task.created",
        "comment.created",
        "checklist.item_added",
        "checklist.item_completed",
        "attachment.uploaded",
      ]),
    );
  });
});
