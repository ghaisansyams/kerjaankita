"use client";

import { useTransition } from "react";
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
  const [pending, startTransition] = useTransition();

  function onChange(value: string) {
    startTransition(async () => {
      const result = await updateTask({
        id: taskId,
        assigneeId: value === "none" ? null : value,
      });
      if (result?.ok) router.refresh();
      else toast.error(result?.error.message ?? "Couldn't change the PIC");
    });
  }

  return (
    <Select
      value={assigneeId ?? "none"}
      onValueChange={onChange}
      disabled={disabled || pending}
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
