import "server-only";
import { prisma } from "@/lib/prisma";
import type { InvitationStatus, MemberType } from "@prisma/client";

/** Invitations for an org. */
export async function listInvitations(orgId: string) {
  const data = await prisma.invitation.findMany({
    where: {
      organizationId: orgId,
    },
    select: {
      id: true,
      email: true,
      memberType: true,
      status: true,
      expiresAt: true,
      token: true,
      createdAt: true,
      role: {
        select: {
          name: true,
        },
      },
      account: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return data.map((d) => ({
    id: d.id,
    email: d.email,
    member_type: d.memberType,
    status: d.status,
    expires_at: d.expiresAt.toISOString(),
    token: d.token,
    created_at: d.createdAt.toISOString(),
    role: d.role ? { name: d.role.name } : null,
    account: d.account ? { name: d.account.name } : null,
  }));
}

export type InvitationRow = Awaited<ReturnType<typeof listInvitations>>[number];

export async function insertInvitation(values: {
  id?: string;
  organization_id?: string;
  organizationId?: string;
  email: string;
  role_id?: string;
  roleId?: string;
  workspace_id?: string | null;
  workspaceId?: string | null;
  member_type?: MemberType | "member" | "guest";
  memberType?: MemberType | "member" | "guest";
  token: string;
  status?: InvitationStatus | "pending";
  expires_at?: string | Date;
  expiresAt?: string | Date;
  invited_by?: string | null;
  invitedBy?: string | null;
  account_id?: string | null;
  accountId?: string | null;
}) {
  await prisma.invitation.create({
    data: {
      id: values.id,
      organizationId: values.organizationId || values.organization_id!,
      email: values.email,
      roleId: values.roleId || values.role_id!,
      workspaceId: values.workspaceId !== undefined ? values.workspaceId : values.workspace_id,
      memberType: (values.memberType || values.member_type || "member") as MemberType,
      token: values.token,
      status: (values.status || "pending") as InvitationStatus,
      expiresAt: values.expiresAt ? new Date(values.expiresAt) : values.expires_at ? new Date(values.expires_at) : undefined,
      invitedBy: values.invitedBy || values.invited_by,
      accountId: values.accountId !== undefined ? values.accountId : values.account_id,
    },
  });
}

export async function revokeInvitationRow(id: string) {
  const data = await prisma.invitation.updateMany({
    where: {
      id,
      status: "pending",
    },
    data: {
      status: "revoked",
    },
  });
  if (data.count === 0) return null;
  return { id };
}

/* ------------------------------------------------------------------------- */
/*  Acceptance path                                                          */
/* ------------------------------------------------------------------------- */

export async function getInvitationByToken(token: string) {
  const data = await prisma.invitation.findUnique({
    where: { token },
    select: {
      id: true,
      organizationId: true,
      email: true,
      roleId: true,
      workspaceId: true,
      memberType: true,
      accountId: true,
      status: true,
      expiresAt: true,
      organization: {
        select: {
          name: true,
        },
      },
      role: {
        select: {
          name: true,
        },
      },
    },
  });
  if (!data) return null;

  return {
    id: data.id,
    organization_id: data.organizationId,
    email: data.email,
    role_id: data.roleId,
    workspace_id: data.workspaceId,
    member_type: data.memberType,
    account_id: data.accountId,
    status: data.status,
    expires_at: data.expiresAt.toISOString(),
    organization: data.organization ? { name: data.organization.name } : null,
    role: data.role ? { name: data.role.name } : null,
  };
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
  await prisma.$transaction(async (tx) => {
    await tx.organizationMember.upsert({
      where: {
        organizationId_userId: {
          organizationId: params.organizationId,
          userId: params.userId,
        },
      },
      update: {
        roleId: params.roleId,
        memberType: params.memberType as MemberType,
        accountId: params.accountId,
        status: "active",
      },
      create: {
        organizationId: params.organizationId,
        userId: params.userId,
        roleId: params.roleId,
        memberType: params.memberType as MemberType,
        accountId: params.accountId,
        status: "active",
        joinedAt: new Date(),
      },
    });

    await tx.invitation.update({
      where: { id: params.invitationId },
      data: {
        status: "accepted",
        acceptedBy: params.userId,
        acceptedAt: new Date(),
      },
    });
  });
}
