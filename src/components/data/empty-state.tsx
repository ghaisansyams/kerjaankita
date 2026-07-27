import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Two distinct cases (FSD conventions §C):
 *  - variant="empty": nothing exists yet → offer the primary action.
 *  - variant="no-results": filters exclude everything → offer to clear them.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[45vh] flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center",
        className,
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="size-6" />
      </div>
      <h2 className="mt-4 text-lg font-semibold tracking-tight">{title}</h2>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
