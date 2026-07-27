"use client";

import Link from "next/link";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format, isPast, isToday } from "date-fns";
import { AlertOctagon, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRIORITY_DOT, PRIORITY_LABELS, type Priority } from "@/constants";
import { getInitials, toDate } from "@/utils/format";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { BoardTask } from "../queries";

function DueChip({ due }: { due: string | null }) {
  const d = toDate(due);
  if (!d) return null;
  const overdue = isPast(d) && !isToday(d);
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 text-[10px] font-medium",
        overdue
          ? "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
          : isToday(d)
            ? "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
            : "bg-muted text-muted-foreground",
      )}
    >
      {format(d, "MMM d")}
    </span>
  );
}

/** Presentational card — reused inside the sortable item and the drag overlay. */
export function KanbanCardBody({ task, dragging }: { task: BoardTask; dragging?: boolean }) {
  const priority = task.priority as Priority;
  return (
    <div className={cn("rounded-lg border bg-card p-2.5", dragging ? "shadow-lg" : "shadow-sm")}>
      <div className="mb-1 flex items-center gap-1.5">
        <span
          className={cn("size-1.5 rounded-full", PRIORITY_DOT[priority])}
          title={`${PRIORITY_LABELS[priority]} priority`}
        />
        <span className="font-mono text-[10px] text-muted-foreground">#{task.number}</span>
        {task.is_blocked && (
          <AlertOctagon className="size-3 text-rose-500" aria-label="Blocked" />
        )}
      </div>
      <p className="line-clamp-2 pr-4 text-sm font-medium leading-snug">{task.title}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        {task.assignee_id ? (
          <Avatar className="size-5">
            {task.assignee_avatar && <AvatarImage src={task.assignee_avatar} alt="" />}
            <AvatarFallback className="text-[8px]">
              {getInitials(task.assignee_name)}
            </AvatarFallback>
          </Avatar>
        ) : (
          <span aria-hidden className="size-5" />
        )}
        <DueChip due={task.due_date} />
      </div>
      {task.progress > 0 && (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: `${task.progress}%` }} />
        </div>
      )}
    </div>
  );
}

export function SortableKanbanCard({
  task,
  projectId,
  draggable,
}: {
  task: BoardTask;
  projectId: string;
  draggable: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { statusId: task.status_id },
    disabled: !draggable,
  });
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <li ref={setNodeRef} style={style} className="relative list-none">
      <Link
        href={`/projects/${projectId}/board?task=${task.id}`}
        className="block rounded-lg outline-none ring-ring ring-offset-2 focus-visible:ring-2"
      >
        <KanbanCardBody task={task} />
      </Link>
      {draggable && (
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="absolute right-0.5 top-0.5 grid size-6 cursor-grab touch-none place-items-center rounded text-muted-foreground/40 transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Reorder task #${task.number}`}
        >
          <GripVertical className="size-3.5" />
        </button>
      )}
    </li>
  );
}
