"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FolderKanban, Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/data/empty-state";
import { ProjectCard, type ProjectCardVM } from "@/components/domain/project-card";
import {
  ProjectForm,
  type MemberOption,
  type PickerOption,
} from "./project-form";

export function ProjectsView({
  projects,
  workspaces,
  accounts,
  members,
  defaultWorkspaceId,
  canCreate,
}: {
  projects: ProjectCardVM[];
  workspaces: PickerOption[];
  accounts: PickerOption[];
  members: MemberOption[];
  defaultWorkspaceId: string;
  canCreate: boolean;
}) {
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  // The command palette deep-links here with ?new=1 to open the create dialog.
  const searchParams = useSearchParams();
  useEffect(() => {
    if (canCreate && searchParams.get("new") === "1") setCreateOpen(true);
  }, [searchParams, canCreate]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.key?.toLowerCase().includes(q) ||
        p.accountName?.toLowerCase().includes(q),
    );
  }, [projects, search]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects…"
            aria-label="Search projects"
            className="pl-8"
          />
        </div>
        {canCreate && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            New project
          </Button>
        )}
      </div>

      {projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description="Create your first project to start organizing work, tracking progress, and keeping clients in the loop."
          action={
            canCreate ? (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" />
                New project
              </Button>
            ) : undefined
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No projects match"
          description="Try a different search term."
          action={
            <Button variant="outline" onClick={() => setSearch("")}>
              Clear search
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}

      {canCreate && (
        <ProjectForm
          open={createOpen}
          onOpenChange={setCreateOpen}
          mode="create"
          workspaces={workspaces}
          accounts={accounts}
          members={members}
          defaultWorkspaceId={defaultWorkspaceId}
        />
      )}
    </div>
  );
}
