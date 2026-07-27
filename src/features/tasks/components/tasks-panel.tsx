"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ListTodo, OctagonAlert, Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EmptyState } from "@/components/data/empty-state";
import { StatusBadge } from "@/components/domain/status-badge";
import { PriorityBadge } from "@/components/domain/priority-badge";
import { formatDate, getInitials } from "@/utils/format";
import { cn } from "@/lib/utils";
import type { Priority, StatusCategory } from "@/constants";
import { TaskForm, type MemberOption } from "./task-form";

export type TaskVM = {
  id: string;
  number: number;
  title: string;
  statusName: string | null;
  statusColor: string | null;
  statusCategory: StatusCategory;
  priority: Priority;
  assigneeName: string | null;
  assigneeAvatar: string | null;
  dueDate: string | null;
  progress: number;
  isBlocked: boolean;
};

export function TasksPanel({
  projectId,
  tasks,
  members,
  canCreate,
}: {
  projectId: string;
  tasks: TaskVM[];
  members: MemberOption[];
  canCreate: boolean;
}) {
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter(
      (t) => t.title.toLowerCase().includes(q) || String(t.number).includes(q),
    );
  }, [tasks, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks…"
            aria-label="Search tasks"
            className="pl-8"
          />
        </div>
        {canCreate && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            New task
          </Button>
        )}
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          icon={ListTodo}
          title="No tasks yet"
          description="Break the work down into tasks so it can be assigned and tracked."
          action={
            canCreate ? (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" />
                New task
              </Button>
            ) : undefined
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No tasks match"
          description="Try a different search."
          action={
            <Button variant="outline" onClick={() => setSearch("")}>
              Clear search
            </Button>
          }
        />
      ) : (
        <Card className="divide-y p-0">
          {filtered.map((t) => (
            <Link
              key={t.id}
              href={`/projects/${projectId}/tasks?task=${t.id}`}
              className="flex items-center gap-3 p-3 transition-colors hover:bg-accent"
            >
              <span className="w-9 shrink-0 font-mono text-xs text-muted-foreground">
                #{t.number}
              </span>
              <StatusBadge label={t.statusName} color={t.statusColor} category={t.statusCategory} />
              <span
                className={cn(
                  "min-w-0 flex-1 truncate text-sm",
                  t.statusCategory === "done" && "text-muted-foreground line-through",
                )}
              >
                {t.title}
              </span>
              {t.isBlocked && (
                <OctagonAlert className="size-4 shrink-0 text-rose-500" aria-label="Blocked" />
              )}
              <PriorityBadge priority={t.priority} className="hidden sm:inline-flex" />
              {t.dueDate && (
                <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                  {formatDate(t.dueDate, "MMM d")}
                </span>
              )}
              <span className="w-9 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                {t.progress}%
              </span>
              {t.assigneeName && (
                <Avatar className="size-6 shrink-0">
                  {t.assigneeAvatar && <AvatarImage src={t.assigneeAvatar} alt="" />}
                  <AvatarFallback className="text-[10px]">
                    {getInitials(t.assigneeName)}
                  </AvatarFallback>
                </Avatar>
              )}
            </Link>
          ))}
        </Card>
      )}

      {canCreate && (
        <TaskForm
          open={createOpen}
          onOpenChange={setCreateOpen}
          mode="create"
          projectId={projectId}
          members={members}
        />
      )}
    </div>
  );
}
