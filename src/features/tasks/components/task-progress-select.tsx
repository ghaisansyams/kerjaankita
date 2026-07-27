"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PROGRESS_STEPS } from "@/constants";
import { updateTaskProgress } from "../actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function TaskProgressSelect({
  taskId,
  progress,
  disabled,
}: {
  taskId: string;
  progress: number;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onChange(value: string) {
    startTransition(async () => {
      const result = await updateTaskProgress({ id: taskId, progress: Number(value) });
      if (result?.ok) router.refresh();
      else toast.error(result?.error.message ?? "Couldn't update progress");
    });
  }

  return (
    <Select value={String(progress)} onValueChange={onChange} disabled={disabled || pending}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PROGRESS_STEPS.map((p) => (
          <SelectItem key={p} value={String(p)}>
            {p}%
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
