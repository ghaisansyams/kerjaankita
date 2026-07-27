import Link from "next/link";
import { requireOrgContext } from "@/lib/auth";
import { signOut } from "@/features/auth/actions";
import { getInitials } from "@/utils/format";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * Read-only client portal shell. Deliberately minimal — no internal nav, no
 * mutating controls. Data isolation is enforced by RLS (guests only ever see
 * projects/files/updates explicitly shared with their account).
 */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireOrgContext();

  return (
    <div className="min-h-dvh bg-muted/20">
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Link href="/portal" className="flex items-center gap-2 font-semibold">
            <span className="grid size-7 place-items-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
              {getInitials(ctx.organization.name)}
            </span>
            <span className="truncate">{ctx.organization.name}</span>
          </Link>
          <span className="hidden rounded-full border px-2 py-0.5 text-xs text-muted-foreground sm:inline">
            Client portal · read-only
          </span>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {ctx.profile.full_name ?? ctx.profile.email}
            </span>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
