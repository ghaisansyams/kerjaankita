"use client";

import { useEffect } from "react";
import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface for observability (Sentry/Logflare wire-up in the deploy guide).
    console.error(error);
  }, [error]);

  return (
    <div className="grid min-h-[60vh] place-items-center text-center">
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            We hit an unexpected error loading this page.
          </p>
          {error.digest && (
            <p className="mt-1 font-mono text-xs text-muted-foreground">Ref: {error.digest}</p>
          )}
        </div>
        <Button onClick={reset}>
          <RotateCw className="size-4" />
          Try again
        </Button>
      </div>
    </div>
  );
}
