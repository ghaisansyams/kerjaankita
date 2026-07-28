"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { cn } from "@/lib/utils";
import { SortableKanbanCard } from "./kanban-card";
import type { BoardStatus } from "./kanban-board";
import type { BoardTask } from "../board-shared";

const CAP = 100;

export function KanbanColumn({
  status,
  tasks,
  canMove,
  onOpen,
  onSetProgress,
}: {
  status: BoardStatus;
  tasks: BoardTask[];
  canMove: (t: BoardTask) => boolean;
  onOpen: (taskId: string) => void;
  onSetProgress: (id: string, value: number) => Promise<boolean>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${status.id}`, data: { statusId: status.id } });
  const shown = tasks.slice(0, CAP);
  const overflow = tasks.length - shown.length;
  const accent = status.color ?? "#94a3b8";

  return (
    <section className="flex w-[300px] shrink-0 flex-col overflow-hidden rounded-xl bg-muted/40" aria-label={status.name}>
      {/* thin status-colour accent — the only colour on the surface */}
      <div className="h-0.5 w-full" style={{ backgroundColor: accent }} aria-hidden />
      <header className="flex items-center gap-2 px-3 py-2.5">
        <span className="size-2 rounded-full" style={{ backgroundColor: accent }} aria-hidden />
        <h3 className="text-sm font-semibold text-foreground">{status.name}</h3>
        <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-background px-1.5 text-xs font-medium tabular-nums text-muted-foreground">
          {tasks.length}
        </span>
      </header>

      <div
        ref={setNodeRef}
        className={cn(
          "min-h-24 max-h-[calc(100vh-16rem)] flex-1 space-y-2 overflow-y-auto px-2 pb-2 transition-colors",
          isOver && "rounded-b-xl bg-primary/[0.06] ring-2 ring-inset ring-primary/40",
        )}
      >
        <SortableContext items={shown.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-2">
            {shown.map((t) => (
              <SortableKanbanCard
                key={t.id}
                task={t}
                draggable={canMove(t)}
                editable={canMove(t)}
                onOpen={onOpen}
                onSetProgress={onSetProgress}
              />
            ))}
          </ul>
        </SortableContext>

        {tasks.length === 0 && (
          <div className="grid place-items-center rounded-lg border border-dashed border-border/60 py-8 text-center text-xs text-muted-foreground">
            Drop tasks here
          </div>
        )}
        {overflow > 0 && (
          <p className="px-1 pt-1 text-center text-xs text-muted-foreground">+{overflow} more</p>
        )}
      </div>
    </section>
  );
}
