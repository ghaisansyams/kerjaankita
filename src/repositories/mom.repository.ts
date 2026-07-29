import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { listOrgMemberProfiles } from "@/repositories/member.repository";

/**
 * The mom_* tables are newer than the generated Database types, so this repo —
 * the only place that touches them — widens the client locally. Returned rows
 * are cast to the explicit view-models below, so no `any` leaks outward.
 */
async function db(): Promise<SupabaseClient> {
  return (await createClient()) as unknown as SupabaseClient;
}

export const MOM_CATEGORIES = ["discussion", "decision", "action_item", "next_step"] as const;
export type MomCategory = (typeof MOM_CATEGORIES)[number];

export type MomParticipantVM = { id: string; name: string; role: string | null; company: string | null };
export type MomDistributionVM = { id: string; recipient: string };
export type MomNoteVM = { id: string; category: string; content: string; position: number; taskId: string | null };

export type MomListItem = {
  id: string;
  title: string;
  meetingDate: string;
  meetingTime: string | null;
  location: string | null;
  projectId: string;
  projectName: string;
  projectColor: string | null;
  workspaceId: string | null;
  picId: string | null;
  picName: string | null;
  noteCount: number;
};

export type MomDetail = {
  id: string;
  organizationId: string;
  workspaceId: string | null;
  projectId: string;
  projectName: string;
  title: string;
  meetingDate: string;
  meetingTime: string | null;
  location: string | null;
  picId: string | null;
  picName: string | null;
  preparedById: string | null;
  preparedByName: string | null;
  approvedByName: string;
  approvedByRole: string;
  participants: MomParticipantVM[];
  distribution: MomDistributionVM[];
  notes: MomNoteVM[];
};

export type MomFilters = {
  search?: string;
  projectId?: string;
  picId?: string;
  workspaceId?: string;
  from?: string;
  to?: string;
};

type Row = Record<string, unknown>;
const s = (v: unknown) => (v == null ? null : String(v));

export async function listMoms(orgId: string, filters: MomFilters = {}): Promise<MomListItem[]> {
  const sb = await db();
  let q = sb
    .from("mom")
    .select("id, title, meeting_date, meeting_time, location, project_id, workspace_id, pic_id")
    .eq("organization_id", orgId)
    .is("deleted_at", null);
  if (filters.projectId) q = q.eq("project_id", filters.projectId);
  if (filters.picId) q = q.eq("pic_id", filters.picId);
  if (filters.workspaceId) q = q.eq("workspace_id", filters.workspaceId);
  if (filters.from) q = q.gte("meeting_date", filters.from);
  if (filters.to) q = q.lte("meeting_date", filters.to);
  if (filters.search) q = q.ilike("title", `%${filters.search}%`);
  q = q.order("meeting_date", { ascending: false }).order("created_at", { ascending: false });
  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []) as Row[];

  const [projects, members, counts] = await Promise.all([
    projectLookup(sb, orgId),
    memberLookup(orgId),
    noteCounts(sb, rows.map((r) => String(r.id))),
  ]);

  return rows.map((r) => {
    const projectId = String(r.project_id);
    const proj = projects.get(projectId);
    return {
      id: String(r.id),
      title: String(r.title),
      meetingDate: String(r.meeting_date),
      meetingTime: s(r.meeting_time),
      location: s(r.location),
      projectId,
      projectName: proj?.name ?? "Project",
      projectColor: proj?.color ?? null,
      workspaceId: s(r.workspace_id),
      picId: s(r.pic_id),
      picName: r.pic_id ? members.get(String(r.pic_id)) ?? null : null,
      noteCount: counts.get(String(r.id)) ?? 0,
    };
  });
}

export async function listProjectMoms(projectId: string): Promise<MomListItem[]> {
  const sb = await db();
  const { data: mom } = await sb
    .from("mom")
    .select("organization_id")
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  if (!mom) return [];
  const all = await listMoms(String((mom as Row).organization_id), { projectId });
  return all;
}

