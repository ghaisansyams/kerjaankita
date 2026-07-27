import { CircleAlert, CircleCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export function AuthAlert({
  error,
  success,
}: {
  error?: string;
  success?: string;
}) {
  if (!error && !success) return null;
  const isError = Boolean(error);

  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm",
        isError
          ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300"
          : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300",
      )}
    >
      {isError ? (
        <CircleAlert className="mt-0.5 size-4 shrink-0" />
      ) : (
        <CircleCheck className="mt-0.5 size-4 shrink-0" />
      )}
      <span>{error ?? success}</span>
    </div>
  );
}
