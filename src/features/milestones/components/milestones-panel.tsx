"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  CircleCheck,
  CircleDashed,
  Flag,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/utils/format";
import { cn } from "@/lib/utils";
import { deleteMilestone, reorderMilestones, updateMilestone } from "../actions";
import { MilestoneForm } from "./milestone-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/data/empty-state";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type MilestoneVM = {
  id: string;
  name: string;
  description: string | null;
  dueDate: string | null;
  achieved: boolean;
};

export function MilestonesPanel({
  projectId,
  milestones,
  canManage,
}: {
  projectId: string;
  milestones: MilestoneVM[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<MilestoneVM | null>(null);
  const [deleting, setDeleting] = useState<MilestoneVM | null>(null);

  function withRefresh(fn: () => Promise<{ ok: boolean; error?: { message: string } } | undefined>, ok: string) {
    startTransition(async () => {
      const result = await fn();
      if (result?.ok) {
        if (ok) toast.success(ok);
        router.refresh();
      } else {
        toast.error(result?.error?.message ?? "Something went wrong");
      }
    });
  }

  function toggleAchieved(m: MilestoneVM, achieved: boolean) {
    withRefresh(
      () => updateMilestone({ id: m.id, achieved }),
      achieved ? "Milestone reached" : "Milestone reopened",
    );
  }

  function move(index: number, dir: -1 | 1) {
    const ids = milestones.map((m) => m.id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    withRefresh(() => reorderMilestones({ projectId, orderedIds: ids }), "");
  }

  function onDelete() {
    if (!deleting) return;
    withRefresh(() => deleteMilestone({ id: deleting.id }), "Milestone deleted");
    setDeleting(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Milestones</h2>
          <p className="text-sm text-muted-foreground">
            Key checkpoints for this project.
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            New milestone
          </Button>
        )}
      </div>

      {milestones.length === 0 ? (
        <EmptyState
          icon={Flag}
          title="No milestones yet"
          description="Add milestones to mark the checkpoints your team and clients care about."
          action={
            canManage ? (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" />
                New milestone
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Card className="divide-y p-0">
          {milestones.map((m, i) => (
            <div key={m.id} className="flex items-center gap-3 p-3">
              {canManage ? (
                <Checkbox
                  checked={m.achieved}
                  onCheckedChange={(c) => toggleAchieved(m, c === true)}
                  disabled={pending}
                  aria-label={m.achieved ? "Mark not reached" : "Mark reached"}
                />
              ) : m.achieved ? (
                <CircleCheck className="size-5 text-emerald-500" />
              ) : (
                <CircleDashed className="size-5 text-muted-foreground" />
              )}

              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "truncate text-sm font-medium",
                    m.achieved && "text-muted-foreground line-through",
                  )}
                >
                  {m.name}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {m.dueDate ? `Due ${formatDate(m.dueDate)}` : "No date"}
                  {m.description ? ` · ${m.description}` : ""}
                </p>
              </div>

              {canManage && (
                <div className="flex items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Move up"
                    disabled={pending || i === 0}
                    onClick={() => move(i, -1)}
                  >
                    <ChevronUp className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Move down"
                    disabled={pending || i === milestones.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <ChevronDown className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Edit ${m.name}`}
                    onClick={() => setEditing(m)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${m.name}`}
                    onClick={() => setDeleting(m)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </Card>
      )}

      {canManage && (
        <>
          <MilestoneForm
            open={createOpen}
            onOpenChange={setCreateOpen}
            mode="create"
            projectId={projectId}
          />
          <MilestoneForm
            open={!!editing}
            onOpenChange={(o) => !o && setEditing(null)}
            mode="edit"
            projectId={projectId}
            milestoneId={editing?.id}
            initial={
              editing
                ? {
                    name: editing.name,
                    description: editing.description ?? "",
                    dueDate: editing.dueDate ?? "",
                  }
                : undefined
            }
          />
          <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes the milestone from the project and its timeline.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    onDelete();
                  }}
                  disabled={pending}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
}
