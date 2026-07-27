import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Read-only account options for the project picker. Full Accounts CRUD is a later sprint. */
export async function listAccountOptions(orgId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("accounts")
    .select("id, name")
    .eq("organization_id", orgId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("name");
  if (error) throw error;
  return data;
}

export type AccountOption = Awaited<ReturnType<typeof listAccountOptions>>[number];
