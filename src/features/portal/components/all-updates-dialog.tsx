"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { formatRelative, getInitials } from "@/utils/format";
import { humanizeActivity } from "@/utils/humanize-activity";
import { loadPortalUpdates, type PortalUpdate } from "../actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const noLookup = { statusName: () => null, memberName: () => null };

/**
 * Full activity history, fetched when the dialog opens rather than shipped with
 * the page — the card only ever needs its short preview, and the feed can run
 * long on an active project.
 */
export function AllUpdatesDialog({
  open,
  onOpenChange,
  projectId,
  fallback,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  /** Shown until the full list arrives, so the dialog is never blank. */
  fallback: PortalUpdate[];
}) {
  const [updates, setUpdates] = useState<PortalUpdate[]>(fallback);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setError(null);
    loadPortalUpdates({ projectId })
      .then((r) => {
        if (!active) return;
        if (r?.ok) setUpdates(r.data.updates);
        else setError(r?.error.message ?? "Couldn't load the updates.");
      })
      .finally(() => active && setLoading(false));
    // Ignore a late response after the dialog is closed or reopened.
    return () => {
      active = false;
    };
  }, [open, projectId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid-cols-[minmax(0,1fr)] max-h-[85vh] gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b px-4 py-3 text-left">
          <DialogTitle>Recent updates</DialogTitle>
          <DialogDescription>Riwayat aktivitas project ini</DialogDescription>
        </DialogHeader>

        <div className="max-h-[65vh] overflow-y-auto px-4 py-3">
          {loading && updates.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Memuat…
            </div>
          ) : error ? (
            <p className="py-10 text-center text-sm text-muted-foreground">{error}</p>
          ) : updates.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No recent updates.</p>
          ) : (
            <ul className="space-y-3">
              {updates.map((u) => (
                <li key={u.id} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                  <Avatar className="mt-0.5 size-6 shrink-0">
                    {u.actorAvatar && <AvatarImage src={u.actorAvatar} alt="" />}
                    <AvatarFallback className="text-[9px]">
                      {getInitials(u.actorName)}
                    </AvatarFallback>
                  </Avatar>
                  <p className="min-w-0 leading-snug">
                    <span className="font-medium text-foreground">{u.actorName ?? "Someone"}</span>{" "}
                    {humanizeActivity(u.action, u.metadata, noLookup)}
                    <span className="ml-1 text-xs">· {formatRelative(u.createdAt)}</span>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
