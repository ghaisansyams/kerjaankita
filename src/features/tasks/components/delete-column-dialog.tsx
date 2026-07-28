"use client";

import { useEffect, useState } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type DeleteTarget = { id: string; name: string; taskCount: number };

export function DeleteColumnDialog({
  target,
  destinations,
  onCancel,
  onConfirm,
}: {
  target: DeleteTarget | null;
  /** Other columns tasks can move into. */
  destinations: { id: string; name: string }[];
  onCancel: () => void;
  onConfirm: (reassignTo: string | null) => void;
}) {
  const [dest, setDest] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDest(destinations[0]?.id ?? "");
    setBusy(false);
  }, [target, destinations]);

  const hasTasks = (target?.taskCount ?? 0) > 0;
  const canDelete = !hasTasks || Boolean(dest);

  return (
    <AlertDialog open={Boolean(target)} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete column “{target?.name}”</AlertDialogTitle>
          <AlertDialogDescription>
            {hasTasks
              ? `This column contains ${target?.taskCount} ${target?.taskCount === 1 ? "task" : "tasks"}. They won't be deleted — choose where to move them.`
              : "This column is empty and will be removed."}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {hasTasks && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Move all tasks to</label>
            <Select value={dest} onValueChange={setDest}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a column" />
              </SelectTrigger>
              <SelectContent>
                {destinations.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={!canDelete || busy}
            onClick={(e) => {
              e.preventDefault();
              setBusy(true);
              onConfirm(hasTasks ? dest : null);
            }}
            className="bg-rose-600 text-white hover:bg-rose-600/90 focus-visible:ring-rose-600/30"
          >
            Delete column
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
