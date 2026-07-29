"use client";

import { useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Download, FileText, Flag } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDate, formatRelative, getInitials, toDate } from "@/utils/format";
import { humanizeActivity } from "@/utils/humanize-activity";
import { PROJECT_HEALTH_BADGE, PROJECT_HEALTH_LABELS, type ProjectHealth, type StatusCategory } from "@/constants";
import { getDownloadUrl } from "@/features/attachments/actions";
import { ProgressRing } from "@/components/domain/progress-ring";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

type TaskVM = {
  id: string;
  number: number;
  title: string;
  statusName: string | null;
  statusColor: string | null;
  statusCategory: StatusCategory;
  progress: number;
  assigneeName: string | null;
  dueDate: string | null;
  isBlocked: boolean;
};
type MilestoneVM = { id: string; name: string; dueDate: string | null; achieved: boolean };
type FileVM = { id: string; taskId: string | null; fileName: string; fileSize: number | null; createdAt: string };
type UpdateVM = {
  id: string;
  action: string;
  metadata: Record<string, unknown>;
  actorName: string | null;
  actorAvatar: string | null;
  createdAt: string;
};
type ProjectVM = {
  id: string;
  name: string;
  description: string | null;
  progress: number;
  startDate: string | null;
  endDate: string | null;
  health: ProjectHealth;
};

const noLookup = { statusName: () => null, memberName: () => null };

