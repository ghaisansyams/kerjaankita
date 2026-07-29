"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { rescheduleTaskDue } from "@/features/tasks/actions";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type CalendarEvent = {
  id: string;
  kind: "task";
  title: string;
  date: string; // yyyy-mm-dd
  projectId: string;
  projectName: string;
  projectColor: string | null;
  workspaceId: string | null;
  assigneeId: string | null;
  isBlocked: boolean;
  done: boolean;
};

type Option = { id: string; name: string };
type ProjectOption = Option & { workspaceId: string | null };
type View = "month" | "week" | "agenda";
const ALL = "all";
const iso = (d: Date) => format(d, "yyyy-MM-dd");

export function CalendarView({
  initialEvents,
  workspaces,
  projects,
  members,
}: {
  initialEvents: CalendarEvent[];
  workspaces: Option[];
  projects: ProjectOption[];
  members: Option[];
}) {
  const router = useRouter();
  const [events, setEvents] = useState(initialEvents);
  const [view, setView] = useState<View>("month");
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [ws, setWs] = useState(ALL);
  const [proj, setProj] = useState(ALL);
  const [assignee, setAssignee] = useState(ALL);
  const [dragId, setDragId] = useState<string | null>(null);

  useEffect(() => setEvents(initialEvents), [initialEvents]);

  // Realtime: reconcile from the server when tasks change anywhere.
  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const bump = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 300);
    };
    const channel = supabase
      .channel("calendar")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, bump)
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [router]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const filtered = useMemo(
    () =>
      events.filter(
        (e) =>
          (ws === ALL || e.workspaceId === ws) &&
          (proj === ALL || e.projectId === proj) &&
          (assignee === ALL || e.assigneeId === assignee),
      ),
    [events, ws, proj, assignee],
  );

  const byDay = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>();
    for (const e of filtered) (m.get(e.date) ?? m.set(e.date, []).get(e.date)!).push(e);
    return m;
  }, [filtered]);

  const projectChoices = useMemo(
    () => (ws === ALL ? projects : projects.filter((p) => p.workspaceId === ws)),
    [projects, ws],
  );

  const reschedule = useCallback(
    async (ev: CalendarEvent, newDate: string) => {
      if (ev.date === newDate) return;
      const snapshot = events;
      setEvents((es) => es.map((e) => (e.id === ev.id ? { ...e, date: newDate } : e)));
      const res = await rescheduleTaskDue({ id: ev.id, dueDate: newDate });
      if (!res?.ok) {
        setEvents(snapshot);
        toast.error(res?.error.message ?? "You can't reschedule this.");
      } else {
        toast.success("Rescheduled");
      }
    },
    [events],
  );

  function onDragStart(e: DragStartEvent) {
    setDragId(String(e.active.id));
  }
  function onDragEnd(e: DragEndEvent) {
    setDragId(null);
    const { active, over } = e;
    if (!over) return;
    const overId = String(over.id);
    if (!overId.startsWith("day:")) return;
    const ev = events.find((x) => x.id === active.id);
    if (ev) reschedule(ev, overId.slice(4));
  }

  const label =
    view === "month"
      ? format(anchor, "MMMM yyyy")
      : view === "week"
        ? `${format(startOfWeek(anchor, { weekStartsOn: 1 }), "MMM d")} – ${format(endOfWeek(anchor, { weekStartsOn: 1 }), "MMM d")}`
        : "Agenda";

  function step(dir: 1 | -1) {
    setAnchor((a) => (view === "week" ? addWeeks(a, dir) : addMonths(a, dir)));
  }

  const activeEvent = dragId ? events.find((e) => e.id === dragId) : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="size-9" aria-label="Previous" onClick={() => step(-1)}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="icon" className="size-9" aria-label="Next" onClick={() => step(1)}>
            <ChevronRight className="size-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAnchor(new Date())}>
            Today
          </Button>
          <span className="ml-2 text-sm font-medium">{label}</span>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <FilterSelect label="Workspace" value={ws} onChange={(v) => { setWs(v); setProj(ALL); }} options={workspaces} allLabel="All workspaces" />
          <FilterSelect label="Project" value={proj} onChange={setProj} options={projectChoices} allLabel="All projects" />
          <FilterSelect label="Assignee" value={assignee} onChange={setAssignee} options={members} allLabel="Everyone" />
          <div className="flex rounded-md border p-0.5">
            {(["month", "week", "agenda"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                aria-pressed={view === v}
                className={cn(
                  "rounded px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                  view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        {view === "agenda" ? (
          <AgendaView events={filtered} />
        ) : (
          <MonthOrWeek view={view} anchor={anchor} byDay={byDay} />
        )}
        <DragOverlay>{activeEvent && <Chip event={activeEvent} overlay />}</DragOverlay>
      </DndContext>
    </div>
  );
}

function MonthOrWeek({
  view,
  anchor,
  byDay,
}: {
  view: "month" | "week";
  anchor: Date;
  byDay: Map<string, CalendarEvent[]>;
}) {
  const days =
    view === "month"
      ? eachDayOfInterval({
          start: startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 }),
          end: endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 }),
        })
      : eachDayOfInterval({
          start: startOfWeek(anchor, { weekStartsOn: 1 }),
          end: endOfWeek(anchor, { weekStartsOn: 1 }),
        });

  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="overflow-hidden rounded-xl border">
      <div className="grid grid-cols-7 border-b bg-muted/40 text-xs font-medium text-muted-foreground">
        {weekdays.map((d) => (
          <div key={d} className="px-2 py-1.5 text-center">
            {d}
          </div>
        ))}
      </div>
      <div className={cn("grid grid-cols-7", view === "month" ? "auto-rows-fr" : "")}>
        {days.map((d) => (
          <DayCell
            key={iso(d)}
            date={d}
            inMonth={view === "week" || isSameMonth(d, anchor)}
            events={byDay.get(iso(d)) ?? []}
            tall={view === "week"}
          />
        ))}
      </div>
    </div>
  );
}

