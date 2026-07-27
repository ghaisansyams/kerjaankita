"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="grid min-h-[50vh] place-items-center text-center">
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="mt-1 text-sm text-muted-foreground">Please try again in a moment.</p>
        </div>
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}
