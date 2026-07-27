import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { DbEnums, TablesInsert } from "@/types/database.types";

export async function listAttachments(entity: DbEnums<"entity_type">, entityId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attachments")
    .select(
      `id, path, file_name, file_type, file_size, is_guest_visible, uploaded_by, created_at,
       uploader:profiles!attachments_uploaded_by_fkey(id, full_name)`,
    )
    .eq("entity", entity)
    .eq("entity_id", entityId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export type AttachmentRow = Awaited<ReturnType<typeof listAttachments>>[number];

/**
 * All attachments in a project (RLS-scoped). For guests this returns only
 * `is_guest_visible` files — the same policy that gates the download.
 */
export async function listProjectAttachments(projectId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attachments")
    .select(
      `id, entity, entity_id, file_name, file_type, file_size, is_guest_visible, uploaded_by, created_at,
       uploader:profiles!attachments_uploaded_by_fkey(id, full_name)`,
    )
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function insertAttachment(values: TablesInsert<"attachments">) {
  const supabase = await createClient();
  const { error } = await supabase.from("attachments").insert(values);
  if (error) throw error;
}

export async function getAttachment(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attachments")
    .select("id, bucket, path, file_name, uploaded_by")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Toggle whether a file is visible to guests (RLS scopes to the caller). */
export async function setAttachmentGuestVisible(id: string, visible: boolean) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attachments")
    .update({ is_guest_visible: visible })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id, project_id")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function softDeleteAttachment(id: string, deletedBy: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attachments")
    .update({ deleted_at: new Date().toISOString(), deleted_by: deletedBy })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id, path, bucket")
    .maybeSingle();
  if (error) throw error;
  return data;
}