function bytes(n: number | null) {
  if (n == null) return "";
  const u = ["B", "KB", "MB", "GB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
}

export function GuestProjectView({
  project,
  tasks,
  milestones,
  files,
  updates,
  openTaskId,
}: {
  project: ProjectVM;
  tasks: TaskVM[];
  milestones: MilestoneVM[];
  files: FileVM[];
  updates: UpdateVM[];
  openTaskId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const openTask = openTaskId ? tasks.find((t) => t.id === openTaskId) ?? null : null;
  const taskFiles = useMemo(
    () => (openTask ? files.filter((f) => f.taskId === openTask.id) : []),
    [files, openTask],
  );

  function download(id: string) {
    startTransition(async () => {
      const r = await getDownloadUrl({ id });
      if (r?.ok) window.open(r.data.url, "_blank", "noopener,noreferrer");
      else toast.error(r?.error.message ?? "That file isn't available.");
    });
  }

  const scheduled = tasks.filter((t) => t.dueDate);

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex items-start gap-4">
        <ProgressRing value={project.progress} size={56} strokeWidth={6} />
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", PROJECT_HEALTH_BADGE[project.health])}>
              {PROJECT_HEALTH_LABELS[project.health]}
            </span>
            {project.endDate && <span>· Estimasi {formatDate(project.endDate)}</span>}
          </div>
          {project.description && (
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{project.description}</p>
          )}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Schedule / timeline */}
          {scheduled.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Estimasi jadwal</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {scheduled.map((t) => {
                    const d = toDate(t.dueDate);
                    return (
                      <li key={t.id} className="flex items-center gap-3 text-sm">
                        <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: t.statusColor ?? "#94a3b8" }} />
                        <span className="min-w-0 flex-1 truncate">{t.title}</span>
                        {/* Client view shows target dates as estimates — no hard "overdue" alarm. */}
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {d ? format(d, "MMM d") : ""}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Task list */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tasks</CardTitle>
            </CardHeader>
            <CardContent>
              {tasks.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No tasks yet.</p>
              ) : (
                <ul className="divide-y">
                  {tasks.map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => router.push(`/portal/projects/${project.id}?task=${t.id}`)}
                        className="flex w-full items-center gap-3 py-2.5 text-left outline-none hover:bg-muted/40 focus-visible:bg-muted/40"
                      >
                        <span className="font-mono text-[10px] text-muted-foreground">#{t.number}</span>
                        <span className="min-w-0 flex-1 truncate text-sm">{t.title}</span>
                        {t.statusName && (
                          <span className="hidden shrink-0 items-center gap-1 text-xs text-muted-foreground sm:flex">
                            <span className="size-2 rounded-full" style={{ backgroundColor: t.statusColor ?? "#94a3b8" }} />
                            {t.statusName}
                          </span>
                        )}
                        <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{t.progress}%</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Milestones */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Milestones</CardTitle>
            </CardHeader>
            <CardContent>
              {milestones.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">No milestones.</p>
              ) : (
                <ul className="space-y-2.5">
                  {milestones.map((m) => (
                    <li key={m.id} className="flex items-center gap-2.5">
                      <Flag className={cn("size-4 shrink-0", m.achieved ? "text-emerald-500" : "text-indigo-500")} />
                      <span className={cn("min-w-0 flex-1 truncate text-sm", m.achieved && "text-muted-foreground line-through")}>
                        {m.name}
                      </span>
                      {m.dueDate && <span className="shrink-0 text-xs text-muted-foreground">{formatDate(m.dueDate, "MMM d")}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Shared files */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Shared files</CardTitle>
            </CardHeader>
            <CardContent>
              {files.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">No files shared.</p>
              ) : (
                <ul className="space-y-1.5">
                  {files.map((f) => (
                    <li key={f.id} className="flex items-center gap-2">
                      <FileText className="size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate text-sm">{f.fileName}</span>
                      <button
                        type="button"
                        aria-label={`Download ${f.fileName}`}
                        onClick={() => download(f.id)}
                        disabled={pending}
                        className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground"
                      >
                        <Download className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Recent updates */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent updates</CardTitle>
            </CardHeader>
            <CardContent>
              {updates.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">No updates yet.</p>
              ) : (
                <ul className="space-y-3">
                  {updates.map((u) => (
                    <li key={u.id} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                      <Avatar className="mt-0.5 size-6 shrink-0">
                        {u.actorAvatar && <AvatarImage src={u.actorAvatar} alt="" />}
                        <AvatarFallback className="text-[9px]">{getInitials(u.actorName)}</AvatarFallback>
                      </Avatar>
                      <p className="leading-snug">
                        <span className="font-medium text-foreground">{u.actorName ?? "Someone"}</span>{" "}
                        {humanizeActivity(u.action, u.metadata, noLookup)}
                        <span className="ml-1 text-xs">· {formatRelative(u.createdAt)}</span>
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Read-only task detail */}
      <Sheet open={!!openTask} onOpenChange={(o) => !o && router.push(`/portal/projects/${project.id}`)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          {openTask && (
            <>
              <SheetHeader>
                <span className="font-mono text-xs text-muted-foreground">#{openTask.number}</span>
                <SheetTitle className="text-lg leading-tight">{openTask.title}</SheetTitle>
              </SheetHeader>
              <div className="space-y-5 px-4 pb-8">
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Status</dt>
                    <dd className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full" style={{ backgroundColor: openTask.statusColor ?? "#94a3b8" }} />
                      {openTask.statusName ?? "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Progress</dt>
                    <dd className="tabular-nums">{openTask.progress}%</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Assignee</dt>
                    <dd>{openTask.assigneeName ?? "Unassigned"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Estimasi</dt>
                    <dd>{formatDate(openTask.dueDate)}</dd>
                  </div>
                </dl>

                {taskFiles.length > 0 && (
                  <div className="space-y-1.5">
                    <h3 className="text-sm font-medium">Files</h3>
                    <ul className="space-y-1.5">
                      {taskFiles.map((f) => (
                        <li key={f.id} className="flex items-center gap-2">
                          <FileText className="size-4 shrink-0 text-muted-foreground" />
                          <span className="min-w-0 flex-1 truncate text-sm">{f.fileName}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">{bytes(f.fileSize)}</span>
                          <button
                            type="button"
                            aria-label={`Download ${f.fileName}`}
                            onClick={() => download(f.id)}
                            disabled={pending}
                            className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground"
                          >
                            <Download className="size-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
