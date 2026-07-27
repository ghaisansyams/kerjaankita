import Link from "next/link";
import { format, isPast, isToday } from "date-fns";
import { Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import { toDate } from "@/utils/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type UpcomingMilestone = {
  id: string;
  name: string;
  dueDate: string | null;
  projectId: string;
  projectName: string;
  projectColor: string | null;
};

export function UpcomingMilestones({ items }: { items: UpcomingMilestone[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Upcoming milestones</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nothing on the horizon.</p>
        ) : (
          <ul className="space-y-2.5">
            {items.map((m) => {
              const d = toDate(m.dueDate);
              const soon = d ? isToday(d) || isPast(d) : false;
              return (
                <li key={m.id}>
                  <Link
                    href={`/projects/${m.projectId}/milestones`}
                    className="flex items-center gap-2.5 rounded-md py-0.5 transition-colors hover:bg-muted/50"
                  >
                    <Flag className="size-4 shrink-0 text-indigo-500" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{m.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{m.projectName}</p>
                    </div>
                    {d && (
                      <span
                        className={cn(
                          "shrink-0 text-xs tabular-nums",
                          soon ? "font-medium text-amber-600 dark:text-amber-400" : "text-muted-foreground",
                        )}
                      >
                        {format(d, "MMM d")}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
