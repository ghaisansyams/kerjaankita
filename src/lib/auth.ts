import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { ACTIVE_ORG_COOKIE, type PermissionKey } from "@/constants";
import type { Tables } from "@/types/database.types";

export type Profile = Tables<"profiles">;
export type Organization = Tables<"organizations">;
export type Membership = Tables<"organization_members">;
export type Role = Tables<"roles">;

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
  /** Organization-scoped permission keys. Workspace/project-scoped rights are
   *  resolved in the database by has_permission() at query time. */
  permissions: Set<string>;
  isGuest: boolean;
};

/* -------------------------------------------------------------------------- */
/*  Identity                                                                  */
/* -------------------------------------------------------------------------- */

export const getUser = cache(async () => {
  // Before Supabase is connected, don't construct a client (it would throw).
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .is("deleted_at", null)
    .single();
  return data ?? null;
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
  const supabase = await createClient();
  const { data } = await supabase
    .from("organization_members")
    .select("*, organization:organizations(*), role:roles(*)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .is("deleted_at", null);
  return (data as MembershipWithOrg[] | null) ?? [];
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
    memberships.find((m) => m.organization_id === preferred) ?? memberships[0];
  if (!membership.organization) return null;

  const supabase = await createClient();
  const { data: perms } = await supabase
    .from("role_permissions")
    .select("permission:permissions(key)")
    .eq("role_id", membership.role_id);

  const permissions = new Set<string>(
    (perms ?? [])
      .map((p) => p.permission?.key)
      .filter((k): k is string => Boolean(k)),
  );

  return {
    profile,
    organization: membership.organization,
    membership,
    role: membership.role,
    permissions,
    isGuest: membership.member_type === "guest",
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
 * This is a UX layer — RLS remains the actual enforcement boundary.
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