export async function getMom(id: string): Promise<MomDetail | null> {
  const sb = await db();
  const { data, error } = await sb.from("mom").select("*").eq("id", id).is("deleted_at", null).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const r = data as Row;
  const orgId = String(r.organization_id);

  const [participantsRes, distributionRes, notesRes, projects, members] = await Promise.all([
    sb.from("mom_participants").select("id, name, role, company").eq("mom_id", id).order("position"),
    sb.from("mom_distribution").select("id, recipient").eq("mom_id", id).order("position"),
    sb.from("mom_notes").select("id, category, content, position, task_id").eq("mom_id", id).order("position"),
    projectLookup(sb, orgId),
    memberLookup(orgId),
  ]);

  return {
    id: String(r.id),
    organizationId: orgId,
    workspaceId: s(r.workspace_id),
    projectId: String(r.project_id),
    projectName: projects.get(String(r.project_id))?.name ?? "Project",
    title: String(r.title),
    meetingDate: String(r.meeting_date),
    meetingTime: s(r.meeting_time),
    location: s(r.location),
    picId: s(r.pic_id),
    picName: r.pic_id ? members.get(String(r.pic_id)) ?? null : null,
    preparedById: s(r.prepared_by),
    preparedByName: r.prepared_by ? members.get(String(r.prepared_by)) ?? null : null,
    approvedByName: String(r.approved_by_name ?? ""),
    approvedByRole: String(r.approved_by_role ?? ""),
    participants: ((participantsRes.data ?? []) as Row[]).map((p) => ({
      id: String(p.id),
      name: String(p.name),
      role: s(p.role),
      company: s(p.company),
    })),
    distribution: ((distributionRes.data ?? []) as Row[]).map((d) => ({ id: String(d.id), recipient: String(d.recipient) })),
    notes: ((notesRes.data ?? []) as Row[]).map((n) => ({
      id: String(n.id),
      category: String(n.category),
      content: String(n.content),
      position: Number(n.position),
      taskId: s(n.task_id),
    })),
  };
}

/** Options for the list filters + the create form. */
export async function getMomFilterOptions(orgId: string) {
  const sb = await db();
  const [projectsRes, wsRes, members] = await Promise.all([
    sb.from("projects").select("id, name, workspace_id").eq("organization_id", orgId).is("deleted_at", null).order("name"),
    sb.from("workspaces").select("id, name").eq("organization_id", orgId).is("deleted_at", null).order("name"),
    listOrgMemberProfiles(orgId),
  ]);
  return {
    projects: ((projectsRes.data ?? []) as Row[]).map((p) => ({ id: String(p.id), name: String(p.name), workspaceId: s(p.workspace_id) })),
    workspaces: ((wsRes.data ?? []) as Row[]).map((w) => ({ id: String(w.id), name: String(w.name) })),
    members: members.map((m) => ({ id: m.id, name: m.full_name ?? m.email ?? "Member" })),
  };
}

/* -------------------------------- writes -------------------------------- */

export async function insertMom(values: Row): Promise<{ id: string }> {
  const sb = await db();
  const { data, error } = await sb.from("mom").insert(values).select("id").single();
  if (error) throw error;
  return { id: String((data as Row).id) };
}

export async function updateMomRow(id: string, patch: Row) {
  const sb = await db();
  const { error } = await sb.from("mom").update(patch).eq("id", id).is("deleted_at", null);
  if (error) throw error;
}

export async function softDeleteMom(id: string) {
  const sb = await db();
  const { error } = await sb.from("mom").update({ deleted_at: new Date().toISOString() }).eq("id", id).is("deleted_at", null);
  if (error) throw error;
}

export async function replaceParticipants(momId: string, items: { name: string; role: string | null; company: string | null }[]) {
  const sb = await db();
  await sb.from("mom_participants").delete().eq("mom_id", momId);
  if (items.length) {
    const { error } = await sb.from("mom_participants").insert(items.map((it, i) => ({ mom_id: momId, name: it.name, role: it.role, company: it.company, position: i })));
    if (error) throw error;
  }
}

