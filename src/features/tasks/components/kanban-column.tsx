"use client";

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { SortableKanbanCard } from "./kanban-card";
import { ColumnMenu } from "./column-menu";
import { ColumnAddTask } from "./column-add-task";
import type { BoardStatus } from "./kanban-board";
import type { BoardTask } from "../board-shared";

const CAP = 100;

export type ColumnHandlers = {
  onOpen: (taskId: string) => void;
  onSetProgress: (id: string, value: number) => Promise<boolean>;
  onAddTask: (statusId: string, title: string) => Promise<boolean>;
  onRename: (statusId: string, name: string) => void;
  onRecolor: (statusId: string, color: string) => void;
  onWeight: (statusId: string, weight: number) => void;
  onSetDefault: (statusId: string) => void;
  onToggleCompleted: (statusId: string, next: boolean) => void;
  onRequestDelete: (status: BoardStatus, taskCount: number) => void;
};

export function KanbanColumn({
  status,
  tasks,
  canMove,
  canManage,
  handlers,
}: {
  status: BoardStatus;
  tasks: BoardTask[];
  canMove: (t: BoardTask) => boolean;
  canManage: boolean;
  handlers: ColumnHandlers;
}) {
  const droppable = useDroppable({ id: `col:${status.id}`, data: { statusId: status.id } });
  const sortable = useSortable({ id: status.id, data: { type: "column" }, disabled: !canManage });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(status.name);

  const shown = tasks.slice(0, CAP);
  const overflow = tasks.length - shown.length;
  const accent = status.color ?? "#94a3b8";
  const style = {
    transform: CSS.Translate.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0.4 : 1,
  };

  function commitRename() {
    const n = draft.trim();
    setEditing(false);
    if (n && n !== status.name) handlers.onRename(status.id, n);
    else setDraft(status.name);
  }

  return (
    <section
      ref={sortable.setNodeRef}
      style={style}
      className={cn(
        "group/col flex w-[300px] shrink-0 flex-col overflow-hidden rounded-xl bg-muted/40",
        sortable.isDragging && "ring-2 ring-primary/40",
      )}
      aria-label={status.name}
    >
      <div className="h-0.5 w-full" style={{ backgroundColor: accent }} aria-hidden />
      <header className="flex items-center gap-1.5 px-2.5 py-2">
        {canManage && (
          <button
            type="button"
            {...sortable.attributes}
            {...sortable.listeners}
            aria-label="Reorder column"
            className="-ml-1 cursor-grab touch-none text-muted-foreground/40 transition-colors hover:text-foreground active:cursor-grabbing"
          >
            <GripVertical className="size-3.5" />
          </button>
        )}
        <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: accent }} aria-hidden />

        {editing ? (
          // eslint-disable-next-line jsx-a11y/no-autofocus
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") {
                setEditing(false);
                setDraft(status.name);
              }
            }}
            maxLength={40}
            className="min-w-0 flex-1 rounded border bg-background px-1.5 py-0.5 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        ) : (
          <h3 className="truncate text-sm font-semibold text-foreground">{status.name}</h3>
        )}

        {status.isFinal && !editing && (
          <span className="rounded bg-emerald-100 px-1 text-[9px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
            Done
          </span>
        )}

        <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-background px-1.5 text-xs font-medium tabular-nums text-muted-foreground">
          {tasks.length}
        </span>

        {canManage && !editing && (
          <>
            <ColumnAddTask onAdd={(t) => handlers.onAddTask(status.id, t)} />
            <ColumnMenu
              color={accent}
              weight={status.weight}
              isDefault={status.isInitial}
              isCompleted={status.isFinal}
              onStartRename={() => {
                setDraft(status.name);
                setEditing(true);
              }}
              onRecolor={(c) => handlers.onRecolor(status.id, c)}
              onWeight={(w) => handlers.onWeight(status.id, w)}
              onSetDefault={() => handlers.onSetDefault(status.id)}
              onToggleCompleted={(next) => handlers.onToggleCompleted(status.id, next)}
              onDelete={() => handlers.onRequestDelete(status, tasks.length)}
            />
          </>
        )}
      </header>

      <div
        ref={droppable.setNodeRef}
        className={cn(
          "min-h-24 max-h-[calc(100vh-16rem)] flex-1 space-y-2 overflow-y-auto px-2 pb-2 transition-colors",
          droppable.isOver && "rounded-b-xl bg-primary/[0.06] ring-2 ring-inset ring-primary/40",
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
                onOpen={handlers.onOpen}
                onSetProgress={handlers.onSetProgress}
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
