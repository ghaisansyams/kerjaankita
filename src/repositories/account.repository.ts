import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { TablesInsert, TablesUpdate } from "@/types/database.types";

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

export type ClientAccountRow = {
  id: string;
  name: string;
  code: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  notes: string | null;
  isActive: boolean;
  projects: { id: string; name: string }[];
  contactCount: number;
};

/** Client accounts for the org, each with its linked projects and portal-contact count. */
export async function listClientAccounts(orgId: string): Promise<ClientAccountRow[]> {
  const supabase = await createClient();
  const [accountsRes, projectsRes, guestsRes] = await Promise.all([
    supabase
      .from("accounts")
      .select("id, name, code, email, phone, website, address, notes, is_active")
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .order("name"),
    supabase
      .from("projects")
      .select("id, name, account_id")
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .not("account_id", "is", null),
    supabase
      .from("organization_members")
      .select("account_id")
      .eq("organization_id", orgId)
      .eq("member_type", "guest")
      .not("account_id", "is", null),
  ]);
  if (accountsRes.error) throw accountsRes.error;

  const projectsByAccount = new Map<string, { id: string; name: string }[]>();
  for (const p of projectsRes.data ?? []) {
    if (!p.account_id) continue;
    const list = projectsByAccount.get(p.account_id) ?? [];
    list.push({ id: p.id, name: p.name });
    projectsByAccount.set(p.account_id, list);
  }
  const contactsByAccount = new Map<string, number>();
  for (const g of guestsRes.data ?? []) {
    if (!g.account_id) continue;
    contactsByAccount.set(g.account_id, (contactsByAccount.get(g.account_id) ?? 0) + 1);
  }

  return (accountsRes.data ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    code: a.code,
    email: a.email,
    phone: a.phone,
    website: a.website,
    address: a.address,
    notes: a.notes,
    isActive: a.is_active,
    projects: projectsByAccount.get(a.id) ?? [],
    contactCount: contactsByAccount.get(a.id) ?? 0,
  }));
}

/** The system "guest" role — used when inviting a client contact to the portal. */
export async function getGuestRoleId() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("roles")
    .select("id")
    .eq("key", "org_guest")
    .is("organization_id", null)
    .maybeSingle();
  return data?.id ?? null;
}

export async function insertAccount(values: TablesInsert<"accounts">) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("accounts").insert(values).select("id").single();
  if (error) throw error;
  return data;
}

export async function updateAccountRow(id: string, patch: TablesUpdate<"accounts">) {
  const supabase = await createClient();
  const { error } = await supabase.from("accounts").update(patch).eq("id", id).is("deleted_at", null);
  if (error) throw error;
}

export async function softDeleteAccount(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("accounts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null);
  if (error) throw error;
}
