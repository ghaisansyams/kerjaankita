import "server-only";
import { prisma } from "@/lib/prisma";

/** Active internal members of the org, for owner/assignee pickers. */
export async function listOrgMemberProfiles(orgId: string) {
  const data = await prisma.organizationMember.findMany({
    where: {
      organizationId: orgId,
      status: "active",
      memberType: "member",
      deletedAt: null,
    },
    select: {
      userId: true,
      user: {
        select: {
          id: true,
          fullName: true,
          avatarUrl: true,
          email: true,
        },
      },
    },
  });

  return data
    .map((m) => m.user ? {
      id: m.user.id,
      full_name: m.user.fullName,
      avatar_url: m.user.avatarUrl,
      email: m.user.email,
    } : null)
    .filter((p): p is NonNullable<typeof p> => Boolean(p));
}

export type MemberProfile = Awaited<
  ReturnType<typeof listOrgMemberProfiles>
>[number];

/** Active guests of the org with their client account (for guest management). */
export async function listGuests(orgId: string) {
  const data = await prisma.organizationMember.findMany({
    where: {
      organizationId: orgId,
      memberType: "guest",
      deletedAt: null,
    },
    select: {
      userId: true,
      status: true,
      joinedAt: true,
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          avatarUrl: true,
        },
      },
      account: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return data.map((d) => ({
    user_id: d.userId,
    status: d.status,
    joined_at: d.joinedAt ? d.joinedAt.toISOString() : null,
    profile: d.user ? {
      id: d.user.id,
      full_name: d.user.fullName,
      email: d.user.email,
      avatar_url: d.user.avatarUrl,
    } : null,
    account: d.account ? {
      id: d.account.id,
      name: d.account.name,
    } : null,
  }));
}

export type GuestRow = Awaited<ReturnType<typeof listGuests>>[number];