function DayCell({
  date,
  inMonth,
  events,
  tall,
}: {
  date: Date;
  inMonth: boolean;
  events: CalendarEvent[];
  tall: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${iso(date)}` });
  const cap = tall ? 12 : 3;
  const overflow = events.length - cap;
  const today = isToday(date);
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col gap-1 border-b border-r p-1.5",
        tall ? "min-h-[9rem]" : "min-h-[6.5rem]",
        !inMonth && "bg-muted/30 text-muted-foreground",
        isOver && "bg-primary/5 ring-2 ring-inset ring-primary/40",
      )}
    >
      <span
        className={cn(
          "grid size-6 place-items-center self-start rounded-full text-xs tabular-nums",
          today && "bg-primary font-semibold text-primary-foreground",
        )}
      >
        {format(date, "d")}
      </span>
      <div className="flex flex-col gap-1">
        {events.slice(0, cap).map((e) => (
          <Chip key={e.id} event={e} />
        ))}
        {overflow > 0 && <span className="px-1 text-[10px] text-muted-foreground">+{overflow} more</span>}
      </div>
    </div>
  );
}

function Chip({ event, overlay }: { event: CalendarEvent; overlay?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: event.id,
    disabled: overlay,
  });
  const href = `/projects/${event.projectId}/tasks?task=${event.id}`;

  const body = (
    <span className="flex min-w-0 items-center gap-1">
      <span
        aria-hidden
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: event.projectColor ?? "#6366f1" }}
      />
      <span className={cn("truncate", event.done && "line-through opacity-60")}>{event.title}</span>
    </span>
  );

  const classes = cn(
    "block cursor-grab touch-none rounded border bg-card px-1.5 py-0.5 text-[11px] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
    event.isBlocked && "border-rose-300 dark:border-rose-800",
    isDragging && "opacity-40",
    overlay && "w-44 shadow-lg",
  );

  if (overlay) return <span className={classes}>{body}</span>;

  return (
    <div ref={setNodeRef} {...attributes} {...listeners} className={classes}>
      <Link
        href={href}
        onClick={(e) => e.stopPropagation()}
        className="block outline-none"
        draggable={false}
      >
        {body}
      </Link>
    </div>
  );
}

function AgendaView({ events }: { events: CalendarEvent[] }) {
  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));
  const groups: { date: string; items: CalendarEvent[] }[] = [];
  for (const e of sorted) {
    const last = groups[groups.length - 1];
    if (last && last.date === e.date) last.items.push(e);
    else groups.push({ date: e.date, items: [e] });
  }
  if (groups.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
        Nothing scheduled in this window.
      </p>
    );
  }
  return (
    <div className="divide-y rounded-xl border">
      {groups.map((g) => {
        const d = parseISO(g.date);
        return (
          <div key={g.date} className="flex gap-4 p-3">
            <div className="w-24 shrink-0">
              <p className={cn("text-sm font-medium", isToday(d) && "text-primary")}>
                {format(d, "EEE, MMM d")}
              </p>
              {isToday(d) && <p className="text-[11px] text-primary">Today</p>}
            </div>
            <ul className="min-w-0 flex-1 space-y-1.5">
              {g.items.map((e) => (
                <li key={e.id}>
                  <Link
                    href={`/projects/${e.projectId}/tasks?task=${e.id}`}
                    className="flex items-center gap-2 text-sm hover:underline"
                  >
                    <span
                      aria-hidden
                      className="size-2 rounded-full"
                      style={{ backgroundColor: e.projectColor ?? "#6366f1" }}
                    />
                    <span className={cn("truncate", e.done && "line-through opacity-60")}>{e.title}</span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">{e.projectName}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
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
      <SelectTrigger className="h-9 w-[150px]" aria-label={label}>
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
