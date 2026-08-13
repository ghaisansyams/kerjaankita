"use server";

import { revalidatePath } from "next/cache";
import { getUser, requireOrgContext } from "@/lib/auth";
import { PERMISSIONS } from "@/constants";
import { checkPermission } from "@/repositories/permission.repository";
import * as inviteRepo from "@/repositories/invitation.repository";
import { logActivity } from "@/repositories/activity.repository";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  acceptInvitationSchema,
  createInvitationSchema,
  createMemberAccountSchema,
  revokeInvitationSchema,
} from "@/schemas/invitation.schema";
import { mapUnknownError } from "@/lib/errors";
import { toFieldErrors } from "@/lib/validation";
import { actionError, actionOk, type ActionResult } from "@/types/action";

export async function createInvitation(
  input: unknown,
): Promise<ActionResult<{ token: string }>> {
  const ctx = await requireOrgContext();
  const parsed = createInvitationSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("VALIDATION", "Please check the form.", toFieldErrors(parsed.error));
  }
  const d = parsed.data;
  if (!(await checkPermission(ctx.organization.id, PERMISSIONS.ORG_MEMBER_MANAGE))) {
    return actionError("FORBIDDEN", "You can't invite people to this organization.");
  }
  try {
    const token = crypto.randomUUID();
    await inviteRepo.insertInvitation({
      organization_id: ctx.organization.id,
      email: d.email,
      role_id: d.roleId,
      workspace_id: d.workspaceId ?? null,
      member_type: d.memberType,
      account_id: d.memberType === "guest" ? (d.accountId ?? null) : null,
      token,
      invited_by: ctx.profile.id,
    });
    await logActivity({
      organizationId: ctx.organization.id,
      projectId: null,
      entity: "organization",
      entityId: ctx.organization.id,
      action: "invitation.created",
      metadata: { email: d.email, member_type: d.memberType },
    });
    revalidatePath("/settings/workspace");
    return actionOk({ token });
  } catch (e) {
    return mapUnknownError(e);
  }
}

export async function revokeInvitation(input: unknown): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  const parsed = revokeInvitationSchema.safeParse(input);
  if (!parsed.success) return actionError("VALIDATION", "Invalid request.");
  if (!(await checkPermission(ctx.organization.id, PERMISSIONS.ORG_MEMBER_MANAGE))) {
    return actionError("FORBIDDEN", "You can't manage invitations.");
  }
  try {
    const revoked = await inviteRepo.revokeInvitationRow(parsed.data.id);
    if (!revoked) return actionError("NOT_FOUND", "That invitation is no longer pending.");
    await logActivity({
      organizationId: ctx.organization.id,
      projectId: null,
      entity: "organization",
      entityId: ctx.organization.id,
      action: "invitation.revoked",
      metadata: { id: parsed.data.id },
    });
    revalidatePath("/settings/workspace");
    return actionOk(undefined);
  } catch (e) {
    return mapUnknownError(e);
  }
}

/**
 * Accept an invitation as the signed-in user. Validates the token, expiry and
 * (if present) that the email matches, then creates the membership via the
 * service-role path (the invitee isn't a member yet, so RLS can't see the row).
 */
export async function acceptInvitation(
  input: unknown,
): Promise<ActionResult<{ organizationId: string; isGuest: boolean }>> {
  const parsed = acceptInvitationSchema.safeParse(input);
  if (!parsed.success) return actionError("VALIDATION", "Invalid invitation.");

  const user = await getUser();
  if (!user) return actionError("UNAUTHENTICATED", "Please sign in to accept this invitation.");

  try {
    const invite = await inviteRepo.getInvitationByToken(parsed.data.token);
    if (!invite || invite.status === "revoked") {
      return actionError("NOT_FOUND", "This invitation is no longer valid.");
    }
    if (invite.status === "accepted") {
      return actionOk({ organizationId: invite.organization_id, isGuest: invite.member_type === "guest" });
    }
    if (new Date(invite.expires_at) < new Date()) {
      return actionError("NOT_FOUND", "This invitation has expired. Please ask for a new link.");
    }
    if (invite.email && user.email && invite.email.toLowerCase() !== user.email.toLowerCase()) {
      return actionError("FORBIDDEN", "This invitation was sent to a different email address.");
    }

    await inviteRepo.acceptInvitationTx({
      invitationId: invite.id,
      organizationId: invite.organization_id,
      userId: user.id,
      roleId: invite.role_id,
      memberType: invite.member_type,
      accountId: invite.account_id,
    });
    await logActivity({
      organizationId: invite.organization_id,
      projectId: null,
      entity: "organization",
      entityId: invite.organization_id,
      action: invite.member_type === "guest" ? "guest.joined" : "member.joined",
      metadata: { email: invite.email },
    });
    return actionOk({
      organizationId: invite.organization_id,
      isGuest: invite.member_type === "guest",
    });
  } catch (e) {
    return mapUnknownError(e);
  }
}

/**
 * Create a workspace account directly, instead of issuing a link the person has
 * to redeem.
 *
 * The invitation flow can't serve every case: this project has email
 * confirmation switched on and sends no mail of its own, so an invite only
 * works when the recipient can open that inbox — which is exactly what fails
 * for a colleague whose company address isn't live yet. Here the address is
 * confirmed on their behalf and the membership is written in the same action,
 * so the account works on first sign-in.
 */
export async function createMemberAccount(
  input: unknown,
): Promise<ActionResult<{ email: string }>> {
  const ctx = await requireOrgContext();
  const parsed = createMemberAccountSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("VALIDATION", "Please check the form.", toFieldErrors(parsed.error));
  }
  if (!(await checkPermission(ctx.organization.id, PERMISSIONS.ORG_MEMBER_MANAGE))) {
    return actionError("FORBIDDEN", "You can't add people to this workspace.");
  }
  const d = parsed.data;

  const admin = createAdminClient();
  const created = await admin.auth.admin.createUser({
    email: d.email,
    password: d.password,
    email_confirm: true, // no inbox round-trip; an admin is vouching for them
    user_metadata: { full_name: d.fullName },
  });
  if (created.error || !created.data.user) {
    const exists = /already|exists|registered/i.test(created.error?.message ?? "");
    return actionError(
      exists ? "VALIDATION" : "INTERNAL",
      exists
        ? "An account with that email already exists — send them an invite link instead."
        : (created.error?.message ?? "Couldn't create the account."),
    );
  }
  const userId = created.data.user.id;

  try {
    const { error: memberError } = await admin.from("organization_members").upsert(
      {
        organization_id: ctx.organization.id,
        user_id: userId,
        role_id: d.roleId,
        member_type: d.memberType,
        account_id: d.memberType === "guest" ? (d.accountId ?? null) : null,
        status: "active",
        joined_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,user_id" },
    );
    // A confirmed login with no membership strands the person on onboarding,
    // where they'd create their own empty organization. Undo rather than
    // half-finish.
    if (memberError) {
      await admin.auth.admin.deleteUser(userId);
      throw memberError;
    }

    await logActivity({
      organizationId: ctx.organization.id,
      projectId: null,
      entity: "organization",
      entityId: ctx.organization.id,
      action: d.memberType === "guest" ? "guest.joined" : "member.joined",
      metadata: { email: d.email, created_by_admin: true },
    });
    revalidatePath("/settings/workspace");
    return actionOk({ email: d.email });
  } catch (e) {
    return mapUnknownError(e);
  }
}
