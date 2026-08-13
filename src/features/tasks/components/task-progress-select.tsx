"use client";

import { useEffect, useState, useTransition } from "react";
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
  const [, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState<string | null>(null);
  useEffect(() => setOptimistic(null), [progress]);

  function onChange(value: string) {
    setOptimistic(value);
    startTransition(async () => {
      const result = await updateTaskProgress({ id: taskId, progress: Number(value) });
      if (result?.ok) {
        router.refresh();
      } else {
        setOptimistic(null);
        toast.error(result?.error.message ?? "Couldn't update progress");
      }
    });
  }

  return (
    <Select value={optimistic ?? String(progress)} onValueChange={onChange} disabled={disabled}>
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
