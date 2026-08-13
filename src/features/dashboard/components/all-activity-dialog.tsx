"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { formatRelative, getInitials } from "@/utils/format";
import { humanizeActivity } from "@/utils/humanize-activity";
import { notificationHref } from "@/features/notifications/constants";
import { loadRecentActivity } from "../actions";
import type { FeedItem } from "./activity-feed";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const noLookup = { statusName: () => null, memberName: () => null };

/**
 * "Show all" for the dashboard feed, matching the client portal.
 *
 * The full list is fetched when the dialog opens rather than shipped with the
 * page — the card only ever shows a handful, and an active organization
 * accumulates thousands of activity rows.
 */
export function AllActivityDialog({ fallback }: { fallback: FeedItem[] }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<FeedItem[]>(fallback);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setError(null);
    loadRecentActivity({})
      .then((r) => {
        if (!active) return;
        if (r?.ok) setItems(r.data.items);
        else setError(r?.error.message ?? "Couldn't load the activity.");
      })
      .finally(() => active && setLoading(false));
    // Ignore a late response after the dialog closes or reopens.
    return () => {
      active = false;
    };
  }, [open]);

  return (
    <>
      <div className="pt-3 text-right">
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
          Show all activity →
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="grid-cols-[minmax(0,1fr)] max-h-[85vh] gap-0 overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="border-b px-4 py-3 text-left">
            <DialogTitle>Recent activity</DialogTitle>
            <DialogDescription>Riwayat aktivitas di organisasi ini</DialogDescription>
          </DialogHeader>

          <div className="max-h-[65vh] overflow-y-auto px-4 py-3">
            {loading && items.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Memuat…
              </div>
            ) : error ? (
              <p className="py-10 text-center text-sm text-muted-foreground">{error}</p>
            ) : items.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <ul className="space-y-3">
                {items.map((a) => {
                  const href = notificationHref(a.entity, a.entityId);
                  const line = (
                    <div className="flex items-start gap-2.5">
                      <Avatar className="mt-0.5 size-6 shrink-0">
                        {a.actorAvatar && <AvatarImage src={a.actorAvatar} alt="" />}
                        <AvatarFallback className="text-[9px]">
                          {getInitials(a.actorName)}
                        </AvatarFallback>
                      </Avatar>
                      <p className="min-w-0 text-sm leading-snug text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {a.actorName ?? "Someone"}
                        </span>{" "}
                        {humanizeActivity(a.action, a.metadata, noLookup)}
                        <span className="ml-1 text-xs">· {formatRelative(a.createdAt)}</span>
                      </p>
                    </div>
                  );
                  return (
                    <li key={a.id}>
                      {href ? (
                        <Link
                          href={href}
                          onClick={() => setOpen(false)}
                          className="block rounded-md transition-colors hover:bg-muted/50"
                        >
                          {line}
                        </Link>
                      ) : (
                        line
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
