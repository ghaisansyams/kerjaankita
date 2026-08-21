import { redirect } from "next/navigation";
import { isDatabaseConfigured } from "@/lib/env";
import { getMemberships, requireOrgContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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
  if (!isDatabaseConfigured) redirect("/");

  const ctx = await requireOrgContext();
  // Guests live in the read-only portal, never the internal shell.
  if (ctx.isGuest) redirect("/portal");
  const memberships = await getMemberships();

  const count = await prisma.notification.count({
    where: {
      userId: ctx.profile.id,
      isRead: false,
    },
  });

  const shellCtx: ShellContext = {
    user: {
      id: ctx.profile.id,
      name: ctx.profile.fullName ?? ctx.profile.email ?? "User",
      email: ctx.profile.email ?? "",
      avatarUrl: ctx.profile.avatarUrl,
    },
    org: {
      id: ctx.organization.id,
      name: ctx.organization.name,
      slug: ctx.organization.slug,
      logoUrl: ctx.organization.logoUrl,
    },
    orgs: memberships
      .filter((m) => m.organization)
      .map((m) => ({
        id: m.organization!.id,
        name: m.organization!.name,
        slug: m.organization!.slug,
        logoUrl: m.organization!.logoUrl,
      })),
    roleName: ctx.role?.name ?? "Member",
    isGuest: ctx.isGuest,
    permissions: Array.from(ctx.permissions),
  };

  return (
    <AppShell ctx={shellCtx} initialUnread={count}>
      {children}
    </AppShell>
  );
}
