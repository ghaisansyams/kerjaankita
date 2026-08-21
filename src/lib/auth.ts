import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isDatabaseConfigured } from "@/lib/env";
import { ACTIVE_ORG_COOKIE, type PermissionKey } from "@/constants";
import type {
  Profile as PrismaProfile,
  Organization as PrismaOrganization,
  OrganizationMember as PrismaOrganizationMember,
  Role as PrismaRole,
} from "@prisma/client";

export type Profile = PrismaProfile & {
  full_name: string | null;
  avatar_url: string | null;
};

export type Organization = PrismaOrganization & {
  logo_url: string | null;
};

export type Membership = PrismaOrganizationMember;
export type Role = PrismaRole;

/** A membership joined with its organization and role. */
export type MembershipWithOrg = Membership & {
  organization: Organization | null;
  role: Role | null;
};

/**
 * Everything the app needs to render for the *active* organization:
 * who you are, which tenant you're in, and what you may do.
 */
export type OrgContext = {
  profile: Profile;
  organization: Organization;
  membership: Membership;
  role: Role | null;
  /** Organization-scoped permission keys. */
  permissions: Set<string>;
  isGuest: boolean;
};

/* -------------------------------------------------------------------------- */
/*  Identity                                                                  */
/* -------------------------------------------------------------------------- */

export type AuthUser = {
  id: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
};

export const getUser = cache(async (): Promise<AuthUser | null> => {
  if (!isDatabaseConfigured) return null;
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    image: session.user.image,
  };
});

export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getUser();
  if (!user) return null;
  const profile = await prisma.profile.findFirst({
    where: {
      id: user.id,
      deletedAt: null,
    },
  });
  if (!profile) return null;
  return {
    ...profile,
    full_name: profile.fullName,
    avatar_url: profile.avatarUrl,
  };
});

export async function requireProfile(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  return profile;
}

/* -------------------------------------------------------------------------- */
/*  Tenancy                                                                   */
/* -------------------------------------------------------------------------- */

/** Every organization the signed-in user belongs to (drives the org switcher). */
export const getMemberships = cache(async (): Promise<MembershipWithOrg[]> => {
  const user = await getUser();
  if (!user) return [];
  const list = await prisma.organizationMember.findMany({
    where: {
      userId: user.id,
      status: "active",
      deletedAt: null,
    },
    include: {
      organization: true,
      role: true,
    },
  });
  return list.map((m) => ({
    ...m,
    organization: m.organization
      ? {
          ...m.organization,
          logo_url: m.organization.logoUrl,
        }
      : null,
  }));
});

/**
 * Resolve the active organization: the cookie if it names an organization the
 * user actually belongs to, otherwise their first membership. Falling back
 * rather than erroring means a stale cookie can never lock a user out.
 */
export const getOrgContext = cache(async (): Promise<OrgContext | null> => {
  const profile = await getProfile();
  if (!profile) return null;

  const memberships = await getMemberships();
  if (memberships.length === 0) return null;

  const cookieStore = await cookies();
  const preferred = cookieStore.get(ACTIVE_ORG_COOKIE)?.value;

  const membership =
    memberships.find((m) => m.organizationId === preferred) ?? memberships[0];
  if (!membership.organization) return null;

  let permissions = new Set<string>();
  if (membership.roleId) {
    const perms = await prisma.rolePermission.findMany({
      where: {
        roleId: membership.roleId,
      },
      include: {
        permission: true,
      },
    });

    permissions = new Set<string>(
      perms.map((p) => p.permission.key).filter(Boolean),
    );
  }

  return {
    profile,
    organization: membership.organization,
    membership,
    role: membership.role,
    permissions,
    isGuest: membership.memberType === "guest",
  };
});

export async function requireOrgContext(): Promise<OrgContext> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  const ctx = await getOrgContext();
  // Signed in but not a member of any organization → onboarding.
  if (!ctx) redirect("/onboarding");
  return ctx;
}

/* -------------------------------------------------------------------------- */
/*  Authorization                                                             */
/* -------------------------------------------------------------------------- */

export function can(ctx: OrgContext, permission: PermissionKey): boolean {
  return ctx.permissions.has(permission);
}

/**
 * Route guard. Redirects rather than throwing so navigation stays smooth.
 */
export async function requirePermission(
  permission: PermissionKey,
): Promise<OrgContext> {
  const ctx = await requireOrgContext();
  if (!can(ctx, permission)) redirect("/dashboard");
  return ctx;
}

/** Guests are external collaborators — block them from internal-only screens. */
export async function requireInternal(): Promise<OrgContext> {
  const ctx = await requireOrgContext();
  if (ctx.isGuest) redirect("/dashboard");
  return ctx;
}
