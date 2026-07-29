"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, FileText, MapPin, Plus, Search, User } from "lucide-react";
import { formatDate } from "@/utils/format";
import type { MomListItem } from "@/repositories/mom.repository";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Options = {
  projects: { id: string; name: string }[];
  members: { id: string; name: string }[];
  workspaces: { id: string; name: string }[];
};
const ALL = "__all__";

export function MomList({
  moms,
  options,
  canCreate,
  projectId,
}: {
  moms: MomListItem[];
  options: Options;
  canCreate: boolean;
  /** When rendered inside a project tab, the project filter is hidden and New prefills it. */
  projectId?: string;
}) {
  const [search, setSearch] = useState("");
  const [project, setProject] = useState(ALL);
  const [pic, setPic] = useState(ALL);
  const [workspace, setWorkspace] = useState(ALL);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filtered = useMemo(() => {
    return moms.filter((m) => {
      if (search && !m.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (!projectId && project !== ALL && m.projectId !== project) return false;
      if (!projectId && workspace !== ALL && m.workspaceId !== workspace) return false;
      if (pic !== ALL && m.picId !== pic) return false;
      if (from && m.meetingDate < from) return false;
      if (to && m.meetingDate > to) return false;
      return true;
    });
  }, [moms, search, project, workspace, pic, from, to, projectId]);

  const newHref = projectId ? `/mom/new?project=${projectId}` : "/mom/new";

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search meeting title…" className="pl-8" />
        </div>
        {!projectId && (
          <Select value={project} onValueChange={setProject}>
            <SelectTrigger className="w-[170px]"><SelectValue placeholder="Project" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All projects</SelectItem>
              {options.projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Select value={pic} onValueChange={setPic}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="PIC" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All PICs</SelectItem>
            {options.members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {!projectId && options.workspaces.length > 1 && (
          <Select value={workspace} onValueChange={setWorkspace}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Workspace" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All workspaces</SelectItem>
              {options.workspaces.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[150px]" aria-label="From date" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[150px]" aria-label="To date" />
        {canCreate && (
          <Button asChild size="sm" className="ml-auto">
            <Link href={newHref}><Plus className="size-4" /> New MOM</Link>
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <FileText className="size-8 text-muted-foreground/40" />
          <div>
            <p className="font-medium">No meeting minutes yet</p>
            <p className="text-sm text-muted-foreground">Document a meeting and it&apos;s stored here, linked to its project.</p>
          </div>
          {canCreate && <Button asChild size="sm" variant="outline"><Link href={newHref}><Plus className="size-4" /> New MOM</Link></Button>}
        </Card>
      ) : (
        <ul className="space-y-2">
          {filtered.map((m) => (
            <li key={m.id}>
              <Link href={`/mom/${m.id}`} className="block rounded-xl border bg-card p-4 transition-colors hover:border-primary/40">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{m.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <span className="size-2 rounded-full" style={{ backgroundColor: m.projectColor ?? "#94a3b8" }} />
                        {m.projectName}
                      </span>
                      <span className="inline-flex items-center gap-1"><CalendarDays className="size-3.5" /> {formatDate(m.meetingDate)}{m.meetingTime ? ` · ${m.meetingTime}` : ""}</span>
                      {m.location && <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" /> {m.location}</span>}
                      {m.picName && <span className="inline-flex items-center gap-1"><User className="size-3.5" /> {m.picName}</span>}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
                    {m.noteCount} point{m.noteCount === 1 ? "" : "s"}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
