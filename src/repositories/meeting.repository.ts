import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// meeting_* tables aren't in the generated Database types yet — permissive
// client (same pattern as MOM / import planning).
async function db(): Promise<SupabaseClient> {
  return (await createClient()) as unknown as SupabaseClient;
}
function admin(): SupabaseClient {
  return createAdminClient() as unknown as SupabaseClient;
}

export type MeetingRow = Record<string, unknown>;

export async function insertMeetingRecord(values: Record<string, unknown>): Promise<string> {
  const supabase = await db();
  const { data, error } = await supabase.from("meeting_records").insert(values).select("id").single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function listMeetingRecords(orgId: string) {
  const supabase = await db();
  const { data, error } = await supabase
    .from("meeting_records")
    .select(
      "id, title, meeting_date, status, duration_seconds, audio_size_bytes, audio_file_name, project_id, is_private, created_at, created_by",
    )
    .eq("organization_id", orgId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as MeetingRow[]) ?? [];
}

export async function getMeetingRecord(id: string): Promise<MeetingRow | null> {
  const supabase = await db();
  const { data, error } = await supabase
    .from("meeting_records")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  return (data as MeetingRow) ?? null;
}

export async function getTranscript(meetingId: string): Promise<MeetingRow | null> {
  const supabase = await db();
  const { data, error } = await supabase
    .from("meeting_transcripts")
    .select("id, content, raw_content, language, provider, model, updated_at")
    .eq("meeting_id", meetingId)
    .maybeSingle();
  if (error) throw error;
  return (data as MeetingRow) ?? null;
}

export async function saveTranscriptContent(meetingId: string, content: string, updatedBy: string) {
  const supabase = await db();
  const { error } = await supabase
    .from("meeting_transcripts")
    .update({ content, updated_at: new Date().toISOString(), updated_by: updatedBy })
    .eq("meeting_id", meetingId);
  if (error) throw error;
}

export async function softDeleteMeeting(id: string, deletedBy: string) {
  const supabase = await db();
  const { data, error } = await supabase
    .from("meeting_records")
    .update({ deleted_at: new Date().toISOString(), deleted_by: deletedBy })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ----- pipeline (admin — runs after the action authorizes the caller) -------
export async function adminGetMeeting(id: string): Promise<MeetingRow | null> {
  const { data, error } = await admin().from("meeting_records").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as MeetingRow) ?? null;
}

export async function adminUpdateMeeting(id: string, patch: Record<string, unknown>) {
  const { error } = await admin()
    .from("meeting_records")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function adminUpsertTranscript(values: Record<string, unknown>) {
  const { error } = await admin()
    .from("meeting_transcripts")
    .upsert(values, { onConflict: "meeting_id" });
  if (error) throw error;
}

export async function adminSignedAudioUrl(bucket: string, path: string, ttl = 3600): Promise<string | null> {
  const { data, error } = await admin().storage.from(bucket).createSignedUrl(path, ttl);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export async function adminDownloadAudio(bucket: string, path: string): Promise<Buffer> {
  const { data, error } = await admin().storage.from(bucket).download(path);
  if (error || !data) throw error ?? new Error("Audio not found");
  return Buffer.from(await data.arrayBuffer());
}
