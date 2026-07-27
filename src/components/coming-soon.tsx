import { Hammer } from "lucide-react";

export function ComingSoon({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="flex min-h-[55vh] flex-col items-center justify-center text-center">
      <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Hammer className="size-6" />
      </div>
      <h2 className="mt-4 text-lg font-semibold">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {description ?? "This section is being built. Check back soon."}
      </p>
    </div>
  );
}
