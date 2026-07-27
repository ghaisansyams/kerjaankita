import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { getMemberships, requireOrgContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/features/shell/components/app-shell";
import type { ShellContext } from "@/features/shell/types";

/**
 * Protected, tenant-scoped shell. Resolves the active organization and the
 * caller's permissions once, then hands a plain-serialisable context to the
 * client shell. Unauthenticated → /login; no organization yet → /onboarding.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isSupabaseConfigured) redirect("/");

  const ctx = await requireOrgContext();
  // Guests live in the read-only portal, never the internal shell.
  if (ctx.isGuest) redirect("/portal");
  const memberships = await getMemberships();

  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", ctx.organization.id)
    .eq("is_read", false);

  const shellCtx: ShellContext = {
    user: {
      id: ctx.profile.id,
      name: ctx.profile.full_name ?? ctx.profile.email ?? "User",
      email: ctx.profile.email ?? "",
      avatarUrl: ctx.profile.avatar_url,
    },
    org: {
      id: ctx.organization.id,
      name: ctx.organization.name,
      slug: ctx.organization.slug,
      logoUrl: ctx.organization.logo_url,
    },
    orgs: memberships
      .filter((m) => m.organization)
      .map((m) => ({
        id: m.organization!.id,
        name: m.organization!.name,
        slug: m.organization!.slug,
        logoUrl: m.organization!.logo_url,
      })),
    roleName: ctx.role?.name ?? "Member",
    isGuest: ctx.isGuest,
    permissions: Array.from(ctx.permissions),
  };

  return (
    <AppShell ctx={shellCtx} initialUnread={count ?? 0}>
      {children}
    </AppShell>
  );
}
