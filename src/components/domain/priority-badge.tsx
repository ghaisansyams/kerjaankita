import {
  PRIORITY_BADGE,
  PRIORITY_DOT,
  PRIORITY_LABELS,
  type Priority,
} from "@/constants";
import { cn } from "@/lib/utils";

export function PriorityBadge({
  priority,
  className,
}: {
  priority: Priority;
  className?: string;
}) {
  if (priority === "none") return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium",
        PRIORITY_BADGE[priority],
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", PRIORITY_DOT[priority])} />
      {PRIORITY_LABELS[priority]}
    </span>
  );
}
