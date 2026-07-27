"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfWeek,
  format,
  isToday,
  isWeekend,
  max as maxDate,
  min as minDate,
  parseISO,
  startOfDay,
  startOfWeek,
} from "date-fns";
import { cn } from "@/lib/utils";
import { getInitials } from "@/utils/format";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type TimelineTaskVM = {
  id: string;
  title: string;
  projectId: string;
  projectName: string;
  projectColor: string | null;
  workspaceId: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  assigneeAvatar: string | null;
  start: string; // ISO date
  end: string; // ISO date
  progress: number;
  isBlocked: boolean;
  estimatedHours: number | null;
};

type Option = { id: string; name: string };
type ProjectOption = Option & { workspaceId: string | null };

const LABEL_W = 184;
const ROW_H = 30;
const BAR_H = 22;
const HEADER_H = 44;
const MAX_DAYS = 200;
const ALL = "all";

export function TimelineView({
  tasks,
  workspaces,
  projects,
  members,
}: {
  tasks: TimelineTaskVM[];
  workspaces: Option[];
  projects: ProjectOption[];
  members: Option[];
}) {
  const [zoom, setZoom] = useState<"day" | "week">("day");
  const [ws, setWs] = useState(ALL);
  const [proj, setProj] = useState(ALL);
  const [assignee, setAssignee] = useState(ALL);
  const scrollRef = useRef<HTMLDivElement>(null);

  const dayWidth = zoom === "day" ? 40 : 16;

  const filtered = useMemo(
    () =>
      tasks.filter(
        (t) =>
          (ws === ALL || t.workspaceId === ws) &&
          (proj === ALL || t.projectId === proj) &&
          (assignee === ALL || t.assigneeId === assignee),
      ),
    [tasks, ws, proj, assignee],
  );

  const projectChoices = useMemo(
    () => (ws === ALL ? projects : projects.filter((p) => p.workspaceId === ws)),
    [projects, ws],
  );

  const { rangeStart, totalDays } = useMemo(() => {
    const today = startOfDay(new Date());
    const ds = filtered.flatMap((t) => [parseISO(t.start), parseISO(t.end)]);
    const lo = startOfWeek(ds.length ? minDate([...ds, today]) : today, { weekStartsOn: 1 });
    let hi = endOfWeek(ds.length ? maxDate([...ds, today]) : addDays(today, 14), {
      weekStartsOn: 1,
    });
    if (differenceInCalendarDays(hi, lo) > MAX_DAYS) hi = addDays(lo, MAX_DAYS);
    return { rangeStart: lo, totalDays: differenceInCalendarDays(hi, lo) + 1 };
  }, [filtered]);

  const offset = (iso: string) => differenceInCalendarDays(startOfDay(parseISO(iso)), rangeStart);
  const gridWidth = totalDays * dayWidth;
  const todayOffset = differenceInCalendarDays(startOfDay(new Date()), rangeStart);

  // Group by assignee → pack overlapping bars into stacked lanes.
  const groups = useMemo(() => {
    const byAssignee = new Map<string, TimelineTaskVM[]>();
    for (const t of filtered) {
      const key = t.assigneeId ?? "__none__";
      (byAssignee.get(key) ?? byAssignee.set(key, []).get(key)!).push(t);
    }
    const out = [...byAssignee.entries()].map(([key, items]) => {
      const packed = items
        .map((t) => ({ t, s: offset(t.start), e: offset(t.end) }))
        .sort((a, b) => a.s - b.s || a.e - b.e);
      const laneEnds: number[] = [];
      const bars = packed.map((it) => {
        let lane = laneEnds.findIndex((end) => it.s > end);
        if (lane === -1) {
          lane = laneEnds.length;
          laneEnds.push(it.e);
        } else laneEnds[lane] = it.e;
        return { ...it, lane };
      });
      const hours = items.reduce((sum, t) => sum + (t.estimatedHours ?? 0), 0);
      return {
        key,
        name: key === "__none__" ? "Unassigned" : (items[0].assigneeName ?? "Member"),
        avatar: items[0].assigneeAvatar,
        count: items.length,
        hours,
        laneCount: Math.max(1, laneEnds.length),
        bars,
      };
    });
    out.sort((a, b) =>
      a.key === "__none__" ? 1 : b.key === "__none__" ? -1 : a.name.localeCompare(b.name),
    );
    return out;
  }, [filtered, rangeStart, dayWidth]); // eslint-disable-line react-hooks/exhaustive-deps

  const header = useMemo(() => {
    if (zoom === "day") {
      return eachDayOfInterval({ start: rangeStart, end: addDays(rangeStart, totalDays - 1) }).map(
        (d) => ({
          left: differenceInCalendarDays(d, rangeStart) * dayWidth,
          width: dayWidth,
          top: format(d, "EEEEE"),
          bottom: format(d, "d"),
          weekend: isWeekend(d),
          today: isToday(d),
        }),
      );
    }
    const cells = [];
    for (let i = 0; i < totalDays; i += 7) {
      const d = addDays(rangeStart, i);
      cells.push({
        left: i * dayWidth,
        width: 7 * dayWidth,
        top: format(d, "MMM"),
        bottom: format(d, "d"),
        weekend: false,
        today: todayOffset >= i && todayOffset < i + 7,
      });
    }
    return cells;
  }, [zoom, rangeStart, totalDays, dayWidth, todayOffset]);

  function jumpToToday() {
    scrollRef.current?.scrollTo({ left: Math.max(0, todayOffset * dayWidth - 240), behavior: "smooth" });
  }

  const totalHeight = groups.reduce((h, g) => h + g.laneCount * ROW_H + 12, 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect label="Workspace" value={ws} onChange={(v) => { setWs(v); setProj(ALL); }} options={workspaces} allLabel="All workspaces" />
        <FilterSelect label="Project" value={proj} onChange={setProj} options={projectChoices} allLabel="All projects" />
        <FilterSelect label="Assignee" value={assignee} onChange={setAssignee} options={members} allLabel="Everyone" />
        <div className="ml-auto flex items-center gap-1">
          <div className="flex rounded-md border p-0.5">
            {(["day", "week"] as const).map((z) => (
              <button
                key={z}
                type="button"
                onClick={() => setZoom(z)}
                aria-pressed={zoom === z}
                className={cn(
                  "rounded px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                  zoom === z ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {z}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={jumpToToday}>
            Today
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          No scheduled tasks. Add start or due dates to see them on the timeline.
        </p>
      ) : (
        <div ref={scrollRef} className="max-h-[70vh] overflow-auto rounded-xl border">
          <div style={{ width: LABEL_W + gridWidth }} className="relative">
            {/* Header */}
            <div className="sticky top-0 z-20 flex bg-background" style={{ height: HEADER_H }}>
              <div
                className="sticky left-0 z-30 flex items-center border-b border-r bg-background px-3 text-xs font-medium text-muted-foreground"
                style={{ width: LABEL_W, minWidth: LABEL_W }}
              >
                Member workload
              </div>
              <div className="relative border-b" style={{ width: gridWidth }}>
                {header.map((c, i) => (
                  <div
                    key={i}
                    className={cn(
                      "absolute top-0 flex h-full flex-col items-center justify-center border-r text-[10px] leading-tight",
                      c.weekend && "bg-muted/40",
                      c.today && "bg-primary/10",
                    )}
                    style={{ left: c.left, width: c.width }}
                  >
                    <span className="text-muted-foreground">{c.top}</span>
                    <span className={cn("font-medium", c.today && "text-primary")}>{c.bottom}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Body */}
            <div className="relative" style={{ height: totalHeight }}>
              {/* Today line over the grid (not the label column) */}
              {todayOffset >= 0 && todayOffset < totalDays && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute top-0 z-[5] w-0.5 bg-primary/60"
                  style={{ left: LABEL_W + todayOffset * dayWidth, height: totalHeight }}
                />
              )}
              {groups.map((g) => {
                const rowH = g.laneCount * ROW_H + 12;
                return (
                  <div key={g.key} className="flex border-b" style={{ height: rowH }}>
                    <div
                      className="sticky left-0 z-10 flex items-center gap-2 border-r bg-background px-3"
                      style={{ width: LABEL_W, minWidth: LABEL_W }}
                    >
                      <Avatar className="size-6">
                        {g.avatar && <AvatarImage src={g.avatar} alt="" />}
                        <AvatarFallback className="text-[9px]">{getInitials(g.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{g.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {g.count} {g.count === 1 ? "task" : "tasks"}
                          {g.hours > 0 ? ` · ${g.hours}h` : ""}
                        </p>
                      </div>
                    </div>
                    <div
                      className="relative"
                      style={{
                        width: gridWidth,
                        backgroundImage: `repeating-linear-gradient(to right, var(--border) 0 1px, transparent 1px ${zoom === "day" ? dayWidth : dayWidth * 7}px)`,
                      }}
                    >
                      {g.bars.map(({ t, s, e, lane }) => {
                        const left = s * dayWidth;
                        const width = Math.max(dayWidth, (e - s + 1) * dayWidth) - 4;
                        return (
                          <Link
                            key={t.id}
                            href={`/projects/${t.projectId}/tasks?task=${t.id}`}
                            title={`${t.title} · ${format(parseISO(t.start), "MMM d")} → ${format(parseISO(t.end), "MMM d")}`}
                            className={cn(
                              "group absolute flex items-center overflow-hidden rounded-md border bg-card px-1.5 text-xs shadow-sm outline-none transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring",
                              t.isBlocked && "border-rose-300 dark:border-rose-800",
                            )}
                            style={{
                              left,
                              width,
                              top: lane * ROW_H + 6,
                              height: BAR_H,
                              borderLeft: `3px solid ${t.projectColor ?? "#6366f1"}`,
                            }}
                          >
                            {t.progress > 0 && (
                              <span
                                aria-hidden
                                className="absolute inset-y-0 left-0 bg-primary/10"
                                style={{ width: `${t.progress}%` }}
                              />
                            )}
                            <span className="relative truncate font-medium">{t.title}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  allLabel,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  allLabel: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-[170px]" aria-label={label}>
        <SelectValue placeholder={allLabel} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.id} value={o.id}>
            {o.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
