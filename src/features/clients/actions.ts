"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/lib/auth";
import { PERMISSIONS } from "@/constants";
import { checkPermission } from "@/repositories/permission.repository";
import * as accountRepo from "@/repositories/account.repository";
import * as inviteRepo from "@/repositories/invitation.repository";
import { logActivity } from "@/repositories/activity.repository";
import {
  createAccountSchema,
  updateAccountSchema,
  deleteAccountSchema,
  inviteContactSchema,
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
