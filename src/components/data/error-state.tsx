"use client";

import { CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Section-level error with a retry affordance (FSD conventions §C). */
export function ErrorState({
  title = "Couldn't load this",
  description = "Something went wrong. Please try again.",
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex min-h-[40vh] flex-col items-center justify-center rounded-xl border p-8 text-center",
        className,
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
        <CircleAlert className="size-6" />
      </div>
      <h2 className="mt-4 text-lg font-semibold tracking-tight">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {onRetry && (
        <Button variant="outline" className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