export async function replaceDistribution(momId: string, recipients: string[]) {
  const sb = await db();
  await sb.from("mom_distribution").delete().eq("mom_id", momId);
  if (recipients.length) {
    const { error } = await sb.from("mom_distribution").insert(recipients.map((r, i) => ({ mom_id: momId, recipient: r, position: i })));
    if (error) throw error;
  }
}

/** Reconcile notes by id so linked task_id survives an edit. */
export async function reconcileNotes(
  momId: string,
  notes: { id?: string; category: string; content: string }[],
) {
  const sb = await db();
  const { data } = await sb.from("mom_notes").select("id").eq("mom_id", momId);
  const existing = new Set(((data ?? []) as Row[]).map((r) => String(r.id)));
  const keep = new Set(notes.filter((n) => n.id).map((n) => n.id as string));
  const toDelete = [...existing].filter((id) => !keep.has(id));
  if (toDelete.length) await sb.from("mom_notes").delete().in("id", toDelete);
  for (let i = 0; i < notes.length; i++) {
    const n = notes[i];
    if (n.id && existing.has(n.id)) {
      await sb.from("mom_notes").update({ category: n.category, content: n.content, position: i }).eq("id", n.id);
    } else {
      await sb.from("mom_notes").insert({ mom_id: momId, category: n.category, content: n.content, position: i });
    }
  }
}

export async function getNote(noteId: string): Promise<{ momId: string; content: string; taskId: string | null } | null> {
  const sb = await db();
  const { data } = await sb.from("mom_notes").select("mom_id, content, task_id").eq("id", noteId).maybeSingle();
  if (!data) return null;
  const r = data as Row;
  return { momId: String(r.mom_id), content: String(r.content), taskId: s(r.task_id) };
}

export async function linkNoteTask(noteId: string, taskId: string) {
  const sb = await db();
  const { error } = await sb.from("mom_notes").update({ task_id: taskId }).eq("id", noteId);
  if (error) throw error;
}

export async function getMomProjectContext(momId: string): Promise<{ organizationId: string; projectId: string } | null> {
  const sb = await db();
  const { data } = await sb.from("mom").select("organization_id, project_id").eq("id", momId).is("deleted_at", null).maybeSingle();
  if (!data) return null;
  const r = data as Row;
  return { organizationId: String(r.organization_id), projectId: String(r.project_id) };
}

/* -------------------------------- lookups ------------------------------- */

async function projectLookup(sb: SupabaseClient, orgId: string) {
  const { data } = await sb.from("projects").select("id, name, color, workspace_id").eq("organization_id", orgId).is("deleted_at", null);
  const map = new Map<string, { name: string; color: string | null; workspaceId: string | null }>();
  for (const p of (data ?? []) as Row[]) map.set(String(p.id), { name: String(p.name), color: s(p.color), workspaceId: s(p.workspace_id) });
  return map;
}

async function memberLookup(orgId: string) {
  const members = await listOrgMemberProfiles(orgId);
  const map = new Map<string, string>();
  for (const m of members) map.set(m.id, m.full_name ?? m.email ?? "Member");
  return map;
}

async function noteCounts(sb: SupabaseClient, momIds: string[]) {
  const map = new Map<string, number>();
  if (!momIds.length) return map;
  const { data } = await sb.from("mom_notes").select("mom_id").in("mom_id", momIds);
  for (const r of (data ?? []) as Row[]) map.set(String(r.mom_id), (map.get(String(r.mom_id)) ?? 0) + 1);
  return map;
}

/** Resolve a project's workspace_id (mom stores it denormalized for filtering). */
export async function getProjectWorkspace(projectId: string): Promise<string | null> {
  const sb = await db();
  const { data } = await sb.from("projects").select("workspace_id").eq("id", projectId).maybeSingle();
  return data ? s((data as Row).workspace_id) : null;
}

/** Company letterhead for the PDF. */
export async function getOrgBranding(orgId: string): Promise<{ name: string; logoUrl: string | null }> {
  const sb = await db();
  const { data } = await sb.from("organizations").select("name, logo_url").eq("id", orgId).maybeSingle();
  const r = (data ?? {}) as Row;
  return { name: String(r.name ?? "Company"), logoUrl: s(r.logo_url) };
}
