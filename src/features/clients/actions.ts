"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/lib/auth";
import { PERMISSIONS } from "@/constants";
import { checkPermission } from "@/repositories/permission.repository";
import * as accountRepo from "@/repositories/account.repository";
import * as inviteRepo from "@/repositories/invitation.repository";
import { logActivity } from "@/repositories/activity.repository";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
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
    const row = await accountRepo.insertAccount({
      organizationId: ctx.organization.id,
      name: d.name,
      code: orNull(d.code),
      email: orNull(d.email),
      phone: orNull(d.phone),
      website: orNull(d.website),
      address: orNull(d.address),
      notes: orNull(d.notes),
      createdBy: ctx.profile.id,
    });
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
      updatedBy: ctx.profile.id,
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
      organizationId: ctx.organization.id,
      email: d.email,
      roleId,
      workspaceId: null,
      memberType: "guest",
      accountId: d.accountId,
      token,
      invitedBy: ctx.profile.id,
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
 * Create a portal login for a client outright.
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
  const email = d.email.toLowerCase().trim();

  try {
    const roleId = await accountRepo.getGuestRoleId();
    if (!roleId) return actionError("INTERNAL", "The guest role isn't configured for this organization.");

    const existing = await prisma.profile.findFirst({
      where: { email: { equals: email, mode: "insensitive" }, deletedAt: null },
    });
    if (existing) {
      return actionError(
        "VALIDATION",
        "An account with that email already exists — send them an invite link instead.",
      );
    }

    const passwordHash = await bcrypt.hash(d.password, 10);
    const userId = crypto.randomUUID();

    await prisma.$transaction(async (tx) => {
      await tx.profile.create({
        data: {
          id: userId,
          email,
          fullName: d.fullName,
          passwordHash,
          isActive: true,
        },
      });

      await tx.organizationMember.create({
        data: {
          organizationId: ctx.organization.id,
          userId,
          roleId,
          memberType: "guest",
          accountId: d.accountId,
          status: "active",
          joinedAt: new Date(),
        },
      });
    });

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
