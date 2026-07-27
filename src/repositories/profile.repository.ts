import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { TablesUpdate } from "@/types/database.types";

/** Update the caller's own profile (RLS: profiles_update_self). */
export async function updateProfile(id: string, patch: TablesUpdate<"profiles">) {
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update(patch).eq("id", id);
  if (error) throw error;
}
