import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Active internal members of the org, for owner/assignee pickers. */
export async function listOrgMemberProfiles(orgId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organization_members")
    .select(
      "user_id, member_type, profile:profiles!organization_members_user_id_fkey(id, full_name, avatar_url, email)",
    )
    .eq("organization_id", orgId)
    .eq("status", "active")
    .eq("member_type", "member")
    .is("deleted_at", null);
  if (error) throw error;
  return (data ?? [])
    .map((m) => m.profile)
    .filter((p): p is NonNullable<typeof p> => Boolean(p));
}

export type MemberProfile = Awaited<
  ReturnType<typeof listOrgMemberProfiles>
>[number];

/** Active guests of the org with their client account (for guest management). */
export async function listGuests(orgId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organization_members")
    .select(
      `user_id, status, joined_at,
       profile:profiles!organization_members_user_id_fkey(id, full_name, email, avatar_url),
       account:accounts(id, name)`,
    )
    .eq("organization_id", orgId)
    .eq("member_type", "guest")
    .is("deleted_at", null);
  if (error) throw error;
  return data ?? [];
}

export type GuestRow = Awaited<ReturnType<typeof listGuests>>[number];
