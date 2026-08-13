"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateTask } from "../actions";
import type { MemberOption } from "./task-form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Inline PIC picker — the same one-click affordance Status and Progress already
 * get, so every task can be given an owner without opening the edit dialog.
 * Sends `null` to clear, which the update schema keeps distinct from "untouched".
 */
export function TaskPicSelect({
  taskId,
  assigneeId,
  members,
  disabled,
}: {
  taskId: string;
  assigneeId: string | null;
  members: MemberOption[];
  disabled?: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  // Show the pick straight away. Bound to the server prop alone, the select
  // kept displaying the old name until router.refresh() had re-rendered the
  // whole board — seconds of a control that looks stuck.
  const [optimistic, setOptimistic] = useState<string | null>(null);
  useEffect(() => setOptimistic(null), [assigneeId]); // server caught up

  function onChange(value: string) {
    setOptimistic(value);
    startTransition(async () => {
      const result = await updateTask({
        id: taskId,
        assigneeId: value === "none" ? null : value,
      });
      if (result?.ok) {
        router.refresh();
      } else {
        setOptimistic(null); // put the old PIC back; the change didn't land
        toast.error(result?.error.message ?? "Couldn't change the PIC");
      }
    });
  }

  return (
    <Select
      value={optimistic ?? assigneeId ?? "none"}
      onValueChange={onChange}
      // Not disabled while saving: the request is quick and reversible, and
      // locking the control is what made this feel frozen.
      disabled={disabled}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Unassigned" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">Unassigned</SelectItem>
        {members.map((m) => (
          <SelectItem key={m.id} value={m.id}>
            {m.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
