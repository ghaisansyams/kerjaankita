"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { ActionResult } from "@/types/action";
import { createTask, moveTask, updateTaskProgress } from "../actions";
import {
  createBoardColumn,
  deleteBoardColumn,
  reorderBoardColumns,
  setCompletedBoardColumn,
  setDefaultBoardColumn,
  updateBoardColumn,
} from "@/features/workflow/actions";
import { fetchBoardTasks, type BoardTask } from "../queries";
import { KanbanColumn, type ColumnHandlers } from "./kanban-column";
import { KanbanCardBody } from "./kanban-card";
import { BoardDrawerHost } from "./board-drawer-host";
import { AddColumn } from "./add-column";
import { ImportTasksDialog } from "@/features/import/components/import-tasks-dialog";
import { JiraImportDialog } from "@/features/import/components/jira-import-dialog";
import { AiImportDialog } from "@/features/import/components/ai-import-dialog";
import { DeleteColumnDialog, type DeleteTarget } from "./delete-column-dialog";
import { RoadmapView } from "./roadmap-view";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LayoutGrid, GitBranch, FileDown } from "lucide-react";

export type BoardStatus = {
  id: string;
  name: string;
  color: string | null;
  category: string;
  position: number;
  isInitial: boolean;
  isFinal: boolean;
  weight: number;
};

