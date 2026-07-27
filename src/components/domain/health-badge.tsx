import {
  PROJECT_HEALTH_BADGE,
  PROJECT_HEALTH_DOT,
  PROJECT_HEALTH_LABELS,
  type ProjectHealth,
} from "@/constants";
import { cn } from "@/lib/utils";

export function HealthBadge({
  health,
  className,
}: {
  health: ProjectHealth;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium",
        PROJECT_HEALTH_BADGE[health],
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", PROJECT_HEALTH_DOT[health])} />
      {PROJECT_HEALTH_LABELS[health]}
    </span>
  );
}
