"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateTaskStatus } from "../actions";
import type { StatusCategory } from "@/constants";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export type StatusOption = {
  id: string;
  name: string;
  color: string;
  category: StatusCategory;
};

export function TaskStatusSelect({
  taskId,
  statusId,
  statuses,
  disabled,
}: {
  taskId: string;
  statusId: string | null;
  statuses: StatusOption[];
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [blockTarget, setBlockTarget] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  function apply(targetId: string, reasonText?: string) {
    startTransition(async () => {
      const result = await updateTaskStatus({ id: taskId, statusId: targetId, reason: reasonText });
      if (result?.ok) {
        setBlockTarget(null);
        setReason("");
        router.refresh();
      } else {
        toast.error(result?.error.message ?? "Couldn't change status");
      }
    });
  }

  function onChange(targetId: string) {
    const target = statuses.find((s) => s.id === targetId);
    if (target?.category === "blocked") {
      setBlockTarget(targetId);
    } else {
      apply(targetId);
    }
  }

  return (
    <>
      <Select value={statusId ?? undefined} onValueChange={onChange} disabled={disabled || pending}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          {statuses.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              <span className="flex items-center gap-2">
                <span className="size-2 rounded-full" style={{ backgroundColor: s.color }} />
                {s.name}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <AlertDialog open={!!blockTarget} onOpenChange={(o) => !o && setBlockTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Block this task?</AlertDialogTitle>
            <AlertDialogDescription>
              Blocking notifies the project owner. Please say what&apos;s blocking it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="block-reason">Reason</Label>
            <Textarea
              id="block-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Waiting on client sign-off…"
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <Button
              onClick={() => blockTarget && apply(blockTarget, reason)}
              disabled={pending || !reason.trim()}
            >
              Block task
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
