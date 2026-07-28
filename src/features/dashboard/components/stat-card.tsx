import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

export type Stat = {
  label: string;
  value: string | number;
  icon: LucideIcon;
  hint?: string;
  href?: string;
  /** Tailwind classes for the icon chip (defaults to primary). */
  tone?: string;
};

export function StatCard({ label, value, icon: Icon, hint, href, tone }: Stat) {
  const inner = (
    <CardContent className="flex h-full items-center gap-3 p-5">
      <div
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg",
          tone ?? "bg-primary/10 text-primary",
        )}
      >
        <Icon className="size-4.5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold tabular-nums leading-tight">{value}</p>
        {hint && <p className="truncate text-xs text-muted-foreground">{hint}</p>}
      </div>
    </CardContent>
  );

  if (href) {
    return (
      <Card className="h-full transition-colors hover:border-primary/40">
        <Link href={href} className="block h-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {inner}
        </Link>
      </Card>
    );
  }
  return <Card className="h-full">{inner}</Card>;
}
