"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format, isPast, isToday, isWithinInterval } from "date-fns";
import { CircleCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { toDate } from "@/utils/format";
import { ProgressRingMini } from "@/features/tasks/components/card-progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type MyTaskVM = {
  id: string;
  number: number;
  title: string;
  dueDate: string | null;
  progress: number;
  projectId: string;
  projectName: string;
  statusName: string | null;
  statusColor: string | null;
  category: string | null;
};

type TabKey = "today" | "in_progress" | "review" | "upcoming";
const TABS: { key: TabKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "in_progress", label: "In Progress" },
  { key: "review", label: "Needs Review" },
  { key: "upcoming", label: "Upcoming" },
];

export function MyTasks({ tasks, today }: { tasks: MyTaskVM[]; today: Date }) {
  const [picked, setPicked] = useState<TabKey | null>(null);

  const buckets = useMemo(() => {
    const soon = { start: today, end: new Date(today.getTime() + 7 * 864e5) };
    const b: Record<TabKey, MyTaskVM[]> = { today: [], in_progress: [], review: [], upcoming: [] };
    for (const t of tasks) {
      const d = toDate(t.dueDate);
      if (d && isToday(d)) b.today.push(t);
      if (t.category === "in_progress") b.in_progress.push(t);
      if (t.category === "review") b.review.push(t);
      if (d && !isToday(d) && isWithinInterval(d, soon)) b.upcoming.push(t);
    }
    return b;
  }, [tasks, today]);

  // Default to the first tab that actually has work; respect an explicit pick.
  const tab = picked ?? TABS.find((t) => buckets[t.key].length > 0)?.key ?? "today";
  const list = buckets[tab];

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">My tasks</CardTitle>
        <div className="flex gap-0.5 rounded-lg bg-muted p-0.5">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setPicked(t.key)}
              aria-pressed={tab === t.key}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                tab === t.key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
              {buckets[t.key].length > 0 && (
                <span className="ml-1 tabular-nums text-muted-foreground">{buckets[t.key].length}</span>
              )}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="min-h-0 flex-1">
        {list.length === 0 ? (
          <div className="flex h-full min-h-40 flex-col items-center justify-center gap-2 text-center">
            <CircleCheck className="size-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Nothing here — you&apos;re on top of it.</p>
          </div>
        ) : (
          <ul className="divide-y">
            {list.map((t) => {
              const d = toDate(t.dueDate);
              const overdue = d ? isPast(d) && !isToday(d) : false;
              return (
                <li key={t.id}>
                  <Link
                    href={`/projects/${t.projectId}/board?task=${t.id}`}
                    className="flex items-center gap-3 py-2.5 outline-none transition-colors hover:bg-muted/40 focus-visible:bg-muted/40"
                  >
                    <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: t.statusColor ?? "#94a3b8" }} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{t.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {t.projectName} · #{t.number}
                      </p>
                    </div>
                    {d && (
                      <span className={cn("shrink-0 text-xs tabular-nums", overdue ? "font-medium text-rose-600 dark:text-rose-400" : "text-muted-foreground")}>
                        {format(d, "MMM d")}
                      </span>
                    )}
                    <ProgressRingMini value={t.progress} size={26} stroke={3} />
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
