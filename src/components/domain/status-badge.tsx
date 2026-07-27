import {
  STATUS_CATEGORY_BADGE,
  STATUS_CATEGORY_LABELS,
  type StatusCategory,
} from "@/constants";
import { cn } from "@/lib/utils";

/**
 * Renders a tenant workflow status. Uses the status's own name + colour dot,
 * falling back to the stable category tint (so logic/reporting stays universal).
 */
export function StatusBadge({
  label,
  color,
  category,
  className,
}: {
  label?: string | null;
  color?: string | null;
  category: StatusCategory;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium",
        STATUS_CATEGORY_BADGE[category],
        className,
      )}
    >
      <span
        className="size-1.5 rounded-full"
        style={color ? { backgroundColor: color } : undefined}
      />
      {label ?? STATUS_CATEGORY_LABELS[category]}
    </span>
  );
}
