import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TablesInsert } from "@/types/database.types";

/** Invitations for an org (RLS-scoped: only managers can read them). */
export async function listInvitations(orgId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invitations")
    .select(
      `id, email, member_type, status, expires_at, token, created_at,
       role:roles(name), workspace:workspaces(name), account:accounts(name)`,
    )
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export type InvitationRow = Awaited<ReturnType<typeof listInvitations>>[number];

export async function insertInvitation(values: TablesInsert<"invitations">) {
  const supabase = await createClient();
  const { error } = await supabase.from("invitations").insert(values);
  if (error) throw error;
}

export async function revokeInvitationRow(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invitations")
    .update({ status: "revoked" })
    .eq("id", id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return data;
}

/* ------------------------------------------------------------------------- */
/*  Acceptance path — the invitee is not yet a member, so RLS can't see the    */
/*  invitation. These use the service-role client and validate explicitly.     */
/* ------------------------------------------------------------------------- */

export async function getInvitationByToken(token: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("invitations")
    .select(
      `id, organization_id, email, role_id, workspace_id, member_type, account_id, status, expires_at,
       organization:organizations(name), role:roles(name)`,
    )
    .eq("token", token)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Create the membership (idempotent) and mark the invite accepted. */
export async function acceptInvitationTx(params: {
  invitationId: string;
  organizationId: string;
  userId: string;
  roleId: string;
  memberType: "member" | "guest";
  accountId: string | null;
}) {
  const admin = createAdminClient();
  const { error: memberError } = await admin.from("organization_members").upsert(
    {
      organization_id: params.organizationId,
      user_id: params.userId,
      role_id: params.roleId,
      member_type: params.memberType,
      account_id: params.accountId,
      status: "active",
      joined_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,user_id" },
  );
  if (memberError) throw memberError;

  const { error: inviteError } = await admin
    .from("invitations")
    .update({ status: "accepted", accepted_by: params.userId, accepted_at: new Date().toISOString() })
    .eq("id", params.invitationId);
  if (inviteError) throw inviteError;
}
