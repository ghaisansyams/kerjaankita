"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, CheckCircle2, Clock, Download, ListPlus, MapPin, Pencil, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/utils/format";
import type { MomDetail as Mom } from "@/repositories/mom.repository";
import { createTaskFromNote, deleteMom, logMomExport } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const CATEGORY_LABEL: Record<string, string> = {
  discussion: "Discussion",
  decision: "Decision",
  action_item: "Action item",
  next_step: "Next step",
};
const NONE = "__none__";

function Info({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm">{value}</p>
      </div>
    </div>
  );
}

export function MomDetail({
  mom,
  members,
  canEdit,
  canDelete,
  canExport,
  canCreateTask,
}: {
  mom: Mom;
  members: { id: string; name: string }[];
  canEdit: boolean;
  canDelete: boolean;
  canExport: boolean;
  canCreateTask: boolean;
}) {
  const router = useRouter();
  const [linked, setLinked] = useState<Record<string, string>>(
    Object.fromEntries(mom.notes.filter((n) => n.taskId).map((n) => [n.id, n.taskId as string])),
  );
  const [taskNote, setTaskNote] = useState<{ id: string; content: string } | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskAssignee, setTaskAssignee] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  function exportPdf() {
    if (canExport) logMomExport({ id: mom.id });
    window.open(`/mom/${mom.id}/print`, "_blank", "noopener,noreferrer");
  }

  function openTaskDialog(noteId: string, content: string) {
    setTaskNote({ id: noteId, content });
    setTaskTitle(content.slice(0, 180));
    setTaskAssignee("");
    setTaskDue("");
  }

  async function submitTask() {
    if (!taskNote) return;
    setBusy(true);
    const res = await createTaskFromNote({ noteId: taskNote.id, title: taskTitle, assigneeId: taskAssignee || "", dueDate: taskDue || "" });
    setBusy(false);
    if (!res?.ok) return toast.error(res?.error.message ?? "Couldn't create the task.");
    setLinked((l) => ({ ...l, [taskNote.id]: res.data.taskId }));
    setTaskNote(null);
    toast.success("Task created and added to the board");
  }

  async function confirmDelete() {
    setBusy(true);
    const res = await deleteMom({ id: mom.id });
    setBusy(false);
    setDeleteOpen(false);
    if (!res?.ok) return toast.error(res?.error.message ?? "Couldn't delete.");
    toast.success("MOM deleted");
    router.push("/mom");
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Minutes of Meeting</p>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{mom.title}</h1>
          <Link href={`/projects/${mom.projectId}/mom`} className="text-sm text-muted-foreground hover:text-foreground">
            {mom.projectName}
          </Link>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={exportPdf}><Download className="size-4" /> Export PDF</Button>
          {canEdit && <Button size="sm" variant="outline" asChild><Link href={`/mom/${mom.id}/edit`}><Pencil className="size-4" /> Edit</Link></Button>}
          {canDelete && <Button size="sm" variant="outline" onClick={() => setDeleteOpen(true)}><Trash2 className="size-4" /> Delete</Button>}
        </div>
      </header>

      {/* Auto info */}
      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
          <Info icon={CalendarDays} label="Date" value={formatDate(mom.meetingDate)} />
          <Info icon={Clock} label="Time" value={mom.meetingTime || "—"} />
          <Info icon={MapPin} label="Location" value={mom.location || "—"} />
          <Info icon={User} label="PIC" value={mom.picName || "—"} />
        </CardContent>
      </Card>

      <div className="grid gap-6 sm:grid-cols-2">
        {/* Participants */}
        <Card>
          <CardHeader><CardTitle className="text-base">Participants</CardTitle></CardHeader>
          <CardContent>
            {mom.participants.length === 0 ? (
              <p className="text-sm text-muted-foreground">—</p>
            ) : (
              <ul className="space-y-2">
                {mom.participants.map((p) => (
                  <li key={p.id} className="text-sm">
                    <span className="font-medium">{p.name}</span>
                    <span className="text-muted-foreground">{[p.role, p.company].filter(Boolean).length ? ` — ${[p.role, p.company].filter(Boolean).join(", ")}` : ""}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        {/* Distribution */}
        <Card>
          <CardHeader><CardTitle className="text-base">Distribution</CardTitle></CardHeader>
          <CardContent>
            {mom.distribution.length === 0 ? (
              <p className="text-sm text-muted-foreground">—</p>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {mom.distribution.map((d) => <li key={d.id} className="rounded-full bg-muted px-2.5 py-0.5 text-sm">{d.recipient}</li>)}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Notes */}
      <Card>
        <CardHeader><CardTitle className="text-base">Meeting notes</CardTitle></CardHeader>
        <CardContent>
          {mom.notes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No notes recorded.</p>
          ) : (
            <ol className="space-y-4">
              {mom.notes.map((n, i) => {
                const taskId = linked[n.id];
                return (
                  <li key={n.id} className="flex gap-3">
                    <span className="mt-0.5 w-5 shrink-0 text-right text-sm font-semibold tabular-nums text-muted-foreground">{i + 1}.</span>
                    <div className="min-w-0 flex-1">
                      <span className="mb-1 inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {CATEGORY_LABEL[n.category] ?? n.category}
                      </span>
                      <p className="whitespace-pre-wrap text-sm">{n.content}</p>
                      <div className="mt-1.5">
                        {taskId ? (
                          <Link href={`/projects/${mom.projectId}/board?task=${taskId}`} className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400">
                            <CheckCircle2 className="size-3.5" /> Task created
                          </Link>
                        ) : (
                          canCreateTask && (
                            <button type="button" onClick={() => openTaskDialog(n.id, n.content)} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                              <ListPlus className="size-3.5" /> Create task
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>

      {/* Approval */}
      <div className="grid gap-6 border-t pt-6 sm:grid-cols-2">
        <div>
          <p className="text-xs text-muted-foreground">Prepared by</p>
          <p className="mt-6 border-t pt-1 text-sm font-medium">{mom.preparedByName ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Approved by</p>
          <p className="mt-6 border-t pt-1 text-sm font-medium">{mom.approvedByName}</p>
          <p className="text-xs text-muted-foreground">{mom.approvedByRole}</p>
        </div>
      </div>

      {/* Create-task dialog */}
      <Dialog open={Boolean(taskNote)} onOpenChange={(o) => !o && setTaskNote(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create task from note</DialogTitle>
            <DialogDescription>This adds a task to the project board, timeline, calendar and the assignee&apos;s list.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label className="text-xs">Task title</Label><Input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Assign to</Label>
                <Select value={taskAssignee || NONE} onValueChange={(v) => setTaskAssignee(v === NONE ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Unassigned</SelectItem>
                    {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label className="text-xs">Due date</Label><Input type="date" value={taskDue} onChange={(e) => setTaskDue(e.target.value)} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTaskNote(null)} disabled={busy}>Cancel</Button>
            <Button onClick={submitTask} disabled={busy || !taskTitle.trim()}>Create task</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this meeting minutes?</AlertDialogTitle>
            <AlertDialogDescription>The MOM is removed. Tasks already created from it are kept.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); confirmDelete(); }} disabled={busy} className="bg-rose-600 text-white hover:bg-rose-600/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
