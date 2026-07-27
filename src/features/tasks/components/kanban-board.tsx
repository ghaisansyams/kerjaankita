"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { moveTask } from "../actions";
import { fetchBoardTasks, type BoardTask } from "../queries";
import { KanbanColumn } from "./kanban-column";
import { KanbanCardBody } from "./kanban-card";

export type BoardStatus = {
  id: string;
  name: string;
  color: string | null;
  category: string;
};

export function KanbanBoard({
  projectId,
  statuses,
  initialTasks,
  currentUserId,
  canAny,
  canOwn,
}: {
  projectId: string;
  statuses: BoardStatus[];
  initialTasks: BoardTask[];
  currentUserId: string;
  canAny: boolean;
  canOwn: boolean;
}) {
  const [tasks, setTasks] = useState<BoardTask[]>(initialTasks);
  const [activeId, setActiveId] = useState<string | null>(null);
  const draggingRef = useRef(false);
  // True while a move mutation is in flight, so a concurrent realtime event
  // can't refetch stale server state over our optimistic update (QA RC1 · M2).
  const mutatingRef = useRef(false);

  // Re-seed when the server sends a fresh snapshot (revalidation) — never mid-drag.
  useEffect(() => {
    if (!draggingRef.current) setTasks(initialTasks);
  }, [initialTasks]);

  const refetch = useCallback(async () => {
    try {
      setTasks(await fetchBoardTasks(projectId));
    } catch {
      /* keep the current board on a transient fetch failure */
    }
  }, [projectId]);

  // Realtime board sync: any task change in this project → reconcile from server
  // (debounced, and skipped while the local user is mid-drag).
  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase
      .channel(`board:${projectId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks", filter: `project_id=eq.${projectId}` },
        () => {
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => {
            if (!draggingRef.current && !mutatingRef.current) refetch();
          }, 250);
        },
      )
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [projectId, refetch]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const canMove = useCallback(
    (t: BoardTask) => canAny || (canOwn && t.assignee_id === currentUserId),
    [canAny, canOwn, currentUserId],
  );

  const columns = useMemo(() => {
    const byStatus = new Map<string, BoardTask[]>();
    for (const s of statuses) byStatus.set(s.id, []);
    const orphans: BoardTask[] = [];
    for (const t of tasks) {
      const bucket = t.status_id ? byStatus.get(t.status_id) : undefined;
      if (bucket) bucket.push(t);
      else orphans.push(t);
    }
    for (const arr of byStatus.values()) {
      arr.sort((a, b) => a.position - b.position || a.number - b.number);
    }
    return { byStatus, orphans };
  }, [statuses, tasks]);

  const activeTask = activeId ? (tasks.find((t) => t.id === activeId) ?? null) : null;

  function onDragStart(e: DragStartEvent) {
    draggingRef.current = true;
    setActiveId(String(e.active.id));
  }

  function onDragCancel() {
    draggingRef.current = false;
    setActiveId(null);
  }

  async function onDragEnd(e: DragEndEvent) {
    draggingRef.current = false;
    setActiveId(null);
    const { active, over } = e;
    if (!over || over.id === active.id) return;

    const moved = tasks.find((t) => t.id === active.id);
    if (!moved) return;

    // Resolve the target column (status) and where in it the card lands.
    const overId = String(over.id);
    let targetStatus: string;
    let overTaskId: string | null = null;
    if (overId.startsWith("col:")) {
      targetStatus = overId.slice(4);
    } else {
      overTaskId = overId;
      const overTask = tasks.find((t) => t.id === overId);
      if (!overTask?.status_id) return;
      targetStatus = overTask.status_id;
    }

    const colItems = (columns.byStatus.get(targetStatus) ?? []).filter((t) => t.id !== active.id);
    let insertIndex = colItems.length;
    if (overTaskId) {
      const idx = colItems.findIndex((t) => t.id === overTaskId);
      insertIndex = idx === -1 ? colItems.length : idx;
    }

    const before = colItems[insertIndex - 1]?.position;
    const after = colItems[insertIndex]?.position;
    let position: number;
    if (before == null && after == null) position = 1;
    else if (before == null) position = (after as number) - 1;
    else if (after == null) position = (before as number) + 1;
    else position = (before + after) / 2;

    if (moved.status_id === targetStatus && moved.position === position) return;

    const snapshot = tasks;
    setTasks((ts) =>
      ts.map((t) => (t.id === active.id ? { ...t, status_id: targetStatus, position } : t)),
    );

    mutatingRef.current = true;
    const res = await moveTask({ id: String(active.id), statusId: targetStatus, position });
    mutatingRef.current = false;
    if (!res?.ok) {
      setTasks(snapshot); // rollback
      toast.error(res?.error.message ?? "Couldn't move this task.");
    }
    // Reconcile once now that the write has committed — picks up our move plus
    // any realtime events that were suppressed while the mutation was in flight.
    refetch();
  }

  if (statuses.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        This project has no workflow columns yet.
      </p>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      <div className="flex gap-3 overflow-x-auto pb-2">
        {statuses.map((s) => (
          <KanbanColumn
            key={s.id}
            status={s}
            projectId={projectId}
            tasks={columns.byStatus.get(s.id) ?? []}
            canMove={canMove}
          />
        ))}
      </div>
      {columns.orphans.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          {columns.orphans.length} task(s) sit outside this workflow and aren&apos;t shown on the board.
        </p>
      )}
      <DragOverlay>
        {activeTask && (
          <div className="w-72">
            <KanbanCardBody task={activeTask} dragging />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
