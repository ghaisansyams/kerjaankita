"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/lib/auth";
import { PERMISSIONS } from "@/constants";
import { checkPermission } from "@/repositories/permission.repository";
import * as accountRepo from "@/repositories/account.repository";
import { createAdminClient } from "@/lib/supabase/admin";
import * as inviteRepo from "@/repositories/invitation.repository";
import { logActivity } from "@/repositories/activity.repository";
import {
  createAccountSchema,
  updateAccountSchema,
  deleteAccountSchema,
  inviteContactSchema,
  createPortalUserSchema,
} from "@/schemas/account.schema";
import { mapUnknownError } from "@/lib/errors";
import { toFieldErrors } from "@/lib/validation";
import { actionError, actionOk, type ActionResult } from "@/types/action";
import type { TablesInsert } from "@/types/database.types";

const orNull = (v?: string) => {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
};

export async function createClientAccount(input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireOrgContext();
  const parsed = createAccountSchema.safeParse(input);
  if (!parsed.success) return actionError("VALIDATION", "Please check the form.", toFieldErrors(parsed.error));
  if (!(await checkPermission(ctx.organization.id, PERMISSIONS.ACCOUNT_MANAGE)))
    return actionError("FORBIDDEN", "You can't manage clients.");
  const d = parsed.data;
  try {
    const values: TablesInsert<"accounts"> = {
      organization_id: ctx.organization.id,
      name: d.name,
      code: orNull(d.code),
      email: orNull(d.email),
      phone: orNull(d.phone),
      website: orNull(d.website),
      address: orNull(d.address),
      notes: orNull(d.notes),
      created_by: ctx.profile.id,
    };
    const row = await accountRepo.insertAccount(values);
    revalidatePath("/clients");
    return actionOk({ id: row.id });
  } catch (e) {
    return mapUnknownError(e);
  }
}

export async function updateClientAccount(input: unknown): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  const parsed = updateAccountSchema.safeParse(input);
  if (!parsed.success) return actionError("VALIDATION", "Please check the form.", toFieldErrors(parsed.error));
  if (!(await checkPermission(ctx.organization.id, PERMISSIONS.ACCOUNT_MANAGE)))
    return actionError("FORBIDDEN", "You can't manage clients.");
  const d = parsed.data;
  try {
    await accountRepo.updateAccountRow(d.id, {
      name: d.name,
      code: orNull(d.code),
      email: orNull(d.email),
      phone: orNull(d.phone),
      website: orNull(d.website),
      address: orNull(d.address),
      notes: orNull(d.notes),
      updated_by: ctx.profile.id,
    });
    revalidatePath("/clients");
    return actionOk(undefined);
  } catch (e) {
    return mapUnknownError(e);
  }
}

export async function deleteClientAccount(input: unknown): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  const parsed = deleteAccountSchema.safeParse(input);
  if (!parsed.success) return actionError("VALIDATION", "Invalid request.");
  if (!(await checkPermission(ctx.organization.id, PERMISSIONS.ACCOUNT_MANAGE)))
    return actionError("FORBIDDEN", "You can't manage clients.");
  try {
    await accountRepo.softDeleteAccount(parsed.data.id);
    revalidatePath("/clients");
    return actionOk(undefined);
  } catch (e) {
    return mapUnknownError(e);
  }
}

/** Invite a client contact to the read-only portal (a guest tied to the account). */
export async function inviteClientContact(input: unknown): Promise<ActionResult<{ token: string }>> {
  const ctx = await requireOrgContext();
  const parsed = inviteContactSchema.safeParse(input);
  if (!parsed.success) return actionError("VALIDATION", "Please check the form.", toFieldErrors(parsed.error));
  if (!(await checkPermission(ctx.organization.id, PERMISSIONS.ORG_MEMBER_MANAGE)))
    return actionError("FORBIDDEN", "You can't invite portal users.");
  const d = parsed.data;
  try {
    const roleId = await accountRepo.getGuestRoleId();
    if (!roleId) return actionError("INTERNAL", "The guest role isn't configured for this organization.");
    const token = crypto.randomUUID();
    await inviteRepo.insertInvitation({
      organization_id: ctx.organization.id,
      email: d.email,
      role_id: roleId,
      workspace_id: null,
      member_type: "guest",
      account_id: d.accountId,
      token,
      invited_by: ctx.profile.id,
    });
    await logActivity({
      organizationId: ctx.organization.id,
      projectId: null,
      entity: "organization",
      entityId: ctx.organization.id,
      action: "invitation.created",
      metadata: { email: d.email, member_type: "guest" },
    });
    revalidatePath("/clients");
    return actionOk({ token });
  } catch (e) {
    return mapUnknownError(e);
  }
}


/**
 * Create a portal login for a client outright, instead of mailing an invite the
 * client has to redeem themselves.
 *
 * Self-service sign-up can't serve this case: Supabase requires email
 * confirmation, so the account stays unusable until someone opens that inbox,
 * and a fresh user with no membership is bounced to onboarding — where a client
 * would create their own empty organization. Both are sidestepped here by
 * confirming the address and writing the guest membership in one go.
 */
export async function createPortalUser(
  input: unknown,
): Promise<ActionResult<{ email: string }>> {
  const ctx = await requireOrgContext();
  const parsed = createPortalUserSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("VALIDATION", "Please check the form.", toFieldErrors(parsed.error));
  }
  if (!(await checkPermission(ctx.organization.id, PERMISSIONS.ORG_MEMBER_MANAGE)))
    return actionError("FORBIDDEN", "You can't create portal users.");

  const d = parsed.data;
  try {
    const roleId = await accountRepo.getGuestRoleId();
    if (!roleId) return actionError("INTERNAL", "The guest role isn't configured for this organization.");

    const admin = createAdminClient();
    const created = await admin.auth.admin.createUser({
      email: d.email,
      password: d.password,
      email_confirm: true, // no inbox round-trip; the admin is vouching for them
      user_metadata: { full_name: d.fullName },
    });
    if (created.error || !created.data.user) {
      const already = /already|exists|registered/i.test(created.error?.message ?? "");
      return actionError(
        already ? "VALIDATION" : "INTERNAL",
        already
          ? "An account with that email already exists — send them an invite link instead."
          : (created.error?.message ?? "Couldn't create the account."),
      );
    }

    const { error: memberError } = await admin.from("organization_members").upsert(
      {
        organization_id: ctx.organization.id,
        user_id: created.data.user.id,
        role_id: roleId,
        member_type: "guest",
        account_id: d.accountId,
        status: "active",
        joined_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,user_id" },
    );
    // Leaving a confirmed login with no membership would strand them on
    // onboarding, so undo the user rather than half-finish.
    if (memberError) {
      await admin.auth.admin.deleteUser(created.data.user.id);
      throw memberError;
    }

    await logActivity({
      organizationId: ctx.organization.id,
      projectId: null,
      entity: "organization",
      entityId: ctx.organization.id,
      action: "guest.joined",
      metadata: { email: d.email, created_by_admin: true },
    });
    revalidatePath("/clients");
    return actionOk({ email: d.email });
  } catch (e) {
    return mapUnknownError(e);
  }
}
