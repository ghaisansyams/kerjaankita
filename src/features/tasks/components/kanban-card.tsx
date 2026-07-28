"use client";

import { useRouter } from "next/navigation";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format, isPast, isToday } from "date-fns";
import {
  AlertOctagon,
  Clock,
  GripVertical,
  ListChecks,
  MessageSquare,
  Paperclip,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PRIORITY_BADGE, PRIORITY_LABELS, type Priority } from "@/constants";
import { getInitials, toDate } from "@/utils/format";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { InlineProgress } from "./card-progress";
import type { BoardTask } from "../board-shared";

function Due({ due, done }: { due: string | null; done: boolean }) {
  const d = toDate(due);
  if (!d) return null;
  const overdue = isPast(d) && !isToday(d) && !done;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 tabular-nums",
        overdue ? "font-medium text-rose-600 dark:text-rose-400" : isToday(d) ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground",
      )}
    >
      {format(d, "MMM d")}
    </span>
  );
}

function Count({ icon: Icon, children, accent }: { icon: typeof Clock; children: React.ReactNode; accent?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1 tabular-nums", accent ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
      <Icon className="size-3.5" />
      {children}
    </span>
  );
}

/** Presentational card body — reused by the sortable item and the drag overlay. */
export function KanbanCardBody({
  task,
  editable = false,
  onSetProgress,
  dragging,
}: {
  task: BoardTask;
  editable?: boolean;
  onSetProgress?: (id: string, value: number) => Promise<boolean>;
  dragging?: boolean;
}) {
  const priority = task.priority as Priority;
  const done = task.progress >= 100;
  const hasCounts = task.checklist_total > 0 || task.attachments > 0 || task.comments > 0;

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-3 transition-shadow",
        task.is_blocked && "border-l-2 border-l-rose-400 dark:border-l-rose-600",
        dragging ? "shadow-xl ring-1 ring-primary/30" : "shadow-sm",
      )}
    >
      {/* top: priority + number + blocked */}
      <div className="mb-1.5 flex items-center gap-2">
        {priority !== "none" && (
          <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none", PRIORITY_BADGE[priority])}>
            {PRIORITY_LABELS[priority]}
          </span>
        )}
        <span className="font-mono text-[10px] text-muted-foreground">#{task.number}</span>
        {task.is_blocked && (
          <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-medium text-rose-500">
            <AlertOctagon className="size-3" /> Blocked
          </span>
        )}
      </div>

      {/* title */}
      <p className="line-clamp-2 pr-6 text-sm font-medium leading-snug text-foreground">{task.title}</p>

      {/* meta: assignee + due + est  |  progress ring */}
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex items-center gap-2 text-xs">
            {task.assignee_id ? (
              <Avatar className="size-5">
                {task.assignee_avatar && <AvatarImage src={task.assignee_avatar} alt="" />}
                <AvatarFallback className="text-[8px]">{getInitials(task.assignee_name)}</AvatarFallback>
              </Avatar>
            ) : (
              <span className="grid size-5 place-items-center rounded-full border border-dashed text-[8px] text-muted-foreground">?</span>
            )}
            <Due due={task.due_date} done={done} />
            {task.est_hours != null && (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <Clock className="size-3.5" />
                {task.est_hours}h
              </span>
            )}
          </div>
          {hasCounts && (
            <div className="flex items-center gap-3 text-[11px]">
              {task.checklist_total > 0 && (
                <Count icon={ListChecks} accent={task.checklist_done === task.checklist_total}>
                  {task.checklist_done}/{task.checklist_total}
                </Count>
              )}
              {task.attachments > 0 && <Count icon={Paperclip}>{task.attachments}</Count>}
              {task.comments > 0 && <Count icon={MessageSquare}>{task.comments}</Count>}
            </div>
          )}
        </div>

        {onSetProgress ? (
          <InlineProgress
            value={task.progress}
            editable={editable}
            onChange={(v) => onSetProgress(task.id, v)}
          />
        ) : (
          <InlineProgress value={task.progress} editable={false} onChange={async () => true} />
        )}
      </div>
    </div>
  );
}

export function SortableKanbanCard({
  task,
  projectId,
  draggable,
  editable,
  onSetProgress,
}: {
  task: BoardTask;
  projectId: string;
  draggable: boolean;
  editable: boolean;
  onSetProgress: (id: string, value: number) => Promise<boolean>;
}) {
  const router = useRouter();
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

  const open = () => router.push(`/projects/${projectId}/board?task=${task.id}`);

  return (
    <li ref={setNodeRef} style={style} className="group relative list-none">
      {/* Mouse: click anywhere opens; interactive controls stopPropagation. */}
      <div
        onClick={open}
        className="cursor-pointer rounded-xl outline-none transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 [&:hover>div]:shadow-md"
      >
        <KanbanCardBody task={task} editable={editable} onSetProgress={onSetProgress} />
      </div>

      {/* Keyboard open target (a11y) + hover drag handle */}
      <button
        type="button"
        onClick={open}
        aria-label={`Open task #${task.number}: ${task.title}`}
        className="absolute -top-px left-0 h-0 w-0 overflow-hidden opacity-0 focus-visible:h-auto focus-visible:w-auto focus-visible:opacity-100"
      />
      {draggable && (
        <button
          type="button"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Reorder task #${task.number}`}
          className="absolute right-1 top-1.5 grid size-6 cursor-grab touch-none place-items-center rounded text-muted-foreground/40 opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
        >
          <GripVertical className="size-3.5" />
        </button>
      )}
    </li>
  );
}
