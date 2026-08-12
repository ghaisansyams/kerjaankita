"use client";

import { PRIORITY_LABELS, type Priority, type StatusCategory } from "@/constants";
import { formatDate } from "@/utils/format";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type PortalTaskVM = {
  id: string;
  number: number;
  title: string;
  statusName: string | null;
  statusColor: string | null;
  statusCategory: StatusCategory;
  progress: number;
  assigneeName: string | null;
  dueDate: string | null;
  priority: Priority | null;
  isBlocked: boolean;
};

/**
 * Every task in the project, in a scrollable dialog rather than a route change —
 * the client keeps their place on the project page.
 *
 * Read-only by construction: rows are plain text, with no control that could
 * mutate anything.
 */
export function AllTasksDialog({
  open,
  onOpenChange,
  tasks,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: PortalTaskVM[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid-cols-[minmax(0,1fr)] max-h-[85vh] gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-4 py-3 text-left">
          <DialogTitle>All tasks</DialogTitle>
          <DialogDescription>Semua task di project ini · {tasks.length} task</DialogDescription>
        </DialogHeader>

        <div className="max-h-[65vh] overflow-y-auto px-4 py-1">
          {tasks.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No tasks available.</p>
          ) : (
            <ul className="divide-y">
              {tasks.map((t) => (
                <li key={t.id} className="py-3">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 shrink-0 font-mono text-[11px] text-muted-foreground">
                      #{t.number}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-snug">{t.title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {t.statusName && (
                          <span className="inline-flex items-center gap-1.5">
                            <span
                              className="size-2 rounded-full"
                              style={{ backgroundColor: t.statusColor ?? "#94a3b8" }}
                            />
                            {t.statusName}
                          </span>
                        )}
                        {t.priority && t.priority !== "none" && (
                          <span>{PRIORITY_LABELS[t.priority]}</span>
                        )}
                        {t.assigneeName && <span>{t.assigneeName}</span>}
                        {t.dueDate && <span>Estimasi {formatDate(t.dueDate)}</span>}
                        {t.isBlocked && (
                          <span className="text-rose-600 dark:text-rose-400">Blocked</span>
                        )}
                      </div>
                    </div>
                    <span className="w-11 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                      {t.progress}%
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
