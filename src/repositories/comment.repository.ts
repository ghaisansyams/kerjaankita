import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { DbEnums, TablesInsert } from "@/types/database.types";

export async function listComments(entity: DbEnums<"entity_type">, entityId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("comments")
    .select(
      `id, body, author_id, parent_id, is_internal, is_edited, created_at, updated_at,
       author:profiles!comments_author_id_fkey(id, full_name, avatar_url)`,
    )
    .eq("entity", entity)
    .eq("entity_id", entityId)
    .is("deleted_at", null)
    .order("created_at");
  if (error) throw error;
  return data;
}

export type CommentRow = Awaited<ReturnType<typeof listComments>>[number];

export async function insertComment(values: TablesInsert<"comments">) {
  const supabase = await createClient();
  const { error } = await supabase.from("comments").insert(values);
  if (error) throw error;
}

export async function updateComment(id: string, body: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("comments")
    .update({ body, is_edited: true })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id, entity_id")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function softDeleteComment(id: string, deletedBy: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("comments")
    .update({ deleted_at: new Date().toISOString(), deleted_by: deletedBy })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id, entity_id")
    .maybeSingle();
  if (error) throw error;
  return data;
}
