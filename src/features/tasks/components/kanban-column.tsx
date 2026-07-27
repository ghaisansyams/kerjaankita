"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { cn } from "@/lib/utils";
import { SortableKanbanCard } from "./kanban-card";
import type { BoardStatus } from "./kanban-board";
import type { BoardTask } from "../queries";

/** Rendered-card cap per column — the rest scroll/paginate (infinite-ready). */
const CAP = 100;

export function KanbanColumn({
  status,
  tasks,
  projectId,
  canMove,
}: {
  status: BoardStatus;
  tasks: BoardTask[];
  projectId: string;
  canMove: (t: BoardTask) => boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${status.id}`, data: { statusId: status.id } });
  const shown = tasks.slice(0, CAP);
  const overflow = tasks.length - shown.length;

  return (
    <section className="flex w-72 shrink-0 flex-col rounded-xl bg-muted/40" aria-label={status.name}>
      <header className="flex items-center gap-2 px-3 py-2.5">
        <span
          className="size-2 rounded-full"
          style={{ backgroundColor: status.color ?? "#94a3b8" }}
          aria-hidden
        />
        <h3 className="text-sm font-medium">{status.name}</h3>
        <span className="ml-auto rounded-full bg-background px-1.5 text-xs tabular-nums text-muted-foreground">
          {tasks.length}
        </span>
      </header>
      <div
        ref={setNodeRef}
        className={cn(
          "max-h-[calc(100vh-16rem)] min-h-24 flex-1 space-y-2 overflow-y-auto px-2 pb-2",
          isOver && "rounded-b-xl ring-2 ring-inset ring-primary/40",
        )}
      >
        <SortableContext items={shown.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-2">
            {shown.map((t) => (
              <SortableKanbanCard key={t.id} task={t} projectId={projectId} draggable={canMove(t)} />
            ))}
          </ul>
        </SortableContext>
        {tasks.length === 0 && (
          <p className="px-1 py-6 text-center text-xs text-muted-foreground">No tasks</p>
        )}
        {overflow > 0 && (
          <p className="px-1 pt-1 text-center text-xs text-muted-foreground">+{overflow} more</p>
        )}
      </div>
    </section>
  );
}
