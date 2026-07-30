"use client";

import { useMemo, useState } from "react";
import { ChevronRight, ListChecks, Map as MapIcon, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BoardTask } from "../board-shared";

type Named = { id: string; name: string };
type ModuleRow = { id: string; name: string; roadmapId: string | null };
type StatusRow = { id: string; name: string; color: string | null };

const UNGROUPED = "__ungrouped__";
const NO_MODULE = "__no_module__";

/**
 * "Group by Roadmap" + hierarchy navigation. Read-only grouping of the SAME
 * tasks (workflow status stays on each card as a chip) — the Kanban workflow is
 * untouched. Clicking a feature opens its task drawer.
 */
export function RoadmapView({
  roadmaps,
  modules,
  tasks,
  statuses,
  onOpenTask,
}: {
  roadmaps: Named[];
  modules: ModuleRow[];
  tasks: BoardTask[];
  statuses: StatusRow[];
  onOpenTask: (taskId: string) => void;
}) {
  const statusById = useMemo(() => new Map(statuses.map((s) => [s.id, s])), [statuses]);

  // roadmapId -> moduleId -> tasks
  const grouped = useMemo(() => {
    const byRoadmap = new Map<string, Map<string, BoardTask[]>>();
    const ensure = (rid: string, mid: string) => {
      if (!byRoadmap.has(rid)) byRoadmap.set(rid, new Map());
      const mods = byRoadmap.get(rid)!;
      if (!mods.has(mid)) mods.set(mid, []);
      return mods.get(mid)!;
    };
    for (const t of tasks) {
      const rid = t.roadmap_id ?? UNGROUPED;
      const mid = t.module_id ?? NO_MODULE;
      ensure(rid, mid).push(t);
    }
    for (const mods of byRoadmap.values())
      for (const arr of mods.values()) arr.sort((a, b) => a.number - b.number);
    return byRoadmap;
  }, [tasks]);

  const orderedRoadmaps: Named[] = useMemo(() => {
    const list = [...roadmaps];
    if (grouped.has(UNGROUPED)) list.push({ id: UNGROUPED, name: "Tanpa roadmap" });
    return list.filter((r) => grouped.has(r.id));
  }, [roadmaps, grouped]);

  const modulesByRoadmap = useMemo(() => {
    const m = new Map<string, ModuleRow[]>();
    for (const mod of modules) {
      const rid = mod.roadmapId ?? UNGROUPED;
      if (!m.has(rid)) m.set(rid, []);
      m.get(rid)!.push(mod);
    }
    return m;
  }, [modules]);

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggle = (k: string) => setCollapsed((c) => ({ ...c, [k]: !c[k] }));

  if (orderedRoadmaps.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
        Belum ada roadmap/modul di project ini. Impor dokumen lewat <span className="font-medium">AI Project Import</span>,
        atau task belum dikaitkan ke roadmap.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {orderedRoadmaps.map((rm) => {
        const mods = grouped.get(rm.id)!;
        const total = [...mods.values()].reduce((n, a) => n + a.length, 0);
        // modules that have tasks, in defined order, plus a no-module bucket
        const modRows = (modulesByRoadmap.get(rm.id) ?? []).filter((m) => mods.has(m.id));
        const noModule = mods.get(NO_MODULE) ?? [];
        const rCollapsed = collapsed[rm.id];
        return (
          <section key={rm.id} className="overflow-hidden rounded-lg border">
            <button
              type="button"
              onClick={() => toggle(rm.id)}
              className="flex w-full items-center gap-2 bg-muted/50 px-3 py-2 text-left hover:bg-muted"
            >
              <ChevronRight className={cn("size-4 shrink-0 transition-transform", !rCollapsed && "rotate-90")} />
              <MapIcon className="size-4 shrink-0 text-indigo-500" />
              <span className="font-semibold">{rm.name}</span>
              <span className="ml-auto text-xs tabular-nums text-muted-foreground">{total} feature</span>
            </button>

            {!rCollapsed && (
              <div className="space-y-2 p-2">
                {[...modRows.map((m) => ({ id: m.id, name: m.name })), ...(noModule.length ? [{ id: NO_MODULE, name: "Tanpa modul" }] : [])].map(
                  (mod) => {
                    const list = mods.get(mod.id) ?? [];
                    if (list.length === 0) return null;
                    const key = `${rm.id}:${mod.id}`;
                    const mCollapsed = collapsed[key];
                    return (
                      <div key={mod.id} className="rounded-md border">
                        <button
                          type="button"
                          onClick={() => toggle(key)}
                          className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left hover:bg-muted/40"
                        >
                          <ChevronRight className={cn("size-3.5 shrink-0 transition-transform", !mCollapsed && "rotate-90")} />
                          <Layers className="size-3.5 shrink-0 text-muted-foreground" />
                          <span className="text-sm font-medium">{mod.name}</span>
                          <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">{list.length}</span>
                        </button>
                        {!mCollapsed && (
                          <ul className="divide-y">
                            {list.map((t) => {
                              const st = t.status_id ? statusById.get(t.status_id) : undefined;
                              return (
                                <li key={t.id}>
                                  <button
                                    type="button"
                                    onClick={() => onOpenTask(t.id)}
                                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-muted/40"
                                  >
                                    <span className="w-10 shrink-0 text-[11px] tabular-nums text-muted-foreground">
                                      #{t.number}
                                    </span>
                                    <span className="min-w-0 flex-1 truncate text-sm">{t.title}</span>
                                    {t.checklist_total > 0 && (
                                      <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                                        <ListChecks className="size-3.5" />
                                        {t.checklist_done}/{t.checklist_total}
                                      </span>
                                    )}
                                    {st && (
                                      <span
                                        className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
                                        style={{
                                          backgroundColor: (st.color ?? "#94a3b8") + "22",
                                          color: st.color ?? "#64748b",
                                        }}
                                      >
                                        {st.name}
                                      </span>
                                    )}
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    );
                  },
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
