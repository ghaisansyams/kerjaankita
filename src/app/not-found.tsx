import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center bg-muted/20 p-6 text-center">
      <div className="space-y-4">
        <p className="font-mono text-5xl font-bold text-primary">404</p>
        <div>
          <h1 className="text-xl font-semibold">Page not found</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            That page doesn&apos;t exist, or you don&apos;t have access to it.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