export function KanbanBoard({
  projectId,
  projectName,
  workflowId,
  statuses,
  initialTasks,
  currentUserId,
  canAny,
  canOwn,
  canManageWorkflow,
  canCreate,
  roadmaps,
  modules,
  initialTaskId = null,
}: {
  projectId: string;
  projectName?: string;
  workflowId: string;
  statuses: BoardStatus[];
  initialTasks: BoardTask[];
  currentUserId: string;
  canAny: boolean;
  canOwn: boolean;
  canManageWorkflow: boolean;
  canCreate: boolean;
  roadmaps: { id: string; name: string }[];
  modules: { id: string; name: string; roadmapId: string | null }[];
  initialTaskId?: string | null;
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState<BoardTask[]>(initialTasks);
  const [cols, setCols] = useState<BoardStatus[]>(statuses);
  const [view, setView] = useState<"board" | "roadmap">("board");
  const [roadmapFilter, setRoadmapFilter] = useState<string>("all");
  const [moduleFilter, setModuleFilter] = useState<string>("all");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<"card" | "column">("card");
  const [openTaskId, setOpenTaskId] = useState<string | null>(initialTaskId);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  const draggingRef = useRef(false);
  const mutatingRef = useRef(false);
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  // Re-seed from the server snapshot on revalidation — never mid-drag.
  useEffect(() => {
    if (!draggingRef.current) setTasks(initialTasks);
  }, [initialTasks]);
  useEffect(() => {
    if (!draggingRef.current) setCols(statuses);
  }, [statuses]);

  const refetch = useCallback(async () => {
    try {
      setTasks(await fetchBoardTasks(projectId));
    } catch {
      /* keep the current board on a transient fetch failure */
    }
  }, [projectId]);

  // Realtime: task changes reconcile the cards; workflow_statuses changes
  // (another manager editing columns) re-fetch the whole board.
  useEffect(() => {
    const supabase = createClient();
    let t1: ReturnType<typeof setTimeout> | null = null;
    let t2: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase
      .channel(`board:${projectId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks", filter: `project_id=eq.${projectId}` },
        () => {
          if (t1) clearTimeout(t1);
          t1 = setTimeout(() => {
            if (!draggingRef.current && !mutatingRef.current) refetch();
          }, 250);
        },
      );
    if (workflowId) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "workflow_statuses", filter: `workflow_id=eq.${workflowId}` },
        () => {
          if (t2) clearTimeout(t2);
          t2 = setTimeout(() => {
            if (!draggingRef.current && !mutatingRef.current) router.refresh();
          }, 300);
        },
      );
    }
    channel.subscribe();
    return () => {
      if (t1) clearTimeout(t1);
      if (t2) clearTimeout(t2);
      supabase.removeChannel(channel);
    };
  }, [projectId, workflowId, refetch, router]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const canMove = useCallback(
    (t: BoardTask) => canAny || (canOwn && t.assignee_id === currentUserId),
    [canAny, canOwn, currentUserId],
  );

  const openTask = useCallback((taskId: string) => {
    setOpenTaskId(taskId);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("task", taskId);
      window.history.replaceState(null, "", url);
    }
  }, []);
  const closeTask = useCallback(() => {
    setOpenTaskId(null);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("task");
      window.history.replaceState(null, "", url);
    }
  }, []);

  const setProgress = useCallback(
    async (id: string, value: number): Promise<boolean> => {
      const snapshot = tasksRef.current;
      setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, progress: value } : t)));
      mutatingRef.current = true;
      const res = await updateTaskProgress({ id, progress: value });
      mutatingRef.current = false;
      if (!res?.ok) {
        setTasks(snapshot);
        toast.error(res?.error.message ?? "Couldn't update progress.");
        return false;
      }
      refetch();
      return true;
    },
    [refetch],
  );

  // Column mutation runner: optimistic state is applied by the caller; this
  // fires the action, surfaces errors, and reconciles with the server.
  const mutate = useCallback(
    async (fn: () => Promise<ActionResult>) => {
      mutatingRef.current = true;
      const res = await fn();
      mutatingRef.current = false;
      if (!res?.ok) toast.error(res?.error.message ?? "Something went wrong.");
      router.refresh();
    },
    [router],
  );

  const handlers: ColumnHandlers = useMemo(
    () => ({
      onOpen: openTask,
      onSetProgress: setProgress,
      onAddTask: async (statusId, title) => {
        mutatingRef.current = true;
        const res = await createTask({ projectId, title, statusId });
        mutatingRef.current = false;
        router.refresh();
        if (!res?.ok) {
          toast.error(res?.error.message ?? "Couldn't add task.");
          return false;
        }
        return true;
      },
      onRename: (id, name) => {
        setCols((cs) => cs.map((c) => (c.id === id ? { ...c, name } : c)));
        mutate(() => updateBoardColumn({ projectId, statusId: id, name }));
      },
      onRecolor: (id, color) => {
        setCols((cs) => cs.map((c) => (c.id === id ? { ...c, color } : c)));
        mutate(() => updateBoardColumn({ projectId, statusId: id, color }));
      },
      onWeight: (id, weight) => {
        setCols((cs) => cs.map((c) => (c.id === id ? { ...c, weight } : c)));
        mutate(() => updateBoardColumn({ projectId, statusId: id, weight }));
      },
      onSetDefault: (id) => {
        setCols((cs) => cs.map((c) => ({ ...c, isInitial: c.id === id })));
        mutate(() => setDefaultBoardColumn({ projectId, statusId: id }));
      },
      onToggleCompleted: (id, next) => {
        setCols((cs) =>
          cs.map((c) => {
            if (c.id === id) return { ...c, isFinal: next, weight: next ? 100 : c.weight, category: next ? "done" : "in_progress" };
            return next && (c.isFinal || c.category === "done") ? { ...c, isFinal: false, category: "in_progress" } : c;
          }),
        );
        mutate(() => setCompletedBoardColumn({ projectId, statusId: id, completed: next }));
      },
      onRequestDelete: (status, taskCount) => setDeleteTarget({ id: status.id, name: status.name, taskCount }),
    }),
    [openTask, setProgress, projectId, router, mutate],
  );

  const addColumn = useCallback(
    (name: string) => mutate(() => createBoardColumn({ projectId, workflowId, name })),
    [projectId, workflowId, mutate],
  );

  const confirmDelete = useCallback(
    (reassignTo: string | null) => {
      const target = deleteTarget;
      setDeleteTarget(null);
      if (!target) return;
      if (reassignTo) setTasks((ts) => ts.map((t) => (t.status_id === target.id ? { ...t, status_id: reassignTo } : t)));
      setCols((cs) => cs.filter((c) => c.id !== target.id));
      mutate(() => deleteBoardColumn({ projectId, statusId: target.id, reassignTo }));
    },
    [deleteTarget, projectId, mutate],
  );

  // Roadmap/Module filters apply to BOTH the Kanban and the Roadmap view.
  const shownTasks = useMemo(
    () =>
      tasks.filter(
        (t) =>
          (roadmapFilter === "all" || t.roadmap_id === roadmapFilter) &&
          (moduleFilter === "all" || t.module_id === moduleFilter),
      ),
    [tasks, roadmapFilter, moduleFilter],
  );

  const columns = useMemo(() => {
    const byStatus = new Map<string, BoardTask[]>();
    for (const s of cols) byStatus.set(s.id, []);
    const orphans: BoardTask[] = [];
    for (const t of shownTasks) {
      const bucket = t.status_id ? byStatus.get(t.status_id) : undefined;
      if (bucket) bucket.push(t);
      else orphans.push(t);
    }
    for (const arr of byStatus.values()) arr.sort((a, b) => a.position - b.position || a.number - b.number);
    return { byStatus, orphans };
  }, [cols, shownTasks]);

  const moduleOptions = useMemo(
    () => (roadmapFilter === "all" ? modules : modules.filter((m) => m.roadmapId === roadmapFilter)),
    [modules, roadmapFilter],
  );

  const activeTask = activeType === "card" && activeId ? (tasks.find((t) => t.id === activeId) ?? null) : null;
  const activeCol = activeType === "column" && activeId ? (cols.find((c) => c.id === activeId) ?? null) : null;

  function resolveColumn(overId: string, overType: string | undefined): string | null {
    if (overType === "column") return overId;
    if (overId.startsWith("col:")) return overId.slice(4);
    return tasks.find((t) => t.id === overId)?.status_id ?? null;
  }

  function onDragStart(e: DragStartEvent) {
    draggingRef.current = true;
    setActiveType(e.active.data.current?.type === "column" ? "column" : "card");
    setActiveId(String(e.active.id));
  }
  function onDragCancel() {
    draggingRef.current = false;
    setActiveId(null);
  }

  async function onDragEnd(e: DragEndEvent) {
    draggingRef.current = false;
    const { active, over } = e;
    // Derive the drag type from the event, not React state — the state update
    // from onDragStart isn't visible in this drag's handler closure.
    const type = active.data.current?.type === "column" ? "column" : "card";
    setActiveId(null);
    if (!over || over.id === active.id) return;

    // ---- Column reorder ----
    if (type === "column") {
      const target = resolveColumn(String(over.id), over.data.current?.type as string | undefined);
      if (!target || target === active.id) return;
      const from = cols.findIndex((c) => c.id === active.id);
      const to = cols.findIndex((c) => c.id === target);
      if (from < 0 || to < 0) return;
      const next = arrayMove(cols, from, to);
      setCols(next);
      mutate(() => reorderBoardColumns({ projectId, workflowId, ids: next.map((c) => c.id) }));
      return;
    }

    // ---- Card move ----
    const moved = tasks.find((t) => t.id === active.id);
    if (!moved) return;
    const overId = String(over.id);
    const targetStatus = resolveColumn(overId, over.data.current?.type as string | undefined);
    if (!targetStatus) return;
    const overTaskId = overId.startsWith("col:") || over.data.current?.type === "column" ? null : overId;

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
    setTasks((ts) => ts.map((t) => (t.id === active.id ? { ...t, status_id: targetStatus, position } : t)));
    mutatingRef.current = true;
    const res = await moveTask({ id: String(active.id), statusId: targetStatus, position });
    mutatingRef.current = false;
    if (!res?.ok) {
      setTasks(snapshot);
      toast.error(res?.error.message ?? "Couldn't move this task.");
    }
    refetch();
  }

  if (cols.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        This board has no columns yet.
        {canManageWorkflow && <div className="mt-3 flex justify-center"><AddColumn onCreate={addColumn} /></div>}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {cols.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {roadmaps.length > 0 && (
            <>
              <div className="flex overflow-hidden rounded-md border">
                <button
                  type="button"
                  onClick={() => setView("board")}
                  className={`flex items-center gap-1 px-2.5 py-1 text-xs ${view === "board" ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted/50"}`}
                >
                  <LayoutGrid className="size-3.5" /> Board
                </button>
                <button
                  type="button"
                  onClick={() => setView("roadmap")}
                  className={`flex items-center gap-1 border-l px-2.5 py-1 text-xs ${view === "roadmap" ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted/50"}`}
                >
                  <GitBranch className="size-3.5" /> Roadmap
                </button>
              </div>
              <Select
                value={roadmapFilter}
                onValueChange={(v) => {
                  setRoadmapFilter(v);
                  setModuleFilter("all");
                }}
              >
                <SelectTrigger className="h-8 w-36"><SelectValue placeholder="Roadmap" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua roadmap</SelectItem>
                  {roadmaps.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={moduleFilter} onValueChange={setModuleFilter}>
                <SelectTrigger className="h-8 w-36"><SelectValue placeholder="Modul" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua modul</SelectItem>
                  {moduleOptions.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}
          <div className="ml-auto flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                window.open(`/print/report/${projectId}`, "_blank", "noopener,noreferrer")
              }
            >
              <FileDown className="size-4" /> Export Report
            </Button>
            {canCreate && (
              <>
                <ImportTasksDialog
                  projectId={projectId}
                  statuses={cols.map((c) => ({ id: c.id, name: c.name, color: c.color }))}
                  onDone={refetch}
                />
                <JiraImportDialog
                  projectId={projectId}
                  statuses={cols.map((c) => ({ id: c.id, name: c.name, color: c.color }))}
                  onDone={refetch}
                />
                <AiImportDialog
                  onDone={refetch}
                  targetProjectId={projectId}
                  targetProjectName={projectName}
                />
              </>
            )}
          </div>
        </div>
      )}
      {view === "board" ? (
        <DndContext
          id="flowdesk-board"
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={onDragCancel}
        >
          <div className="flex items-start gap-3 overflow-x-auto pb-2">
            <SortableContext items={cols.map((c) => c.id)} strategy={horizontalListSortingStrategy}>
              {cols.map((s) => (
                <KanbanColumn
                  key={s.id}
                  status={s}
                  tasks={columns.byStatus.get(s.id) ?? []}
                  canMove={canMove}
                  canManage={canManageWorkflow}
                  handlers={handlers}
                />
              ))}
            </SortableContext>
            {canManageWorkflow && <AddColumn onCreate={addColumn} />}
          </div>

          {columns.orphans.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              {columns.orphans.length} task(s) sit outside this workflow and aren&apos;t shown on the board.
            </p>
          )}

          <DragOverlay>
            {activeTask && (
              <div className="w-[300px] rotate-2">
                <KanbanCardBody task={activeTask} dragging />
              </div>
            )}
            {activeCol && (
              <div className="w-[300px] rotate-1 overflow-hidden rounded-xl border bg-card shadow-xl">
                <div className="h-0.5 w-full" style={{ backgroundColor: activeCol.color ?? "#94a3b8" }} />
                <div className="flex items-center gap-2 px-2.5 py-2">
                  <span className="size-2 rounded-full" style={{ backgroundColor: activeCol.color ?? "#94a3b8" }} />
                  <span className="text-sm font-semibold">{activeCol.name}</span>
                  <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                    {columns.byStatus.get(activeCol.id)?.length ?? 0}
                  </span>
                </div>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      ) : (
        <RoadmapView
          roadmaps={roadmaps}
          modules={modules}
          tasks={shownTasks}
          statuses={cols.map((c) => ({ id: c.id, name: c.name, color: c.color }))}
          onOpenTask={openTask}
        />
      )}

      <BoardDrawerHost projectId={projectId} taskId={openTaskId} onClose={closeTask} />

      <DeleteColumnDialog
        target={deleteTarget}
        destinations={cols.filter((c) => c.id !== deleteTarget?.id).map((c) => ({ id: c.id, name: c.name }))}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
