"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { loadTaskDrawer } from "../actions";
import { TaskDrawer, type TaskDrawerData } from "./task-drawer";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Opens the task drawer in place on the board — no route navigation, so the
 * board never re-fetches and the app-level loading fallback never fires. The
 * drawer bundle is fetched via a read action and swapped in when ready.
 */
export function BoardDrawerHost({
  projectId,
  taskId,
  onClose,
}: {
  projectId: string;
  taskId: string | null;
  onClose: () => void;
}) {
  const [data, setData] = useState<TaskDrawerData | null>(null);

  useEffect(() => {
    if (!taskId) {
      setData(null);
      return;
    }
    let cancelled = false;
    setData(null);
    loadTaskDrawer(projectId, taskId).then((res) => {
      if (cancelled) return;
      if (res.ok) setData(res.data);
      else {
        toast.error(res.error.message);
        onClose();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [projectId, taskId, onClose]);

  if (!taskId) return null;

  if (!data) {
    return (
      <Sheet open onOpenChange={(o) => !o && onClose()}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
          <SheetHeader className="border-b">
            <SheetTitle className="sr-only">Loading task</SheetTitle>
            <div className="space-y-2 pr-6">
              <Skeleton className="h-3 w-10" />
              <Skeleton className="h-6 w-2/3" />
            </div>
          </SheetHeader>
          <div className="flex-1 space-y-6 p-4">
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return <TaskDrawer {...data} onClose={onClose} />;
}
