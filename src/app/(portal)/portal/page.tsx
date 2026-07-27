import type { Metadata } from "next";
import Link from "next/link";
import { requireOrgContext } from "@/lib/auth";
import { listProjects } from "@/repositories/project.repository";
import { ProgressRing } from "@/components/domain/progress-ring";

export const metadata: Metadata = { title: "Shared with you" };

export default async function PortalHomePage() {
  const ctx = await requireOrgContext();
  // RLS returns only projects shared with this guest's account.
  const projects = await listProjects(ctx.organization.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Shared with you</h1>
        <p className="text-sm text-muted-foreground">Projects your delivery team is working on.</p>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-sm text-muted-foreground">
          Nothing has been shared with you yet.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/portal/projects/${p.id}`}
              className="flex items-center gap-4 rounded-xl border bg-card p-4 transition-colors hover:border-primary/40"
            >
              <ProgressRing value={p.progress} size={44} strokeWidth={5} />
              <div className="min-w-0">
                <p className="truncate font-medium">{p.name}</p>
                {p.account?.name && (
                  <p className="truncate text-xs text-muted-foreground">{p.account.name}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
